"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPackagingRun = processPackagingRun;
exports.formatPackagingRun = formatPackagingRun;
const server_1 = require("../server");
const inventory_alert_service_1 = require("./inventory-alert.service");
const BALE_WEIGHT_KG = 24;
const GRADE1_SKU = "FL-GR1-01";
const GRADE2_SKU = "FL-GR2-02";
const PKG_MAT_SKU = "PKG-MAT-01";
const GRADE1_BALE_SKU = "FL-GR1-BALE-24";
const GRADE2_BALE_SKU = "FL-GR2-BALE-24";
async function ensureItem(tx, sku, data) {
    let item = await tx.inventoryItem.findUnique({ where: { sku } });
    if (!item) {
        item = await tx.inventoryItem.create({
            data: { sku, ...data, quantity: "0" },
        });
    }
    return item;
}
async function applyMovement(tx, params) {
    const item = await tx.inventoryItem.findUnique({ where: { id: params.itemId } });
    if (!item)
        throw new Error("Inventory item not found");
    const prevQty = Number(item.quantity);
    const newQty = prevQty + params.quantityDelta;
    if (newQty < -0.001) {
        throw new Error(`Insufficient stock for ${item.sku}. Available: ${prevQty.toFixed(3)}, required: ${Math.abs(params.quantityDelta).toFixed(3)}`);
    }
    const latestPrice = await tx.inventoryPriceHistory.findFirst({
        where: { itemId: params.itemId },
        orderBy: { effectiveDate: "desc" },
    });
    await tx.inventoryItem.update({
        where: { id: params.itemId },
        data: { quantity: newQty.toFixed(3) },
    });
    await tx.inventoryMovement.create({
        data: {
            itemId: params.itemId,
            movementType: params.movementType,
            quantityDelta: params.quantityDelta.toFixed(3),
            unitPriceApplied: latestPrice ? latestPrice.unitPrice : "0.00",
            packagingRunId: params.packagingRunId,
            notes: params.notes,
        },
    });
    return { prevQty, newQty };
}
async function processPackagingRun(input) {
    const baleWeight = input.baleWeightKg ?? BALE_WEIGHT_KG;
    const totalFlourIn = input.grade1FlourConsumed + input.grade2FlourConsumed + input.flourSpillage;
    const totalPackagedKg = input.balesProducedGrade1 * baleWeight + input.balesProducedGrade2 * baleWeight;
    const yieldPercent = totalFlourIn > 0 ? (totalPackagedKg / totalFlourIn) * 100 : 0;
    if (totalFlourIn <= 0) {
        throw new Error("Enter flour consumed or spillage for this packaging run.");
    }
    if (totalPackagedKg > totalFlourIn + 0.01) {
        throw new Error("Packaged output cannot exceed total flour input (incl. spillage).");
    }
    return server_1.prisma.$transaction(async (tx) => {
        const runNumber = `PKG-${Date.now().toString().slice(-8)}`;
        const run = await tx.packagingRun.create({
            data: {
                runNumber,
                operatorName: input.operatorName,
                baleWeightKg: baleWeight.toFixed(3),
                grade1FlourConsumed: input.grade1FlourConsumed.toFixed(3),
                grade2FlourConsumed: input.grade2FlourConsumed.toFixed(3),
                flourSpillage: input.flourSpillage.toFixed(3),
                packagingMaterialReceived: (input.packagingMaterialReceived ?? 0).toFixed(3),
                packagingMaterialConsumed: input.packagingMaterialConsumed.toFixed(3),
                packagingMaterialDestroyed: (input.packagingMaterialDestroyed ?? 0).toFixed(3),
                balesProducedGrade1: input.balesProducedGrade1,
                balesProducedGrade2: input.balesProducedGrade2,
                totalPackagedKg: totalPackagedKg.toFixed(3),
                yieldPercent: yieldPercent.toFixed(2),
                notes: input.notes,
            },
        });
        const grade1 = await ensureItem(tx, GRADE1_SKU, {
            name: "Grade 1 Maize Flour",
            description: "Bulk milled grade 1 flour",
            type: "FINISHED_GOOD",
            unit: "KG",
        });
        const grade2 = await ensureItem(tx, GRADE2_SKU, {
            name: "Grade 2 Maize Flour",
            description: "Bulk milled grade 2 flour",
            type: "FINISHED_GOOD",
            unit: "KG",
        });
        const pkgMat = await ensureItem(tx, PKG_MAT_SKU, {
            name: "Packaging Material",
            description: "Sacks, labels and packaging consumables",
            type: "RAW_MATERIAL",
            unit: "KG",
        });
        const g1Bales = await ensureItem(tx, GRADE1_BALE_SKU, {
            name: "Grade 1 Flour Bales (24kg)",
            description: "Packaged grade 1 flour bales",
            type: "FINISHED_GOOD",
            unit: "BAG",
        });
        const g2Bales = await ensureItem(tx, GRADE2_BALE_SKU, {
            name: "Grade 2 Flour Bales (24kg)",
            description: "Packaged grade 2 flour bales",
            type: "FINISHED_GOOD",
            unit: "BAG",
        });
        const alertItems = [];
        if (input.grade1FlourConsumed > 0) {
            const r = await applyMovement(tx, {
                itemId: grade1.id,
                movementType: "ISSUE_TO_PACKAGING",
                quantityDelta: -input.grade1FlourConsumed,
                packagingRunId: run.id,
                notes: `Packaging run ${runNumber} — bulk G1 flour`,
            });
            alertItems.push({ id: grade1.id, prev: r.prevQty });
        }
        if (input.grade2FlourConsumed > 0) {
            const r = await applyMovement(tx, {
                itemId: grade2.id,
                movementType: "ISSUE_TO_PACKAGING",
                quantityDelta: -input.grade2FlourConsumed,
                packagingRunId: run.id,
                notes: `Packaging run ${runNumber} — bulk G2 flour`,
            });
            alertItems.push({ id: grade2.id, prev: r.prevQty });
        }
        if (input.flourSpillage > 0) {
            const flourBase = input.grade1FlourConsumed + input.grade2FlourConsumed;
            const spillG1 = flourBase > 0
                ? input.flourSpillage * (input.grade1FlourConsumed / flourBase)
                : input.flourSpillage;
            const spillG2 = input.flourSpillage - spillG1;
            if (spillG1 > 0.001) {
                await applyMovement(tx, {
                    itemId: grade1.id,
                    movementType: "ADJUSTMENT",
                    quantityDelta: -spillG1,
                    packagingRunId: run.id,
                    notes: `Packaging flour spillage ${runNumber}`,
                });
            }
            if (spillG2 > 0.001) {
                await applyMovement(tx, {
                    itemId: grade2.id,
                    movementType: "ADJUSTMENT",
                    quantityDelta: -spillG2,
                    packagingRunId: run.id,
                    notes: `Packaging flour spillage ${runNumber}`,
                });
            }
        }
        if ((input.packagingMaterialReceived ?? 0) > 0) {
            const r = await applyMovement(tx, {
                itemId: pkgMat.id,
                movementType: "RECEIPT",
                quantityDelta: input.packagingMaterialReceived,
                packagingRunId: run.id,
                notes: `Packaging materials received at station — ${runNumber}`,
            });
            alertItems.push({ id: pkgMat.id, prev: r.prevQty });
        }
        if (input.packagingMaterialConsumed > 0) {
            const r = await applyMovement(tx, {
                itemId: pkgMat.id,
                movementType: "ISSUE_TO_PACKAGING",
                quantityDelta: -input.packagingMaterialConsumed,
                packagingRunId: run.id,
                notes: `Packaging materials used — ${runNumber}`,
            });
            alertItems.push({ id: pkgMat.id, prev: r.prevQty });
        }
        if ((input.packagingMaterialDestroyed ?? 0) > 0) {
            const r = await applyMovement(tx, {
                itemId: pkgMat.id,
                movementType: "ADJUSTMENT",
                quantityDelta: -(input.packagingMaterialDestroyed ?? 0),
                packagingRunId: run.id,
                notes: `Destroyed packaging materials — ${runNumber}`,
            });
            alertItems.push({ id: pkgMat.id, prev: r.prevQty });
        }
        if (input.balesProducedGrade1 > 0) {
            await applyMovement(tx, {
                itemId: g1Bales.id,
                movementType: "RECEIPT",
                quantityDelta: input.balesProducedGrade1,
                packagingRunId: run.id,
                notes: `${input.balesProducedGrade1} bales @ ${baleWeight}kg — ${runNumber}`,
            });
        }
        if (input.balesProducedGrade2 > 0) {
            await applyMovement(tx, {
                itemId: g2Bales.id,
                movementType: "RECEIPT",
                quantityDelta: input.balesProducedGrade2,
                packagingRunId: run.id,
                notes: `${input.balesProducedGrade2} bales @ ${baleWeight}kg — ${runNumber}`,
            });
        }
        for (const { id, prev } of alertItems) {
            await (0, inventory_alert_service_1.checkReorderAlert)(id, prev);
        }
        return run;
    });
}
function formatPackagingRun(run) {
    return {
        ...run,
        baleWeightKg: Number(run.baleWeightKg),
        grade1FlourConsumed: Number(run.grade1FlourConsumed),
        grade2FlourConsumed: Number(run.grade2FlourConsumed),
        flourSpillage: Number(run.flourSpillage),
        packagingMaterialReceived: Number(run.packagingMaterialReceived),
        packagingMaterialConsumed: Number(run.packagingMaterialConsumed),
        packagingMaterialDestroyed: Number(run.packagingMaterialDestroyed),
        totalPackagedKg: Number(run.totalPackagedKg),
        yieldPercent: Number(run.yieldPercent),
    };
}
