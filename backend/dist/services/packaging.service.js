"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPackagingRun = processPackagingRun;
exports.formatPackagingRun = formatPackagingRun;
const server_1 = require("../server");
const inventory_alert_service_1 = require("./inventory-alert.service");
const BALE_WEIGHT_KG = 24;
const PKG_MAT_SKU = "PKG-MAT-01";
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
    const totalFlourBulkIn = input.flourConsumption.reduce((s, r) => s + r.consumedKg, 0);
    const totalFlourIn = totalFlourBulkIn + input.flourSpillage;
    const totalBales = input.flourPackedOutputs.reduce((s, r) => s + r.balesProduced, 0);
    const totalPackagedKg = totalBales * baleWeight;
    const yieldPercent = totalFlourIn > 0 ? (totalPackagedKg / totalFlourIn) * 100 : 0;
    if (totalFlourIn <= 0) {
        throw new Error("Enter flour consumed or spillage for this packaging run.");
    }
    if (totalPackagedKg > totalFlourIn + 0.01) {
        throw new Error("Packaged output cannot exceed total flour input (incl. spillage).\n");
    }
    // Legacy fields best-effort mapping (keeps existing packagingRun table columns usable)
    // We only know grade SKUs historically; dynamic mapping still credits correct inventory items.
    const LEGACY_GRADE1_FLOUR_SKU = "FL-GR1-01";
    const LEGACY_GRADE2_FLOUR_SKU = "FL-GR2-02";
    const LEGACY_GRADE1_BALE_SKU = "FL-GR1-BALE-24";
    const LEGACY_GRADE2_BALE_SKU = "FL-GR2-BALE-24";
    return server_1.prisma.$transaction(async (tx) => {
        const runNumber = `PKG-${Date.now().toString().slice(-8)}`;
        // Create run row using legacy columns for now (best-effort)
        const run = await tx.packagingRun.create({
            data: {
                runNumber,
                operatorName: input.operatorName,
                baleWeightKg: baleWeight.toFixed(3),
                grade1FlourConsumed: 0,
                grade2FlourConsumed: 0,
                flourSpillage: input.flourSpillage.toFixed(3),
                packagingMaterialReceived: (input.packagingMaterialReceived ?? 0).toFixed(3),
                packagingMaterialConsumed: input.packagingMaterialConsumed.toFixed(3),
                packagingMaterialDestroyed: (input.packagingMaterialDestroyed ?? 0).toFixed(3),
                balesProducedGrade1: 0,
                balesProducedGrade2: 0,
                totalPackagedKg: totalPackagedKg.toFixed(3),
                yieldPercent: yieldPercent.toFixed(2),
                notes: input.notes,
            },
        });
        const pkgMat = await ensureItem(tx, PKG_MAT_SKU, {
            name: "Packaging Material",
            description: "Sacks, labels and packaging consumables",
            type: "RAW_MATERIAL",
            unit: "KG",
        });
        const alertItems = [];
        // Build spillage distribution proportional to consumedKg
        const flourRows = input.flourConsumption.map((r) => ({ ...r }));
        const baseSum = totalFlourBulkIn;
        for (const row of flourRows) {
            if (row.consumedKg <= 0)
                continue;
            // ISSUE bulk flour consumption
            const rMove = await applyMovement(tx, {
                itemId: row.flourInventoryItemId,
                movementType: "ISSUE_TO_PACKAGING",
                quantityDelta: -row.consumedKg,
                packagingRunId: run.id,
                notes: `Packaging run ${runNumber} — bulk flour`,
            });
            alertItems.push({ id: row.flourInventoryItemId, prev: rMove.prevQty });
            // legacy grade fields best-effort
            const flourItem = await tx.inventoryItem.findUnique({ where: { id: row.flourInventoryItemId } });
            if (flourItem?.sku === LEGACY_GRADE1_FLOUR_SKU) {
                run.grade1FlourConsumed = undefined;
            }
            // ADJUST for allocated spillage portion
            if (input.flourSpillage > 0 && baseSum > 0) {
                const allocatedSpill = (input.flourSpillage * row.consumedKg) / baseSum;
                if (allocatedSpill > 0.001) {
                    await applyMovement(tx, {
                        itemId: row.flourInventoryItemId,
                        movementType: "ADJUSTMENT",
                        quantityDelta: -allocatedSpill,
                        packagingRunId: run.id,
                        notes: `Packaging flour spillage ${runNumber}`,
                    });
                }
            }
        }
        // Packaging materials movements
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
        // Receipts into dynamic bale items
        for (const out of input.flourPackedOutputs) {
            if (out.balesProduced <= 0)
                continue;
            // If frontend didn't specify bale item id yet, fall back to the first bale item (legacy assumption).
            // This prevents "Inventory item not found" errors when packedBaleInventoryItemId is "".
            const baleItemId = out.packedBaleInventoryItemId || (await tx.inventoryItem.findFirst({
                where: {
                    type: "FINISHED_GOOD",
                    // Avoid unit filtering (Prisma unit enum type may not include "BALE" in your DB seed)
                },
                select: { id: true },
                orderBy: { createdAt: "asc" },
            }))?.id;
            if (!baleItemId) {
                throw new Error("Bale inventory item not found. Please configure packedBaleInventoryItemId or seed a BALE item.");
            }
            await applyMovement(tx, {
                itemId: baleItemId,
                movementType: "RECEIPT",
                quantityDelta: out.balesProduced,
                packagingRunId: run.id,
                notes: `${out.balesProduced} bales @ ${baleWeight}kg — ${runNumber}`,
            });
            // legacy mapping can be done by checking bale sku
            const baleItem = await tx.inventoryItem.findUnique({ where: { id: out.packedBaleInventoryItemId } });
            if (baleItem?.sku === LEGACY_GRADE1_BALE_SKU) {
                await tx.packagingRun.update({
                    where: { id: run.id },
                    data: { balesProducedGrade1: out.balesProduced },
                });
            }
            if (baleItem?.sku === LEGACY_GRADE2_BALE_SKU) {
                await tx.packagingRun.update({
                    where: { id: run.id },
                    data: { balesProducedGrade2: out.balesProduced },
                });
            }
        }
        for (const { id, prev } of alertItems) {
            await (0, inventory_alert_service_1.checkReorderAlert)(id, prev);
        }
        return tx.packagingRun.findUnique({ where: { id: run.id } });
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
