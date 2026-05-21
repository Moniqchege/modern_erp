import { prisma } from "../../server";
import { publishDomainEvent } from "../../events/eventBus";
import { PROCUREMENT_EVENTS } from "../../events/procurementEventTypes";
import { evaluateMaizeQC, nextSequence, toDecimal } from "./helpers";

export async function recordWeighbridgeTicket(input: {
  purchaseOrderId?: string;
  rawMaizeBatchId?: string;
  truckRegistration: string;
  driverName?: string;
  grossWeightKg: number;
  tareWeightKg: number;
  operatorName?: string;
}) {
  const netWeightKg = input.grossWeightKg - input.tareWeightKg;
  if (netWeightKg <= 0) throw new Error("Net weight must be positive");

  const ticketNumber = await nextSequence("WB");
  const ticket = await prisma.weighbridgeTicket.create({
    data: {
      ticketNumber,
      purchaseOrderId: input.purchaseOrderId,
      rawMaizeBatchId: input.rawMaizeBatchId,
      truckRegistration: input.truckRegistration,
      driverName: input.driverName,
      grossWeightKg: toDecimal(input.grossWeightKg),
      tareWeightKg: toDecimal(input.tareWeightKg),
      netWeightKg: toDecimal(netWeightKg),
      operatorName: input.operatorName,
    },
  });

  await publishDomainEvent({
    eventType: PROCUREMENT_EVENTS.WEIGHBRIDGE_RECORDED,
    aggregateType: "WeighbridgeTicket",
    aggregateId: ticket.id,
    payload: { ticketNumber, netWeightKg },
  });

  return ticket;
}

export async function submitProcurementQC(input: {
  category: string;
  weighbridgeTicketId?: string;
  rawMaizeBatchId?: string;
  grnId?: string;
  testedBy: string;
  moistureContentPct?: number;
  aflatoxinPpb?: number;
  rottenBrokenPct?: number;
  foreignMatterPct?: number;
  liveInsectsCount?: number;
  tensileStrengthN?: number;
  printAlignmentScore?: number;
  dimensionAccuracyMm?: number;
  acceptedQuantity?: number;
  remarks?: string;
}) {
  const qcNumber = await nextSequence("QC");
  let status: "PENDING" | "PASSED" | "FAILED_CONDITIONAL" | "FULL_REJECTION" = "PASSED";
  let assignedGrade: string | undefined;
  let priceDeductionPct = 0;
  let blocksInventoryPost = false;
  let rejectionNote: string | undefined;

  if (input.category === "RAW_MATERIAL") {
    const evaluation = evaluateMaizeQC({
      moistureContentPct: input.moistureContentPct ?? 0,
      aflatoxinPpb: input.aflatoxinPpb ?? 0,
      rottenBrokenPct: input.rottenBrokenPct ?? 0,
      foreignMatterPct: input.foreignMatterPct ?? 0,
      liveInsectsCount: input.liveInsectsCount ?? 0,
    });
    status = evaluation.status;
    assignedGrade = evaluation.assignedGrade;
    priceDeductionPct = evaluation.priceDeductionPct;
    blocksInventoryPost = evaluation.blocksInventoryPost;
    rejectionNote = evaluation.rejectionNote;
  }

  const qc = await prisma.procurementQCLabResult.create({
    data: {
      qcNumber,
      category: input.category as never,
      weighbridgeTicketId: input.weighbridgeTicketId,
      rawMaizeBatchId: input.rawMaizeBatchId,
      grnId: input.grnId,
      testedBy: input.testedBy,
      status: status as never,
      moistureContentPct: input.moistureContentPct != null ? toDecimal(input.moistureContentPct) : undefined,
      aflatoxinPpb: input.aflatoxinPpb != null ? toDecimal(input.aflatoxinPpb) : undefined,
      rottenBrokenPct: input.rottenBrokenPct != null ? toDecimal(input.rottenBrokenPct) : undefined,
      foreignMatterPct: input.foreignMatterPct != null ? toDecimal(input.foreignMatterPct) : undefined,
      liveInsectsCount: input.liveInsectsCount,
      assignedGrade: assignedGrade as never,
      tensileStrengthN: input.tensileStrengthN != null ? toDecimal(input.tensileStrengthN) : undefined,
      printAlignmentScore: input.printAlignmentScore != null ? toDecimal(input.printAlignmentScore) : undefined,
      dimensionAccuracyMm: input.dimensionAccuracyMm != null ? toDecimal(input.dimensionAccuracyMm) : undefined,
      priceDeductionPct: toDecimal(priceDeductionPct),
      acceptedQuantity:
        input.acceptedQuantity != null ? toDecimal(input.acceptedQuantity) : undefined,
      rejectionNote,
      remarks: input.remarks,
      blocksInventoryPost,
    },
  });

  await publishDomainEvent({
    eventType: PROCUREMENT_EVENTS.QC_COMPLETED,
    aggregateType: "ProcurementQCLabResult",
    aggregateId: qc.id,
    payload: { qcNumber, status, blocksInventoryPost },
  });

  return qc;
}

