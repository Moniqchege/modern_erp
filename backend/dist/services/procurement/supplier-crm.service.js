"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveSupplierOnboarding = approveSupplierOnboarding;
exports.rejectSupplierOnboarding = rejectSupplierOnboarding;
exports.lockSupplier = lockSupplier;
exports.unlockSupplier = unlockSupplier;
exports.syncComplianceDocumentStatuses = syncComplianceDocumentStatuses;
exports.addComplianceDocument = addComplianceDocument;
const server_1 = require("../../server");
const eventBus_1 = require("../../events/eventBus");
const procurementEventTypes_1 = require("../../events/procurementEventTypes");
const helpers_1 = require("./helpers");
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function writeSupplierOnboardingAudit(params) {
    const { supplierId, beforeOnboardingStatus, afterOnboardingStatus, beforeStatus, afterStatus, actorName, notes } = params;
    await server_1.prisma.procurementAuditLog.create({
        data: {
            entityType: "Supplier",
            entityId: supplierId,
            action: "STATUS_CHANGE",
            actorName,
            supplierId,
            beforeState: { onboardingStatus: beforeOnboardingStatus, status: beforeStatus },
            afterState: { onboardingStatus: afterOnboardingStatus, status: afterStatus, notes },
        },
    });
}
async function publishOnboardingChanged(params) {
    const { supplierId, from, to } = params;
    await (0, eventBus_1.publishDomainEvent)({
        eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.SUPPLIER_ONBOARDING_CHANGED,
        aggregateType: "Supplier",
        aggregateId: supplierId,
        payload: { from, to },
    });
}
// ---------------------------------------------------------------------------
// Workflow actions
// ---------------------------------------------------------------------------
/**
 * Approve a supplier.
 * onboardingStatus → APPROVED, status → ACTIVE
 * Only allowed when onboardingStatus is PENDING.
 */
async function approveSupplierOnboarding(supplierId, actorName, notes) {
    const supplier = await server_1.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier)
        throw new Error("Supplier not found");
    if (supplier.onboardingStatus !== "PENDING") {
        throw new Error(`Cannot approve a supplier with status "${supplier.onboardingStatus}". Only PENDING suppliers can be approved.`);
    }
    const updated = await server_1.prisma.supplier.update({
        where: { id: supplierId },
        data: {
            onboardingStatus: "APPROVED",
            status: "ACTIVE",
            onboardingNotes: notes,
            activatedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
        },
    });
    await writeSupplierOnboardingAudit({
        supplierId,
        beforeOnboardingStatus: supplier.onboardingStatus,
        afterOnboardingStatus: "APPROVED",
        beforeStatus: supplier.status,
        afterStatus: "ACTIVE",
        actorName,
        notes,
    });
    await publishOnboardingChanged({ supplierId, from: supplier.onboardingStatus, to: "APPROVED" });
    return updated;
}
/**
 * Reject a supplier.
 * onboardingStatus → REJECTED, status → INACTIVE
 * Only allowed when onboardingStatus is PENDING.
 */
async function rejectSupplierOnboarding(supplierId, actorName, notes) {
    const supplier = await server_1.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier)
        throw new Error("Supplier not found");
    if (supplier.onboardingStatus !== "PENDING") {
        throw new Error(`Cannot reject a supplier with status "${supplier.onboardingStatus}". Only PENDING suppliers can be rejected.`);
    }
    const updated = await server_1.prisma.supplier.update({
        where: { id: supplierId },
        data: {
            onboardingStatus: "REJECTED",
            status: "INACTIVE",
            onboardingNotes: notes,
            lockedAt: null,
            lockedBy: null,
        },
    });
    await writeSupplierOnboardingAudit({
        supplierId,
        beforeOnboardingStatus: supplier.onboardingStatus,
        afterOnboardingStatus: "REJECTED",
        beforeStatus: supplier.status,
        afterStatus: "INACTIVE",
        actorName,
        notes,
    });
    await publishOnboardingChanged({ supplierId, from: supplier.onboardingStatus, to: "REJECTED" });
    return updated;
}
/**
 * Lock (suspend) a supplier.
 * onboardingStatus → SUSPENDED, status → LOCKED
 * Allowed from APPROVED status only.
 */
async function lockSupplier(supplierId, actorName, notes) {
    const supplier = await server_1.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier)
        throw new Error("Supplier not found");
    if (supplier.onboardingStatus !== "APPROVED") {
        throw new Error(`Cannot lock a supplier with status "${supplier.onboardingStatus}". Only APPROVED suppliers can be locked.`);
    }
    const updated = await server_1.prisma.supplier.update({
        where: { id: supplierId },
        data: {
            onboardingStatus: "SUSPENDED",
            status: "LOCKED",
            onboardingNotes: notes,
            lockedAt: new Date(),
            lockedBy: actorName,
        },
    });
    await writeSupplierOnboardingAudit({
        supplierId,
        beforeOnboardingStatus: supplier.onboardingStatus,
        afterOnboardingStatus: "SUSPENDED",
        beforeStatus: supplier.status,
        afterStatus: "LOCKED",
        actorName,
        notes,
    });
    await publishOnboardingChanged({ supplierId, from: supplier.onboardingStatus, to: "SUSPENDED" });
    return updated;
}
/**
 * Unlock a previously suspended supplier, restoring them to APPROVED / ACTIVE.
 */
async function unlockSupplier(supplierId, actorName, notes) {
    const supplier = await server_1.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier)
        throw new Error("Supplier not found");
    if (supplier.onboardingStatus !== "SUSPENDED") {
        throw new Error(`Cannot unlock a supplier with status "${supplier.onboardingStatus}". Only SUSPENDED suppliers can be unlocked.`);
    }
    const updated = await server_1.prisma.supplier.update({
        where: { id: supplierId },
        data: {
            onboardingStatus: "APPROVED",
            status: "ACTIVE",
            onboardingNotes: notes,
            lockedAt: null,
            lockedBy: null,
        },
    });
    await writeSupplierOnboardingAudit({
        supplierId,
        beforeOnboardingStatus: supplier.onboardingStatus,
        afterOnboardingStatus: "APPROVED",
        beforeStatus: supplier.status,
        afterStatus: "ACTIVE",
        actorName,
        notes,
    });
    await publishOnboardingChanged({ supplierId, from: supplier.onboardingStatus, to: "APPROVED" });
    return updated;
}
// ---------------------------------------------------------------------------
// Compliance documents (kept for backward compatibility)
// ---------------------------------------------------------------------------
async function syncComplianceDocumentStatuses(supplierId) {
    const docs = await server_1.prisma.supplierComplianceDocument.findMany({
        where: { supplierId },
    });
    for (const doc of docs) {
        const status = (0, helpers_1.computeComplianceStatus)(doc.expiresAt);
        if (status !== doc.status) {
            await server_1.prisma.supplierComplianceDocument.update({
                where: { id: doc.id },
                data: { status },
            });
        }
    }
}
async function addComplianceDocument(supplierId, data) {
    const status = (0, helpers_1.computeComplianceStatus)(data.expiresAt);
    return server_1.prisma.supplierComplianceDocument.create({
        data: {
            supplierId,
            documentType: data.documentType,
            title: data.title,
            fileUrl: data.fileUrl ?? undefined,
            referenceNo: data.referenceNo ?? undefined,
            issuedAt: data.issuedAt,
            expiresAt: data.expiresAt,
            status: status,
            notes: data.notes ?? undefined,
        },
    });
}
