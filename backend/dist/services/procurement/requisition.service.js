"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequisition = createRequisition;
exports.submitRequisition = submitRequisition;
exports.approveRequisition = approveRequisition;
exports.generateLowStockRequisitions = generateLowStockRequisitions;
const server_1 = require("../../server");
const eventBus_1 = require("../../events/eventBus");
const procurementEventTypes_1 = require("../../events/procurementEventTypes");
const helpers_1 = require("./helpers");
async function createRequisition(input) {
    const requisitionNo = await (0, helpers_1.nextSequence)("PR");
    let estimatedTotal = 0;
    const lineData = input.lines.map((line) => {
        const lineTotal = (line.unitPriceEstimate ?? 0) * line.quantity;
        estimatedTotal += lineTotal;
        return {
            itemProfileId: line.itemProfileId,
            quantity: (0, helpers_1.toDecimal)(line.quantity),
            unitPriceEstimate: line.unitPriceEstimate != null ? (0, helpers_1.toDecimal)(line.unitPriceEstimate) : undefined,
            lineTotalEstimate: (0, helpers_1.toDecimal)(lineTotal),
            notes: line.notes,
        };
    });
    return server_1.prisma.purchaseRequisition.create({
        data: {
            requisitionNo,
            requestedBy: input.requestedBy,
            department: input.department,
            supplierId: input.supplierId,
            source: (input.source ?? "MANUAL_PROCUREMENT"),
            justification: input.justification,
            requiredByDate: input.requiredByDate,
            currency: (input.currency ?? "KES"),
            estimatedTotal: (0, helpers_1.toDecimal)(estimatedTotal),
            lines: { create: lineData },
        },
        include: { lines: { include: { itemProfile: true } }, supplier: true },
    });
}
async function getActiveThreshold(currency) {
    return server_1.prisma.approvalThreshold.findFirst({
        where: { isActive: true, currency: currency },
        orderBy: { createdAt: "desc" },
    });
}
async function submitRequisition(requisitionId, approverName) {
    const req = await server_1.prisma.purchaseRequisition.findUnique({
        where: { id: requisitionId },
        include: { lines: true },
    });
    if (!req)
        throw new Error("Requisition not found");
    if (req.status !== "DRAFT")
        throw new Error("Only DRAFT requisitions can be submitted");
    const threshold = await getActiveThreshold(req.currency);
    const total = Number(req.estimatedTotal);
    const needsFinance = threshold && total >= Number(threshold.financeDirectorMin);
    const nextStatus = needsFinance
        ? "PENDING_FINANCE"
        : "PENDING_HEAD_PROCUREMENT";
    const updated = await server_1.prisma.purchaseRequisition.update({
        where: { id: requisitionId },
        data: { status: nextStatus },
        include: { lines: { include: { itemProfile: true } } },
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.REQUISITION_SUBMITTED,
        aggregateType: "PurchaseRequisition",
        aggregateId: requisitionId,
        payload: { requisitionNo: req.requisitionNo, status: nextStatus },
    });
    return updated;
}
async function approveRequisition(requisitionId, level, approverName, comments) {
    const req = await server_1.prisma.purchaseRequisition.findUnique({ where: { id: requisitionId } });
    if (!req)
        throw new Error("Requisition not found");
    if (level === "HEAD_PROCUREMENT" && req.status !== "PENDING_HEAD_PROCUREMENT") {
        throw new Error("Requisition not awaiting Head of Procurement approval");
    }
    if (level === "FINANCE_DIRECTOR" && req.status !== "PENDING_FINANCE") {
        throw new Error("Requisition not awaiting Finance approval");
    }
    await server_1.prisma.procurementApproval.create({
        data: {
            entityType: "PurchaseRequisition",
            entityId: requisitionId,
            level,
            approverName,
            decision: "APPROVED",
            comments,
            requisitionId,
        },
    });
    let nextStatus = "APPROVED";
    if (level === "HEAD_PROCUREMENT") {
        const threshold = await getActiveThreshold(req.currency);
        const total = Number(req.estimatedTotal);
        if (threshold && total >= Number(threshold.financeDirectorMin)) {
            nextStatus = "PENDING_FINANCE";
        }
    }
    const updated = await server_1.prisma.purchaseRequisition.update({
        where: { id: requisitionId },
        data: {
            status: nextStatus,
            approvedAt: nextStatus === "APPROVED" ? new Date() : undefined,
        },
        include: { lines: { include: { itemProfile: true } } },
    });
    if (nextStatus === "APPROVED") {
        await (0, eventBus_1.publishDomainEvent)({
            eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.REQUISITION_APPROVED,
            aggregateType: "PurchaseRequisition",
            aggregateId: requisitionId,
            payload: { requisitionNo: req.requisitionNo },
        });
    }
    return updated;
}
async function generateLowStockRequisitions() {
    const profiles = await server_1.prisma.procurementItemProfile.findMany({
        where: { isActive: true, lowStockThreshold: { not: null } },
    });
    const created = [];
    for (const profile of profiles) {
        if (!profile.inventoryItemId)
            continue;
        const item = await server_1.prisma.inventoryItem.findUnique({
            where: { id: profile.inventoryItemId },
        });
        if (!item)
            continue;
        if (Number(item.quantity) > Number(profile.lowStockThreshold ?? 0))
            continue;
        const req = await createRequisition({
            requestedBy: "SYSTEM_LOW_STOCK",
            source: "LOW_STOCK_AUTO",
            lines: [
                {
                    itemProfileId: profile.id,
                    quantity: Number(profile.reorderQuantity ?? profile.lowStockThreshold ?? 1),
                },
            ],
        });
        created.push(req);
    }
    return created;
}
