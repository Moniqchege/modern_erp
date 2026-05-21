import { prisma } from "../../server";
import { publishDomainEvent } from "../../events/eventBus";
import { PROCUREMENT_EVENTS } from "../../events/procurementEventTypes";
import { nextSequence, toDecimal } from "./helpers";

export async function createPurchaseOrderFromRequisition(
  requisitionId: string,
  issuedBy: string,
  termsAndConditions?: string
) {
  const req = await prisma.purchaseRequisition.findUnique({
    where: { id: requisitionId },
    include: { lines: { include: { itemProfile: true } }, supplier: true },
  });
  if (!req) throw new Error("Requisition not found");
  if (req.status !== "APPROVED") throw new Error("Requisition must be APPROVED");
  if (!req.supplierId) throw new Error("Supplier required on requisition for PO");

  const poNumber = await nextSequence("PO");
  let subtotal = 0;

  const poLines = req.lines.map((line) => {
    const unitPrice = Number(line.unitPriceEstimate ?? 0);
    const qty = Number(line.quantity);
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    return {
      itemProfileId: line.itemProfileId,
      description: line.itemProfile.name,
      quantity: line.quantity,
      unitPrice: toDecimal(unitPrice),
      lineTotal: toDecimal(lineTotal),
      taxAmount: toDecimal(0),
    };
  });

  const taxRate = 16;
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const po = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: req.supplierId!,
        requisitionId,
        currency: req.currency,
        subtotal: toDecimal(subtotal),
        taxRate: toDecimal(taxRate),
        taxAmount: toDecimal(taxAmount),
        totalAmount: toDecimal(totalAmount),
        termsAndConditions,
        lines: { create: poLines },
      },
      include: { lines: { include: { itemProfile: true } }, supplier: true },
    });

    await tx.purchaseRequisition.update({
      where: { id: requisitionId },
      data: { status: "CONVERTED_TO_PO" },
    });

    return order;
  });

  return po;
}

export async function issuePurchaseOrder(poId: string, issuedBy: string) {
  const po = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: "ISSUED",
      issuedAt: new Date(),
      issuedBy,
    },
    include: { lines: { include: { itemProfile: true } }, supplier: true },
  });

  await publishDomainEvent({
    eventType: PROCUREMENT_EVENTS.PO_ISSUED,
    aggregateType: "PurchaseOrder",
    aggregateId: poId,
    payload: { poNumber: po.poNumber, supplierId: po.supplierId, total: Number(po.totalAmount) },
  });

  return po;
}
