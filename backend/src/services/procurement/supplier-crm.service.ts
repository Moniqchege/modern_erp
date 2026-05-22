import { SupplierOnboardingStatus } from "@prisma/client";
import { prisma } from "../../server";
import { publishDomainEvent } from "../../events/eventBus";
import { PROCUREMENT_EVENTS } from "../../events/procurementEventTypes";
import { computeComplianceStatus } from "./helpers";

const ONBOARDING_FLOW: SupplierOnboardingStatus[] = [
  "DRAFT",
  "QA_AUDIT",
  "FINANCE_APPROVAL",
  "ACTIVE",
];

function isPendingOnboarding(status: SupplierOnboardingStatus) {
  return status === "DRAFT" || status === "QA_AUDIT" || status === "FINANCE_APPROVAL";
}

async function writeSupplierOnboardingAudit(params: {
  supplierId: string;
  beforeStatus: SupplierOnboardingStatus;
  afterStatus: SupplierOnboardingStatus;
  actorName: string;
}) {
  const { supplierId, beforeStatus, afterStatus, actorName } = params;
  await prisma.procurementAuditLog.create({
    data: {
      entityType: "Supplier",
      entityId: supplierId,
      action: "STATUS_CHANGE",
      actorName,
      supplierId,
      beforeState: { onboardingStatus: beforeStatus },
      afterState: { onboardingStatus: afterStatus },
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

export async function advanceSupplierOnboarding(
  supplierId: string,
  actorName: string,
  notes?: string
) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new Error("Supplier not found");

  const idx = ONBOARDING_FLOW.indexOf(supplier.onboardingStatus);
  if (idx < 0 || idx >= ONBOARDING_FLOW.length - 1) {
    throw new Error(`Cannot advance from status ${supplier.onboardingStatus}`);
  }

  const next = ONBOARDING_FLOW[idx + 1];
  const data: Record<string, unknown> = { onboardingStatus: next, onboardingNotes: notes };

  if (next === "QA_AUDIT") data.qaApprovedAt = null;
  if (next === "FINANCE_APPROVAL") data.qaApprovedAt = new Date();

  // Rule: pending onboarding => inactive
  if (next === "ACTIVE") {
    data.financeApprovedAt = new Date();
    data.activatedAt = new Date();
    data.isActive = true;
    data.lockedAt = null;
    data.lockedBy = null;
  } else {
    data.isActive = false;
  }

  const updated = await prisma.supplier.update({
    where: { id: supplierId },
    data: data as Parameters<typeof prisma.supplier.update>[0]["data"],
  });

  await writeSupplierOnboardingAudit({
    supplierId,
    beforeStatus: supplier.onboardingStatus,
    afterStatus: next,
    actorName,
  });

  await publishOnboardingChanged({ supplierId, from: supplier.onboardingStatus, to: next });

  return updated;
}

export async function approveSupplierOnboarding(
  supplierId: string,
  actorName: string,
  notes?: string
) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new Error("Supplier not found");

  if (!isPendingOnboarding(supplier.onboardingStatus)) {
    throw new Error(`Cannot approve from status ${supplier.onboardingStatus}`);
  }

  const next: SupplierOnboardingStatus = "ACTIVE";

  const updated = await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      onboardingStatus: next,
      onboardingNotes: notes,
      financeApprovedAt: new Date(),
      activatedAt: new Date(),
      isActive: true,
      lockedAt: null,
      lockedBy: null,
    },
  });

  await writeSupplierOnboardingAudit({
    supplierId,
    beforeStatus: supplier.onboardingStatus,
    afterStatus: next,
    actorName,
  });

  await publishOnboardingChanged({ supplierId, from: supplier.onboardingStatus, to: next });

  return updated;
}

export async function rejectSupplierOnboarding(
  supplierId: string,
  actorName: string,
  notes?: string
) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new Error("Supplier not found");

  if (!isPendingOnboarding(supplier.onboardingStatus)) {
    throw new Error(`Cannot reject from status ${supplier.onboardingStatus}`);
  }

  const next: SupplierOnboardingStatus = "REJECTED";

  const updated = await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      onboardingStatus: next,
      onboardingNotes: notes,
      isActive: false,
      lockedAt: null,
      lockedBy: null,
    },
  });

  await writeSupplierOnboardingAudit({
    supplierId,
    beforeStatus: supplier.onboardingStatus,
    afterStatus: next,
    actorName,
  });

  await publishOnboardingChanged({ supplierId, from: supplier.onboardingStatus, to: next });

  return updated;
}

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

