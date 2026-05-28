import { RequisitionStatus } from "@prisma/client";
import { prisma } from "../../server";
import { publishDomainEvent } from "../../events/eventBus";
import { PROCUREMENT_EVENTS } from "../../events/procurementEventTypes";
import { nextSequence, toDecimal } from "./helpers";

export async function createRequisition(input: {
  requestedBy: string;
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
        supplier: { isActive: true },
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
      unitPriceEstimate: line.unitPriceEstimate != null ? toDecimal(line.unitPriceEstimate) : undefined,
      lineTotalEstimate: toDecimal(lineTotal),
      notes: line.notes,
    };
  });

  return prisma.purchaseRequisition.create({
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
}

async function getActiveThreshold(currency: string) {
  return prisma.approvalThreshold.findFirst({
    where: { isActive: true, currency: currency as never },
    orderBy: { createdAt: "desc" },
  });
}

export async function submitRequisition(requisitionId: string, approverName: string) {
  const req = await prisma.purchaseRequisition.findUnique({
    where: { id: requisitionId },
    include: { lines: true },
  });
  if (!req) throw new Error("Requisition not found");
  if (req.status !== "DRAFT") throw new Error("Only DRAFT requisitions can be submitted");

  const threshold = await getActiveThreshold(req.currency);
  const total = Number(req.estimatedTotal);
  const needsFinance =
    threshold && total >= Number(threshold.financeDirectorMin);

  const nextStatus: RequisitionStatus = needsFinance
    ? "PENDING_FINANCE"
    : "PENDING_HEAD_PROCUREMENT";

  const updated = await prisma.purchaseRequisition.update({
    where: { id: requisitionId },
    data: { status: nextStatus },
    include: { lines: { include: { itemProfile: true } } },
  });

  await publishDomainEvent({
    eventType: PROCUREMENT_EVENTS.REQUISITION_SUBMITTED,
    aggregateType: "PurchaseRequisition",
    aggregateId: requisitionId,
    payload: { requisitionNo: req.requisitionNo, status: nextStatus },
  });

  return updated;
}

export async function approveRequisition(
  requisitionId: string,
  level: "HEAD_PROCUREMENT" | "FINANCE_DIRECTOR",
  approverName: string,
  comments?: string
) {
  const req = await prisma.purchaseRequisition.findUnique({ where: { id: requisitionId } });
  if (!req) throw new Error("Requisition not found");

  if (level === "HEAD_PROCUREMENT" && req.status !== "PENDING_HEAD_PROCUREMENT") {
    throw new Error("Requisition not awaiting Head of Procurement approval");
  }
  if (level === "FINANCE_DIRECTOR" && req.status !== "PENDING_FINANCE") {
    throw new Error("Requisition not awaiting Finance approval");
  }

  await prisma.procurementApproval.create({
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

  let nextStatus: RequisitionStatus = "APPROVED";
  if (level === "HEAD_PROCUREMENT") {
    const threshold = await getActiveThreshold(req.currency);
    const total = Number(req.estimatedTotal);
    if (threshold && total >= Number(threshold.financeDirectorMin)) {
      nextStatus = "PENDING_FINANCE";
    }
  }

  const updated = await prisma.purchaseRequisition.update({
    where: { id: requisitionId },
    data: {
      status: nextStatus,
      approvedAt: nextStatus === "APPROVED" ? new Date() : undefined,
    },
    include: { lines: { include: { itemProfile: true } } },
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
