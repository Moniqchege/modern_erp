import { RequisitionStatus } from "@prisma/client";
import { prisma } from "../../server";
import { publishDomainEvent } from "../../events/eventBus";
import { PROCUREMENT_EVENTS } from "../../events/procurementEventTypes";
import { nextSequence, toDecimal } from "./helpers";

// ─── helpers ────────────────────────────────────────────────────────────────

async function writeAuditLog(opts: {
  entityType: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "STATUS_CHANGE" | "APPROVE" | "REJECT";
  actorId?: string;
  actorName?: string;
  beforeState?: object;
  afterState?: object;
}) {
  await prisma.procurementAuditLog.create({
    data: {
      entityType: opts.entityType,
      entityId: opts.entityId,
      action: opts.action as never,
      actorId: opts.actorId,
      actorName: opts.actorName,
      beforeState: opts.beforeState ?? undefined,
      afterState: opts.afterState ?? undefined,
    },
  });
}

// ─── create ─────────────────────────────────────────────────────────────────

export async function createRequisition(input: {
  requestedBy: string;
  requestedById?: string;
  department?: string;
  supplierId?: string;
  source?: string;
  justification?: string;
  requiredByDate?: Date;
  currency?: string;
  lines: Array<{
    itemProfileId: string;
    quantity: number;
    unitPriceEstimate?: number;
    notes?: string;
  }>;
}) {
  const distinctProfileIds = [...new Set(input.lines.map((line) => line.itemProfileId))];

  if (input.supplierId) {
    const linkedCount = await prisma.supplierSuppliedItem.count({
      where: {
        supplierId: input.supplierId,
        itemProfileId: { in: distinctProfileIds },
      },
    });
    if (linkedCount !== distinctProfileIds.length) {
      throw new Error(
        "Selected supplier is not linked to all requisition items. Update supplier supplied stock mapping first."
      );
    }
  }

  let autoSelectedSupplierId: string | undefined;
  if (!input.supplierId) {
    const preferredLink = await prisma.supplierSuppliedItem.findFirst({
      where: {
        itemProfileId: { in: distinctProfileIds },
        isPreferred: true,
        supplier: { status: "ACTIVE" },
      },
      orderBy: { updatedAt: "desc" },
    });
    autoSelectedSupplierId = preferredLink?.supplierId;
  }

  const requisitionNo = await nextSequence("PR");
  let estimatedTotal = 0;

  const lineData = input.lines.map((line) => {
    const lineTotal = (line.unitPriceEstimate ?? 0) * line.quantity;
    estimatedTotal += lineTotal;
    return {
      itemProfileId: line.itemProfileId,
      quantity: toDecimal(line.quantity),
      unitPriceEstimate:
        line.unitPriceEstimate != null ? toDecimal(line.unitPriceEstimate) : undefined,
      lineTotalEstimate: toDecimal(lineTotal),
      notes: line.notes,
    };
  });

  const requisition = await prisma.purchaseRequisition.create({
    data: {
      requisitionNo,
      requestedBy: input.requestedBy,
      department: input.department,
      supplierId: input.supplierId ?? autoSelectedSupplierId,
      source: (input.source ?? "MANUAL_PROCUREMENT") as never,
      justification:
        input.justification ??
        (autoSelectedSupplierId
          ? "Auto-selected preferred supplier from supplied stock mapping."
          : undefined),
      requiredByDate: input.requiredByDate,
      currency: (input.currency ?? "KES") as never,
      estimatedTotal: toDecimal(estimatedTotal),
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

export async function submitRequisition(requisitionId: string, actorId: string, actorName: string) {
  const req = await prisma.purchaseRequisition.findUnique({
    where: { id: requisitionId },
    include: { lines: true },
  });
  if (!req) throw new Error("Requisition not found");
  if (req.status !== "DRAFT") throw new Error("Only DRAFT requisitions can be submitted");

  const updated = await prisma.purchaseRequisition.update({
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

  await publishDomainEvent({
    eventType: PROCUREMENT_EVENTS.REQUISITION_SUBMITTED,
    aggregateType: "PurchaseRequisition",
    aggregateId: requisitionId,
    payload: { requisitionNo: req.requisitionNo, status: "PENDING_HEAD_PROCUREMENT" },
  });

  return updated;
}

// ─── approve (Approver → APPROVED + auto-PO) ────────────────────────────────

export async function approveRequisition(
  requisitionId: string,
  actorId: string,
  actorName: string,
  comments?: string
) {
  const req = await prisma.purchaseRequisition.findUnique({ where: { id: requisitionId } });
  if (!req) throw new Error("Requisition not found");

  const pendingStatuses: RequisitionStatus[] = [
    "PENDING_HEAD_PROCUREMENT",
    "PENDING_FINANCE",
  ];
  if (!pendingStatuses.includes(req.status)) {
    throw new Error("Requisition is not awaiting approval");
  }

  // Determine if a second-level finance approval is needed
  const threshold = await prisma.approvalThreshold.findFirst({
    where: { isActive: true, currency: req.currency as never },
    orderBy: { createdAt: "desc" },
  });
  const total = Number(req.estimatedTotal);
  const needsFinance =
    threshold &&
    total >= Number(threshold.financeDirectorMin) &&
    req.status === "PENDING_HEAD_PROCUREMENT";

  const nextStatus: RequisitionStatus = needsFinance ? "PENDING_FINANCE" : "APPROVED";

  // Record approval in audit trail
  await prisma.procurementApproval.create({
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

  const updated = await prisma.purchaseRequisition.update({
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
    await publishDomainEvent({
      eventType: PROCUREMENT_EVENTS.REQUISITION_APPROVED,
      aggregateType: "PurchaseRequisition",
      aggregateId: requisitionId,
      payload: { requisitionNo: req.requisitionNo },
    });
  }

  return updated;
}

// ─── reject ──────────────────────────────────────────────────────────────────

export async function rejectRequisition(
  requisitionId: string,
  actorId: string,
  actorName: string,
  reason: string
) {
  const req = await prisma.purchaseRequisition.findUnique({ where: { id: requisitionId } });
  if (!req) throw new Error("Requisition not found");

  const rejectableStatuses: RequisitionStatus[] = [
    "PENDING_HEAD_PROCUREMENT",
    "PENDING_FINANCE",
  ];
  if (!rejectableStatuses.includes(req.status)) {
    throw new Error("Only pending requisitions can be rejected");
  }

  await prisma.procurementApproval.create({
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

  const updated = await prisma.purchaseRequisition.update({
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

  await publishDomainEvent({
    eventType: PROCUREMENT_EVENTS.REQUISITION_SUBMITTED, // reuse event bus; extend types if needed
    aggregateType: "PurchaseRequisition",
    aggregateId: requisitionId,
    payload: { requisitionNo: req.requisitionNo, status: "REJECTED", reason },
  });

  return updated;
}

// ─── low-stock auto-generation ───────────────────────────────────────────────

export async function generateLowStockRequisitions() {
  const profiles = await prisma.procurementItemProfile.findMany({
    where: { isActive: true, lowStockThreshold: { not: null } },
  });

  const created = [];
  for (const profile of profiles) {
    if (!profile.inventoryItemId) continue;
    const item = await prisma.inventoryItem.findUnique({
      where: { id: profile.inventoryItemId },
    });
    if (!item) continue;
    if (Number(item.quantity) > Number(profile.lowStockThreshold ?? 0)) continue;

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
