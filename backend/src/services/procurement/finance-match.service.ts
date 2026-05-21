import { ThreeWayMatchStatus } from "@prisma/client";
import { prisma } from "../../server";
import { publishDomainEvent } from "../../events/eventBus";
import { PROCUREMENT_EVENTS } from "../../events/procurementEventTypes";
import { nextSequence, toDecimal, variancePct } from "./helpers";

export async function registerSupplierInvoice(input: {
  supplierId: string;
  purchaseOrderId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  currency?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  fileUrl?: string;
}) {
  return prisma.supplierInvoice.create({
    data: {
      supplierId: input.supplierId,
      purchaseOrderId: input.purchaseOrderId,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      currency: (input.currency ?? "KES") as never,
      subtotal: toDecimal(input.subtotal),
      taxAmount: toDecimal(input.taxAmount),
      totalAmount: toDecimal(input.totalAmount),
      fileUrl: input.fileUrl,
    },
  });
}

export async function runThreeWayMatch(input: {
  grnId: string;
  supplierInvoiceId: string;
  matchedBy: string;
  tolerancePct?: number;
}) {
  const grn = await prisma.goodsReceivedNote.findUnique({
    where: { id: input.grnId },
    include: { lines: true, purchaseOrder: true },
  });
  const invoice = await prisma.supplierInvoice.findUnique({
    where: { id: input.supplierInvoiceId },
  });
  if (!grn || !invoice) throw new Error("GRN or supplier invoice not found");
  if (grn.purchaseOrderId !== invoice.purchaseOrderId) {
    throw new Error("GRN and invoice must belong to the same purchase order");
  }

  const poTotal = Number(grn.purchaseOrder.totalAmount);
  const grnTotal = grn.lines.reduce((s, l) => s + Number(l.lineTotal), 0);
  const invoiceTotal = Number(invoice.totalAmount);
  const tolerance = input.tolerancePct ?? 1;

  const priceVariancePct = variancePct(invoiceTotal, poTotal);
  const quantityVariancePct = variancePct(invoiceTotal, grnTotal);

  let status: ThreeWayMatchStatus = "MATCHED";
  if (priceVariancePct > tolerance && quantityVariancePct > tolerance) {
    status = "BOTH_DISCREPANCY";
  } else if (priceVariancePct > tolerance) {
    status = "PRICE_DISCREPANCY";
  } else if (quantityVariancePct > tolerance) {
    status = "QUANTITY_DISCREPANCY";
  }

  const matchNumber = await nextSequence("3WM");
  const match = await prisma.threeWayMatch.create({
    data: {
      matchNumber,
      purchaseOrderId: grn.purchaseOrderId,
      grnId: input.grnId,
      supplierInvoiceId: input.supplierInvoiceId,
      status,
      poTotal: toDecimal(poTotal),
      grnTotal: toDecimal(grnTotal),
      invoiceTotal: toDecimal(invoiceTotal),
      priceVariancePct: toDecimal(priceVariancePct),
      quantityVariancePct: toDecimal(quantityVariancePct),
      tolerancePct: toDecimal(tolerance),
      matchedAt: new Date(),
      matchedBy: input.matchedBy,
      discrepancyNotes:
        status !== "MATCHED"
          ? `Price variance ${priceVariancePct.toFixed(2)}%, quantity variance ${quantityVariancePct.toFixed(2)}%`
          : undefined,
    },
    include: { grn: true, supplierInvoice: true },
  });

  await publishDomainEvent({
    eventType: PROCUREMENT_EVENTS.THREE_WAY_MATCH_COMPLETED,
    aggregateType: "ThreeWayMatch",
    aggregateId: match.id,
    payload: { matchNumber, status, priceVariancePct, quantityVariancePct },
  });

  return match;
}

export async function approveMatchForPayment(matchId: string, approverName: string) {
  const match = await prisma.threeWayMatch.update({
    where: { id: matchId },
    data: { status: "APPROVED_FOR_PAYMENT" },
    include: { supplierInvoice: true },
  });

  const voucherNumber = await nextSequence("PV");
  const voucher = await prisma.paymentVoucher.create({
    data: {
      voucherNumber,
      threeWayMatchId: matchId,
      supplierInvoiceId: match.supplierInvoiceId,
      amount: match.supplierInvoice.totalAmount,
      currency: match.supplierInvoice.currency,
      status: "DRAFT",
    },
  });

  return { match, voucher };
}

export async function pushToAccountsPayableQueue(voucherId: string) {
  const voucher = await prisma.paymentVoucher.update({
    where: { id: voucherId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      apQueuePushedAt: new Date(),
    },
    include: { supplierInvoice: { include: { supplier: true } } },
  });

  await publishDomainEvent({
    eventType: PROCUREMENT_EVENTS.AP_QUEUE_PUSH,
    aggregateType: "PaymentVoucher",
    aggregateId: voucherId,
    payload: {
      voucherNumber: voucher.voucherNumber,
      amount: Number(voucher.amount),
      supplier: voucher.supplierInvoice.supplier.name,
    },
  });

  return voucher;
}
