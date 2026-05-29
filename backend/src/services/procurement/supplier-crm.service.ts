import { SupplierOnboardingStatus, SupplierStatus } from "@prisma/client";
import { prisma } from "../../server";
import { publishDomainEvent } from "../../events/eventBus";
import { PROCUREMENT_EVENTS } from "../../events/procurementEventTypes";
import { computeComplianceStatus } from "./helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeSupplierOnboardingAudit(params: {
  supplierId: string;
  beforeOnboardingStatus: SupplierOnboardingStatus;
  afterOnboardingStatus: SupplierOnboardingStatus;
  beforeStatus: SupplierStatus;
  afterStatus: SupplierStatus;
  actorName: string;
  notes?: string;
}) {
  const { supplierId, beforeOnboardingStatus, afterOnboardingStatus, beforeStatus, afterStatus, actorName, notes } = params;
  await prisma.procurementAuditLog.create({
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

async function publishOnboardingChanged(params: {
  supplierId: string;
  from: SupplierOnboardingStatus;
  to: SupplierOnboardingStatus;
}) {
  const { supplierId, from, to } = params;
  await publishDomainEvent({
    eventType: PROCUREMENT_EVENTS.SUPPLIER_ONBOARDING_CHANGED,
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
export async function approveSupplierOnboarding(
  supplierId: string,
  actorName: string,
  notes?: string
) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new Error("Supplier not found");

  if (supplier.onboardingStatus !== "PENDING") {
    throw new Error(
      `Cannot approve a supplier with status "${supplier.onboardingStatus}". Only PENDING suppliers can be approved.`
    );
  }

  const updated = await prisma.supplier.update({
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
export async function rejectSupplierOnboarding(
  supplierId: string,
  actorName: string,
  notes?: string
) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new Error("Supplier not found");

  if (supplier.onboardingStatus !== "PENDING") {
    throw new Error(
      `Cannot reject a supplier with status "${supplier.onboardingStatus}". Only PENDING suppliers can be rejected.`
    );
  }

  const updated = await prisma.supplier.update({
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
export async function lockSupplier(
  supplierId: string,
  actorName: string,
  notes?: string
) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new Error("Supplier not found");

  if (supplier.onboardingStatus !== "APPROVED") {
    throw new Error(
      `Cannot lock a supplier with status "${supplier.onboardingStatus}". Only APPROVED suppliers can be locked.`
    );
  }

  const updated = await prisma.supplier.update({
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
export async function unlockSupplier(
  supplierId: string,
  actorName: string,
  notes?: string
) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new Error("Supplier not found");

  if (supplier.onboardingStatus !== "SUSPENDED") {
    throw new Error(
      `Cannot unlock a supplier with status "${supplier.onboardingStatus}". Only SUSPENDED suppliers can be unlocked.`
    );
  }

  const updated = await prisma.supplier.update({
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

export async function syncComplianceDocumentStatuses(supplierId: string) {
  const docs = await prisma.supplierComplianceDocument.findMany({
    where: { supplierId },
  });

  for (const doc of docs) {
    const status = computeComplianceStatus(doc.expiresAt);
    if (status !== doc.status) {
      await prisma.supplierComplianceDocument.update({
        where: { id: doc.id },
        data: { status },
      });
    }
  }
}

export async function addComplianceDocument(
  supplierId: string,
  data: {
    documentType: string;
    title: string;
    fileUrl?: string | null;
    referenceNo?: string | null;
    issuedAt?: Date;
    expiresAt?: Date;
    notes?: string | null;
  }
) {
  const status = computeComplianceStatus(data.expiresAt);
  return prisma.supplierComplianceDocument.create({
    data: {
      supplierId,
      documentType: data.documentType as never,
      title: data.title,
      fileUrl: data.fileUrl ?? undefined,
      referenceNo: data.referenceNo ?? undefined,
      issuedAt: data.issuedAt,
      expiresAt: data.expiresAt,
      status: status as never,
      notes: data.notes ?? undefined,
    },
  });
}
