"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KG_PER_UNIT_BY_TYPE = void 0;
exports.processPackagingRun = processPackagingRun;
exports.formatPackagingRun = formatPackagingRun;
const server_1 = require("../server");
const inventory_alert_service_1 = require("./inventory-alert.service");
exports.KG_PER_UNIT_BY_TYPE = {
    NYLON_BALER_1KG: 24,
    NYLON_BALER_2KG: 24,
    KHAKI_BALER_1KG: 24,
    KHAKI_BALER_2KG: 24,
    LAMINATED_BALER: 24,
    BAG_5KG: 5,
    BAG_10KG: 10,
    BAG_50KG: 50,
    BAG_90KG: 90,
    PACKETS_1KG: 1,
    PACKETS_2KG: 2,
};
const LEGACY_BALE_KG = 24;
async function resolveKgPerUnit(tx, inventoryItemId, clientKgPerUnit) {
    if (clientKgPerUnit > 0)
        return clientKgPerUnit;
    const item = await tx.inventoryItem.findUnique({
        where: { id: inventoryItemId },
        select: { type: true },
    });
    if (item && exports.KG_PER_UNIT_BY_TYPE[item.type]) {
        return exports.KG_PER_UNIT_BY_TYPE[item.type];
    }
    return LEGACY_BALE_KG;
}
async function applyMovement(tx, params) {
    const item = await tx.inventoryItem.findUnique({ where: { id: params.itemId } });
    if (!item)
        throw new Error(`Inventory item not found: ${params.itemId}`);
    const prevQty = Number(item.quantity);
    const newQty = prevQty + params.quantityDelta;
    if (newQty < -0.001) {
        throw new Error(`Insufficient stock for ${item.sku}. ` +
            `Available: ${prevQty.toFixed(3)}, required: ${Math.abs(params.quantityDelta).toFixed(3)}`);
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
    const totalFlourBulkIn = input.flourConsumption.reduce((s, r) => s + r.consumedKg, 0);
    const totalFlourIn = totalFlourBulkIn + input.flourSpillage;
    const allOutputLines = [];
    for (const flourOutput of input.flourPackedOutputs) {
        for (const line of flourOutput.outputLines) {
            allOutputLines.push({ ...line, flourInventoryItemId: flourOutput.flourInventoryItemId });
        }
    }
    const resolvedLines = await Promise.all(allOutputLines.map(async (line) => {
        const kgPerUnit = line.kgPerUnit > 0
            ? line.kgPerUnit
            : exports.KG_PER_UNIT_BY_TYPE[line.typeKey] ?? LEGACY_BALE_KG;
        return { ...line, kgPerUnit };
    }));
    const totalPackagedKg = resolvedLines.reduce((s, l) => s + l.unitsProduced * l.kgPerUnit, 0);
    const yieldPercent = totalFlourIn > 0 ? (totalPackagedKg / totalFlourIn) * 100 : 0;
    if (totalFlourIn <= 0) {
        throw new Error("Enter flour consumed or spillage for this packaging run.");
    }
    if (totalPackagedKg > totalFlourIn + 0.01) {
        throw new Error("Packaged output cannot exceed total flour input (incl. spillage).");
    }
    return server_1.prisma.$transaction(async (tx) => {
        const runNumber = `PKG-${Date.now().toString().slice(-8)}`;
        const outputCreateData = await Promise.all(input.flourPackedOutputs.flatMap((flourOutput) => flourOutput.outputLines.map(async (line) => {
            const resolved = resolvedLines.find((r) => r.typeKey === line.typeKey &&
                r.flourInventoryItemId === flourOutput.flourInventoryItemId);
            const kgPerUnit = resolved?.kgPerUnit ?? LEGACY_BALE_KG;
            const packagedKg = line.unitsProduced * kgPerUnit;
            return {
                finishedProductName: flourOutput.flourInventoryItemId,
                typeKey: line.typeKey,
                balesProduced: line.unitsProduced,
                packagedKg: packagedKg.toFixed(3),
                kgPerUnit: kgPerUnit.toFixed(3),
            };
        })));
        const inputCreateData = await Promise.all(input.flourConsumption
            .filter((c) => c.consumedKg > 0)
            .map(async (c) => {
            const item = await tx.inventoryItem.findUnique({
                where: { id: c.flourInventoryItemId },
                select: { sku: true },
            });
            return {
                inventoryItemId: c.flourInventoryItemId,
                finishedProductName: item?.sku ?? "Unknown",
                flourConsumedKg: c.consumedKg.toFixed(3),
            };
        }));
        const run = await tx.packagingRun.create({
            data: {
                runNumber,
                operatorName: input.operatorName,
                baleWeightKg: LEGACY_BALE_KG.toFixed(3),
                flourSpillage: input.flourSpillage.toFixed(3),
                totalPackagedKg: totalPackagedKg.toFixed(3),
                yieldPercent: yieldPercent.toFixed(2),
                notes: input.notes,
                finishedProductInputs: { create: inputCreateData },
                finishedProductOutputs: { create: outputCreateData },
            },
        });
        const alertItems = [];
        for (const row of input.flourConsumption) {
            if (row.consumedKg <= 0)
                continue;
            const r = await applyMovement(tx, {
                itemId: row.flourInventoryItemId,
                movementType: "ISSUE_TO_PACKAGING",
                quantityDelta: -row.consumedKg,
                packagingRunId: run.id,
                notes: `Packaging run ${runNumber} — bulk flour consumed`,
            });
            alertItems.push({ id: row.flourInventoryItemId, prev: r.prevQty });
        }
        if (input.flourSpillage > 0 && totalFlourBulkIn > 0) {
            for (const row of input.flourConsumption) {
                if (row.consumedKg <= 0)
                    continue;
                const allocatedSpill = (input.flourSpillage * row.consumedKg) / totalFlourBulkIn;
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
        for (const pm of input.packagingMaterials) {
            if (pm.received > 0) {
                const r = await applyMovement(tx, {
                    itemId: pm.inventoryItemId,
                    movementType: "RECEIPT",
                    quantityDelta: pm.received,
                    packagingRunId: run.id,
                    notes: `Packaging material received — ${runNumber}`,
                });
                alertItems.push({ id: pm.inventoryItemId, prev: r.prevQty });
            }
            if (pm.consumed > 0) {
                const r = await applyMovement(tx, {
                    itemId: pm.inventoryItemId,
                    movementType: "ISSUE_TO_PACKAGING",
                    quantityDelta: -pm.consumed,
                    packagingRunId: run.id,
                    notes: `Packaging material consumed — ${runNumber}`,
                });
                alertItems.push({ id: pm.inventoryItemId, prev: r.prevQty });
            }
            if (pm.destroyed > 0) {
                const r = await applyMovement(tx, {
                    itemId: pm.inventoryItemId,
                    movementType: "ADJUSTMENT",
                    quantityDelta: -pm.destroyed,
                    packagingRunId: run.id,
                    notes: `Packaging material destroyed — ${runNumber}`,
                });
                alertItems.push({ id: pm.inventoryItemId, prev: r.prevQty });
            }
        }
        // NOTE: With outputs stored by typeKey (DB change), we currently do not post inventory movements
        // for finished goods. If you want stock tracking per bale/bag type later, we can reintroduce it
        // by mapping typeKey -> InventoryItem id.
        // for (const line of resolvedLines) {
        //   if (line.unitsProduced <= 0) continue;
        // }
        for (const { id, prev } of alertItems) {
            await (0, inventory_alert_service_1.checkReorderAlert)(id, prev);
        }
        return tx.packagingRun.findUnique({
            where: { id: run.id },
            include: {
                finishedProductInputs: { include: { inventoryItem: true } },
                finishedProductOutputs: { include: { inventoryItem: true } },
            },
        });
    });
}
function formatPackagingRun(run) {
    return {
        ...run,
        baleWeightKg: Number(run.baleWeightKg),
        flourSpillage: Number(run.flourSpillage),
        packagingMaterialReceived: Number(run.packagingMaterialReceived),
        packagingMaterialConsumed: Number(run.packagingMaterialConsumed),
        packagingMaterialDestroyed: Number(run.packagingMaterialDestroyed),
        totalPackagedKg: Number(run.totalPackagedKg),
        yieldPercent: Number(run.yieldPercent),
    };
}
