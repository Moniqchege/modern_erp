"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordWeighbridgeTicket = recordWeighbridgeTicket;
exports.submitProcurementQC = submitProcurementQC;
exports.createGrnDraft = createGrnDraft;
exports.postGrn = postGrn;
const server_1 = require("../../server");
const eventBus_1 = require("../../events/eventBus");
const procurementEventTypes_1 = require("../../events/procurementEventTypes");
const helpers_1 = require("./helpers");
async function recordWeighbridgeTicket(input) {
    const netWeightKg = input.grossWeightKg - input.tareWeightKg;
    if (netWeightKg <= 0)
        throw new Error("Net weight must be positive");
    const ticketNumber = await (0, helpers_1.nextSequence)("WB");
    const ticket = await server_1.prisma.weighbridgeTicket.create({
        data: {
            ticketNumber,
            purchaseOrderId: input.purchaseOrderId,
            rawMaizeBatchId: input.rawMaizeBatchId,
            truckRegistration: input.truckRegistration,
            driverName: input.driverName,
            grossWeightKg: (0, helpers_1.toDecimal)(input.grossWeightKg),
            tareWeightKg: (0, helpers_1.toDecimal)(input.tareWeightKg),
            netWeightKg: (0, helpers_1.toDecimal)(netWeightKg),
            operatorName: input.operatorName,
        },
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.WEIGHBRIDGE_RECORDED,
        aggregateType: "WeighbridgeTicket",
        aggregateId: ticket.id,
        payload: { ticketNumber, netWeightKg },
    });
    return ticket;
}
async function submitProcurementQC(input) {
    const qcNumber = await (0, helpers_1.nextSequence)("QC");
    let status = "PASSED";
    let assignedGrade;
    let priceDeductionPct = 0;
    let blocksInventoryPost = false;
    let rejectionNote;
    if (input.category === "RAW_MATERIAL") {
        const evaluation = (0, helpers_1.evaluateMaizeQC)({
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
    const qc = await server_1.prisma.procurementQCLabResult.create({
        data: {
            qcNumber,
            category: input.category,
            weighbridgeTicketId: input.weighbridgeTicketId,
            rawMaizeBatchId: input.rawMaizeBatchId,
            grnId: input.grnId,
            testedBy: input.testedBy,
            status: status,
            moistureContentPct: input.moistureContentPct != null ? (0, helpers_1.toDecimal)(input.moistureContentPct) : undefined,
            aflatoxinPpb: input.aflatoxinPpb != null ? (0, helpers_1.toDecimal)(input.aflatoxinPpb) : undefined,
            rottenBrokenPct: input.rottenBrokenPct != null ? (0, helpers_1.toDecimal)(input.rottenBrokenPct) : undefined,
            foreignMatterPct: input.foreignMatterPct != null ? (0, helpers_1.toDecimal)(input.foreignMatterPct) : undefined,
            liveInsectsCount: input.liveInsectsCount,
            assignedGrade: assignedGrade,
            tensileStrengthN: input.tensileStrengthN != null ? (0, helpers_1.toDecimal)(input.tensileStrengthN) : undefined,
            printAlignmentScore: input.printAlignmentScore != null ? (0, helpers_1.toDecimal)(input.printAlignmentScore) : undefined,
            dimensionAccuracyMm: input.dimensionAccuracyMm != null ? (0, helpers_1.toDecimal)(input.dimensionAccuracyMm) : undefined,
            priceDeductionPct: (0, helpers_1.toDecimal)(priceDeductionPct),
            acceptedQuantity: input.acceptedQuantity != null ? (0, helpers_1.toDecimal)(input.acceptedQuantity) : undefined,
            rejectionNote,
            remarks: input.remarks,
            blocksInventoryPost,
        },
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.QC_COMPLETED,
        aggregateType: "ProcurementQCLabResult",
        aggregateId: qc.id,
        payload: { qcNumber, status, blocksInventoryPost },
    });
    return qc;
}
async function createGrnDraft(input) {
    const grnNumber = await (0, helpers_1.nextSequence)("GRN");
    const po = await server_1.prisma.purchaseOrder.findUnique({
        where: { id: input.purchaseOrderId },
        include: { grns: true },
    });
    if (!po)
        throw new Error("Purchase order not found");
    const deliverySequence = input.deliverySequence ?? (po.grns.length > 0 ? po.grns.length + 1 : 1);
    const lineCreates = input.lines.map((l) => ({
        purchaseOrderLineId: l.purchaseOrderLineId,
        quantityAccepted: (0, helpers_1.toDecimal)(l.quantityAccepted),
        quantityRejected: (0, helpers_1.toDecimal)(l.quantityRejected ?? 0),
        unitPriceApplied: (0, helpers_1.toDecimal)(l.unitPriceApplied),
        lineTotal: (0, helpers_1.toDecimal)(l.quantityAccepted * l.unitPriceApplied),
        lotNumber: l.lotNumber,
    }));
    const batchTraceCode = `LOT-${new Date().getFullYear()}-${grnNumber}`;
    return server_1.prisma.goodsReceivedNote.create({
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
async function postGrn(grnId, postedBy) {
    const grn = await server_1.prisma.goodsReceivedNote.findUnique({
        where: { id: grnId },
        include: { lines: { include: { purchaseOrderLine: { include: { itemProfile: true } } } }, qcResults: true },
    });
    if (!grn)
        throw new Error("GRN not found");
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
    const posted = await server_1.prisma.$transaction(async (tx) => {
        const updated = await tx.goodsReceivedNote.update({
            where: { id: grnId },
            data: {
                status: "POSTED",
                postedAt: new Date(),
                postedBy,
                netWeightAccepted: (0, helpers_1.toDecimal)(netWeight),
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
        const fullyReceived = poLines.every((pl) => Number(pl.quantityReceived) >= Number(pl.quantity));
        const partial = poLines.some((pl) => Number(pl.quantityReceived) > 0);
        await tx.purchaseOrder.update({
            where: { id: grn.purchaseOrderId },
            data: {
                status: fullyReceived ? "FULLY_RECEIVED" : partial ? "PARTIALLY_RECEIVED" : undefined,
            },
        });
        return updated;
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.GRN_POSTED,
        aggregateType: "GoodsReceivedNote",
        aggregateId: grnId,
        payload: { grnNumber: grn.grnNumber, netWeightAccepted: netWeight },
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: procurementEventTypes_1.PROCUREMENT_EVENTS.INVENTORY_RECEIPT,
        aggregateType: "GoodsReceivedNote",
        aggregateId: grnId,
        payload: { grnNumber: grn.grnNumber, lines: grn.lines.length },
    });
    return posted;
}
