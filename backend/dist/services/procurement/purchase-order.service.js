"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPurchaseOrderFromRequisition = createPurchaseOrderFromRequisition;
exports.issuePurchaseOrder = issuePurchaseOrder;
const server_1 = require("../../server");
const eventBus_1 = require("../../events/eventBus");
const procurementEventTypes_1 = require("../../events/procurementEventTypes");
const helpers_1 = require("./helpers");
async function createPurchaseOrderFromRequisition(requisitionId, issuedBy, termsAndConditions) {
    const req = await server_1.prisma.purchaseRequisition.findUnique({
        where: { id: requisitionId },
        include: { lines: { include: { itemProfile: true } }, supplier: true },
    });
    if (!req)
        throw new Error("Requisition not found");
    if (req.status !== "APPROVED")
        throw new Error("Requisition must be APPROVED");
    if (!req.supplierId)
        throw new Error("Supplier required on requisition for PO");
    const poNumber = await (0, helpers_1.nextSequence)("PO");
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
            unitPrice: (0, helpers_1.toDecimal)(unitPrice),
            lineTotal: (0, helpers_1.toDecimal)(lineTotal),
            taxAmount: (0, helpers_1.toDecimal)(0),
        };
    });
    const taxRate = 16;
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;
    const po = await server_1.prisma.$transaction(async (tx) => {
        const order = await tx.purchaseOrder.create({
            data: {
                poNumber,
                supplierId: req.supplierId,
                requisitionId,
                currency: req.currency,
                subtotal: (0, helpers_1.toDecimal)(subtotal),
                taxRate: (0, helpers_1.toDecimal)(taxRate),
                taxAmount: (0, helpers_1.toDecimal)(taxAmount),
                totalAmount: (0, helpers_1.toDecimal)(totalAmount),
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
async function issuePurchaseOrder(poId, issuedBy) {
    const po = await server_1.prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
            status: "ISSUED",
            issuedAt: new Date(),
            issuedBy,
        },
        include: { lines: { include: { itemProfile: true } }, supplier: true },
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.PO_ISSUED,
        aggregateType: "PurchaseOrder",
        aggregateId: poId,
        payload: { poNumber: po.poNumber, supplierId: po.supplierId, total: Number(po.totalAmount) },
    });
    return po;
}