export async function createGrnDraft(input: {
  purchaseOrderId: string;
  weighbridgeTicketId?: string;
  receivedBy: string;
  deliverySequence?: number;
  lines: Array<{
    purchaseOrderLineId: string;
    quantityAccepted: number;
    quantityRejected?: number;
    unitPriceApplied: number;
    lotNumber?: string;
  }>;
}) {
  const grnNumber = await nextSequence("GRN");
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: input.purchaseOrderId },
    include: { grns: true },
  });
  if (!po) throw new Error("Purchase order not found");

  const deliverySequence =
    input.deliverySequence ?? (po.grns.length > 0 ? po.grns.length + 1 : 1);

  const lineCreates = input.lines.map((l) => ({
    purchaseOrderLineId: l.purchaseOrderLineId,
    quantityAccepted: toDecimal(l.quantityAccepted),
    quantityRejected: toDecimal(l.quantityRejected ?? 0),
    unitPriceApplied: toDecimal(l.unitPriceApplied),
    lineTotal: toDecimal(l.quantityAccepted * l.unitPriceApplied),
    lotNumber: l.lotNumber,
  }));

  const batchTraceCode = `LOT-${new Date().getFullYear()}-${grnNumber}`;

  return prisma.goodsReceivedNote.create({
    data: {
      grnNumber,
      purchaseOrderId: input.purchaseOrderId,
      weighbridgeTicketId: input.weighbridgeTicketId,
      deliverySequence,
      status: "PENDING_QC",
      receivedBy: input.receivedBy,
      batchTraceCode,
      lines: { create: lineCreates },
    },
    include: { lines: true, purchaseOrder: true },
  });
}

export async function postGrn(grnId: string, postedBy: string) {
  const grn = await prisma.goodsReceivedNote.findUnique({
    where: { id: grnId },
    include: { lines: { include: { purchaseOrderLine: { include: { itemProfile: true } } } }, qcResults: true },
  });
  if (!grn) throw new Error("GRN not found");

  const blockingQc = grn.qcResults.find((q) => q.blocksInventoryPost && q.status !== "PASSED");
  if (blockingQc) {
    throw new Error("Cannot post GRN: QC gate not passed");
  }

  const passedQc = grn.qcResults.find((q) => q.status === "PASSED" || q.status === "FAILED_CONDITIONAL");
  if (!passedQc && grn.status === "PENDING_QC") {
    throw new Error("Lab QC must be logged before posting GRN");
  }

  const netWeight = passedQc?.acceptedQuantity
    ? Number(passedQc.acceptedQuantity)
    : grn.lines.reduce((s, l) => s + Number(l.quantityAccepted), 0);

  const posted = await prisma.$transaction(async (tx) => {
    const updated = await tx.goodsReceivedNote.update({
      where: { id: grnId },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        postedBy,
        netWeightAccepted: toDecimal(netWeight),
      },
      include: { lines: true },
    });

    const poRef = await tx.purchaseOrder.findUnique({
      where: { id: grn.purchaseOrderId },
      select: { supplierId: true },
    });

    for (const line of grn.lines) {
      const profile = line.purchaseOrderLine.itemProfile;
      if (profile.inventoryItemId) {
        await tx.inventoryMovement.create({
          data: {
            itemId: profile.inventoryItemId,
            movementType: "RECEIPT",
            quantityDelta: line.quantityAccepted,
            unitPriceApplied: line.unitPriceApplied,
            supplierId: poRef?.supplierId,
            grnLineId: line.id,
            notes: `GRN ${grn.grnNumber} lot ${line.lotNumber ?? grn.batchTraceCode}`,
          },
        });
        await tx.inventoryItem.update({
          where: { id: profile.inventoryItemId },
          data: {
            quantity: { increment: line.quantityAccepted },
          },
        });
      }

      await tx.purchaseOrderLine.update({
        where: { id: line.purchaseOrderLineId },
        data: {
          quantityReceived: { increment: line.quantityAccepted },
        },
      });
    }

    const poLines = await tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId: grn.purchaseOrderId },
    });
    const fullyReceived = poLines.every(
      (pl) => Number(pl.quantityReceived) >= Number(pl.quantity)
    );
    const partial = poLines.some((pl) => Number(pl.quantityReceived) > 0);

    await tx.purchaseOrder.update({
      where: { id: grn.purchaseOrderId },
      data: {
        status: fullyReceived ? "FULLY_RECEIVED" : partial ? "PARTIALLY_RECEIVED" : undefined,
      },
    });

    return updated;
  });

  await publishDomainEvent({
    eventType: PROCUREMENT_EVENTS.GRN_POSTED,
    aggregateType: "GoodsReceivedNote",
    aggregateId: grnId,
    payload: { grnNumber: grn.grnNumber, netWeightAccepted: netWeight },
  });

  await publishDomainEvent({
    eventType: PROCUREMENT_EVENTS.INVENTORY_RECEIPT,
    aggregateType: "GoodsReceivedNote",
    aggregateId: grnId,
    payload: { grnNumber: grn.grnNumber, lines: grn.lines.length },
  });

  return posted;
}
