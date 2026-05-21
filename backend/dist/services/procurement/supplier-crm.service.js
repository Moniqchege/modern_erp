"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.advanceSupplierOnboarding = advanceSupplierOnboarding;
exports.syncComplianceDocumentStatuses = syncComplianceDocumentStatuses;
exports.addComplianceDocument = addComplianceDocument;
const server_1 = require("../../server");
const eventBus_1 = require("../../events/eventBus");
const procurementEventTypes_1 = require("../../events/procurementEventTypes");
const helpers_1 = require("./helpers");
const ONBOARDING_FLOW = [
    "DRAFT",
    "QA_AUDIT",
    "FINANCE_APPROVAL",
    "ACTIVE",
];
async function advanceSupplierOnboarding(supplierId, actorName, notes) {
    const supplier = await server_1.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier)
        throw new Error("Supplier not found");
    const idx = ONBOARDING_FLOW.indexOf(supplier.onboardingStatus);
    if (idx < 0 || idx >= ONBOARDING_FLOW.length - 1) {
        throw new Error(`Cannot advance from status ${supplier.onboardingStatus}`);
    }
    const next = ONBOARDING_FLOW[idx + 1];
    const data = { onboardingStatus: next, onboardingNotes: notes };
    if (next === "QA_AUDIT")
        data.qaApprovedAt = null;
    if (next === "FINANCE_APPROVAL")
        data.qaApprovedAt = new Date();
    if (next === "ACTIVE") {
        data.financeApprovedAt = new Date();
        data.activatedAt = new Date();
        data.isActive = true;
    }
    const updated = await server_1.prisma.supplier.update({
        where: { id: supplierId },
        data: data,
    });
    await server_1.prisma.procurementAuditLog.create({
        data: {
            entityType: "Supplier",
            entityId: supplierId,
            action: "STATUS_CHANGE",
            actorName,
            supplierId,
            beforeState: { onboardingStatus: supplier.onboardingStatus },
            afterState: { onboardingStatus: next },
        },
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.SUPPLIER_ONBOARDING_CHANGED,
        aggregateType: "Supplier",
        aggregateId: supplierId,
        payload: { from: supplier.onboardingStatus, to: next },
    });
    return updated;
}
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
