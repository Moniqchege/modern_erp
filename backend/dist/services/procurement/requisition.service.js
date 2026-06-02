"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequisition = createRequisition;
exports.submitRequisition = submitRequisition;
exports.approveRequisition = approveRequisition;
exports.rejectRequisition = rejectRequisition;
exports.generateLowStockRequisitions = generateLowStockRequisitions;
const server_1 = require("../../server");
const eventBus_1 = require("../../events/eventBus");
const procurementEventTypes_1 = require("../../events/procurementEventTypes");
const helpers_1 = require("./helpers");
// ─── helpers ────────────────────────────────────────────────────────────────
async function writeAuditLog(opts) {
    await server_1.prisma.procurementAuditLog.create({
        data: {
            entityType: opts.entityType,
            entityId: opts.entityId,
            action: opts.action,
            actorId: opts.actorId,
            actorName: opts.actorName,
            beforeState: opts.beforeState ?? undefined,
            afterState: opts.afterState ?? undefined,
        },
    });
}
// ─── create ─────────────────────────────────────────────────────────────────
async function createRequisition(input) {
    const distinctProfileIds = [...new Set(input.lines.map((line) => line.itemProfileId))];
    if (input.supplierId) {
        const linkedCount = await server_1.prisma.supplierSuppliedItem.count({
            where: {
                supplierId: input.supplierId,
                itemProfileId: { in: distinctProfileIds },
            },
        });
        if (linkedCount !== distinctProfileIds.length) {
            throw new Error("Selected supplier is not linked to all requisition items. Update supplier supplied stock mapping first.");
        }
    }
    let autoSelectedSupplierId;
    if (!input.supplierId) {
        const preferredLink = await server_1.prisma.supplierSuppliedItem.findFirst({
            where: {
                itemProfileId: { in: distinctProfileIds },
                isPreferred: true,
                supplier: { status: "ACTIVE" },
            },
            orderBy: { updatedAt: "desc" },
        });
        autoSelectedSupplierId = preferredLink?.supplierId;
    }
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
    const requisition = await server_1.prisma.purchaseRequisition.create({
        data: {
            requisitionNo,
            requestedBy: input.requestedBy,
            department: input.department,
            supplierId: input.supplierId ?? autoSelectedSupplierId,
            source: (input.source ?? "MANUAL_PROCUREMENT"),
            justification: input.justification ??
                (autoSelectedSupplierId
                    ? "Auto-selected preferred supplier from supplied stock mapping."
                    : undefined),
            requiredByDate: input.requiredByDate,
            currency: (input.currency ?? "KES"),
            estimatedTotal: (0, helpers_1.toDecimal)(estimatedTotal),
            lines: { create: lineData },
        },
        include: { lines: { include: { itemProfile: true } }, supplier: true },
    });
    await writeAuditLog({
        entityType: "PurchaseRequisition",
        entityId: requisition.id,
        action: "CREATE",
        actorId: input.requestedById,
        actorName: input.requestedBy,
        afterState: { requisitionNo, status: "DRAFT", estimatedTotal },
    });
    return requisition;
}
// ─── submit (Maker → PENDING) ────────────────────────────────────────────────
async function submitRequisition(requisitionId, actorId, actorName) {
    const req = await server_1.prisma.purchaseRequisition.findUnique({
        where: { id: requisitionId },
        include: { lines: true },
    });
    if (!req)
        throw new Error("Requisition not found");
    if (req.status !== "DRAFT")
        throw new Error("Only DRAFT requisitions can be submitted");
    const updated = await server_1.prisma.purchaseRequisition.update({
        where: { id: requisitionId },
        data: { status: "PENDING_HEAD_PROCUREMENT" },
        include: { lines: { include: { itemProfile: true } }, supplier: true, approvals: true },
    });
    await writeAuditLog({
        entityType: "PurchaseRequisition",
        entityId: requisitionId,
        action: "STATUS_CHANGE",
        actorId,
        actorName,
        beforeState: { status: "DRAFT" },
        afterState: { status: "PENDING_HEAD_PROCUREMENT" },
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.REQUISITION_SUBMITTED,
        aggregateType: "PurchaseRequisition",
        aggregateId: requisitionId,
        payload: { requisitionNo: req.requisitionNo, status: "PENDING_HEAD_PROCUREMENT" },
    });
    return updated;
}
// ─── approve (Approver → APPROVED + auto-PO) ────────────────────────────────
async function approveRequisition(requisitionId, actorId, actorName, comments) {
    const req = await server_1.prisma.purchaseRequisition.findUnique({ where: { id: requisitionId } });
    if (!req)
        throw new Error("Requisition not found");
    const pendingStatuses = [
        "PENDING_HEAD_PROCUREMENT",
        "PENDING_FINANCE",
    ];
    if (!pendingStatuses.includes(req.status)) {
        throw new Error("Requisition is not awaiting approval");
    }
    // Determine if a second-level finance approval is needed
    const threshold = await server_1.prisma.approvalThreshold.findFirst({
        where: { isActive: true, currency: req.currency },
        orderBy: { createdAt: "desc" },
    });
    const total = Number(req.estimatedTotal);
    const needsFinance = threshold &&
        total >= Number(threshold.financeDirectorMin) &&
        req.status === "PENDING_HEAD_PROCUREMENT";
    const nextStatus = needsFinance ? "PENDING_FINANCE" : "APPROVED";
    // Record approval in audit trail
    await server_1.prisma.procurementApproval.create({
        data: {
            entityType: "PurchaseRequisition",
            entityId: requisitionId,
            level: req.status === "PENDING_FINANCE" ? "FINANCE_DIRECTOR" : "HEAD_PROCUREMENT",
            approverId: actorId,
            approverName: actorName,
            decision: "APPROVED",
            comments,
            requisitionId,
        },
    });
    const updated = await server_1.prisma.purchaseRequisition.update({
        where: { id: requisitionId },
        data: {
            status: nextStatus,
            approvedAt: nextStatus === "APPROVED" ? new Date() : undefined,
        },
        include: { lines: { include: { itemProfile: true } }, supplier: true, approvals: true },
    });
    await writeAuditLog({
        entityType: "PurchaseRequisition",
        entityId: requisitionId,
        action: "APPROVE",
        actorId,
        actorName,
        beforeState: { status: req.status },
        afterState: { status: nextStatus, comments },
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
// ─── reject ──────────────────────────────────────────────────────────────────
async function rejectRequisition(requisitionId, actorId, actorName, reason) {
    const req = await server_1.prisma.purchaseRequisition.findUnique({ where: { id: requisitionId } });
    if (!req)
        throw new Error("Requisition not found");
    const rejectableStatuses = [
        "PENDING_HEAD_PROCUREMENT",
        "PENDING_FINANCE",
    ];
    if (!rejectableStatuses.includes(req.status)) {
        throw new Error("Only pending requisitions can be rejected");
    }
    await server_1.prisma.procurementApproval.create({
        data: {
            entityType: "PurchaseRequisition",
            entityId: requisitionId,
            level: req.status === "PENDING_FINANCE" ? "FINANCE_DIRECTOR" : "HEAD_PROCUREMENT",
            approverId: actorId,
            approverName: actorName,
            decision: "REJECTED",
            comments: reason,
            requisitionId,
        },
    });
    const updated = await server_1.prisma.purchaseRequisition.update({
        where: { id: requisitionId },
        data: { status: "REJECTED", rejectionReason: reason },
        include: { lines: { include: { itemProfile: true } }, supplier: true, approvals: true },
    });
    await writeAuditLog({
        entityType: "PurchaseRequisition",
        entityId: requisitionId,
        action: "REJECT",
        actorId,
        actorName,
        beforeState: { status: req.status },
        afterState: { status: "REJECTED", reason },
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.REQUISITION_SUBMITTED, // reuse event bus; extend types if needed
        aggregateType: "PurchaseRequisition",
        aggregateId: requisitionId,
        payload: { requisitionNo: req.requisitionNo, status: "REJECTED", reason },
    });
    return updated;
}
// ─── low-stock auto-generation ───────────────────────────────────────────────
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
