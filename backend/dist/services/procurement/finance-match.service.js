"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSupplierInvoice = registerSupplierInvoice;
exports.runThreeWayMatch = runThreeWayMatch;
exports.approveMatchForPayment = approveMatchForPayment;
exports.pushToAccountsPayableQueue = pushToAccountsPayableQueue;
const server_1 = require("../../server");
const eventBus_1 = require("../../events/eventBus");
const procurementEventTypes_1 = require("../../events/procurementEventTypes");
const helpers_1 = require("./helpers");
async function registerSupplierInvoice(input) {
    return server_1.prisma.supplierInvoice.create({
        data: {
            supplierId: input.supplierId,
            purchaseOrderId: input.purchaseOrderId,
            invoiceNumber: input.invoiceNumber,
            invoiceDate: input.invoiceDate,
            dueDate: input.dueDate,
            currency: (input.currency ?? "KES"),
            subtotal: (0, helpers_1.toDecimal)(input.subtotal),
            taxAmount: (0, helpers_1.toDecimal)(input.taxAmount),
            totalAmount: (0, helpers_1.toDecimal)(input.totalAmount),
            fileUrl: input.fileUrl,
        },
    });
}
async function runThreeWayMatch(input) {
    const grn = await server_1.prisma.goodsReceivedNote.findUnique({
        where: { id: input.grnId },
        include: { lines: true, purchaseOrder: true },
    });
    const invoice = await server_1.prisma.supplierInvoice.findUnique({
        where: { id: input.supplierInvoiceId },
    });
    if (!grn || !invoice)
        throw new Error("GRN or supplier invoice not found");
    if (grn.purchaseOrderId !== invoice.purchaseOrderId) {
        throw new Error("GRN and invoice must belong to the same purchase order");
    }
    const poTotal = Number(grn.purchaseOrder.totalAmount);
    const grnTotal = grn.lines.reduce((s, l) => s + Number(l.lineTotal), 0);
    const invoiceTotal = Number(invoice.totalAmount);
    const tolerance = input.tolerancePct ?? 1;
    const priceVariancePct = (0, helpers_1.variancePct)(invoiceTotal, poTotal);
    const quantityVariancePct = (0, helpers_1.variancePct)(invoiceTotal, grnTotal);
    let status = "MATCHED";
    if (priceVariancePct > tolerance && quantityVariancePct > tolerance) {
        status = "BOTH_DISCREPANCY";
    }
    else if (priceVariancePct > tolerance) {
        status = "PRICE_DISCREPANCY";
    }
    else if (quantityVariancePct > tolerance) {
        status = "QUANTITY_DISCREPANCY";
    }
    const matchNumber = await (0, helpers_1.nextSequence)("3WM");
    const match = await server_1.prisma.threeWayMatch.create({
        data: {
            matchNumber,
            purchaseOrderId: grn.purchaseOrderId,
            grnId: input.grnId,
            supplierInvoiceId: input.supplierInvoiceId,
            status,
            poTotal: (0, helpers_1.toDecimal)(poTotal),
            grnTotal: (0, helpers_1.toDecimal)(grnTotal),
            invoiceTotal: (0, helpers_1.toDecimal)(invoiceTotal),
            priceVariancePct: (0, helpers_1.toDecimal)(priceVariancePct),
            quantityVariancePct: (0, helpers_1.toDecimal)(quantityVariancePct),
            tolerancePct: (0, helpers_1.toDecimal)(tolerance),
            matchedAt: new Date(),
            matchedBy: input.matchedBy,
            discrepancyNotes: status !== "MATCHED"
                ? `Price variance ${priceVariancePct.toFixed(2)}%, quantity variance ${quantityVariancePct.toFixed(2)}%`
                : undefined,
        },
        include: { grn: true, supplierInvoice: true },
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.THREE_WAY_MATCH_COMPLETED,
        aggregateType: "ThreeWayMatch",
        aggregateId: match.id,
        payload: { matchNumber, status, priceVariancePct, quantityVariancePct },
    });
    return match;
}
async function approveMatchForPayment(matchId, approverName) {
    const match = await server_1.prisma.threeWayMatch.update({
        where: { id: matchId },
        data: { status: "APPROVED_FOR_PAYMENT" },
        include: { supplierInvoice: true },
    });
    const voucherNumber = await (0, helpers_1.nextSequence)("PV");
    const voucher = await server_1.prisma.paymentVoucher.create({
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
async function pushToAccountsPayableQueue(voucherId) {
    const voucher = await server_1.prisma.paymentVoucher.update({
        where: { id: voucherId },
        data: {
            status: "APPROVED",
            approvedAt: new Date(),
            apQueuePushedAt: new Date(),
        },
        include: { supplierInvoice: { include: { supplier: true } } },
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.AP_QUEUE_PUSH,
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
