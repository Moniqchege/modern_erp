"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KG_PER_UNIT_BY_TYPE = void 0;
exports.processPackagingRun = processPackagingRun;
exports.formatPackagingRun = formatPackagingRun;
const server_1 = require("../server");
const inventory_alert_service_1 = require("./inventory-alert.service");
const store_inventory_service_1 = require("./store-inventory.service");
/** Store code into which finished bales are credited after each packaging run */
const BALE_OUTPUT_STORE_CODE = "PACKAGING_STORE";
exports.KG_PER_UNIT_BY_TYPE = {
    NYLON_BALER_0_5KG: 12,
    NYLON_BALER_1KG: 24,
    NYLON_BALER_2KG: 24,
    KHAKI_BALER_0_5KG: 12,
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
/** Store code from which packaging materials are deducted */
const PACKAGING_STORE_CODE = "PACKAGING_STORE";
function deriveKgPerUnitFromTypeKey(typeKey) {
    if (!typeKey)
        return LEGACY_BALE_KG;
    if (exports.KG_PER_UNIT_BY_TYPE[typeKey] != null)
        return exports.KG_PER_UNIT_BY_TYPE[typeKey];
    const normalized = typeKey.toUpperCase().replace(/_/g, " ");
    const match = normalized.match(/(\d+(?:\.\d+)?)\s*KG/);
    if (match) {
        const parsed = Number(match[1]);
        if (Number.isFinite(parsed) && parsed > 0)
            return parsed;
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
            locationId: params.locationId ?? null,
            notes: params.notes,
        },
    });
    return { prevQty, newQty };
}
async function processPackagingRun(input) {
    const totalFlourBulkIn = input.flourConsumption.reduce((s, r) => s + r.consumedKg, 0);
    const totalFlourSpillage = input.flourConsumption.reduce((s, r) => s + r.spillageKg, 0);
    const totalFlourIn = totalFlourBulkIn + totalFlourSpillage;
    const allOutputLines = [];
    for (const flourOutput of input.flourPackedOutputs) {
        for (let lineIndex = 0; lineIndex < flourOutput.outputLines.length; lineIndex += 1) {
            const line = flourOutput.outputLines[lineIndex];
            allOutputLines.push({
                ...line,
                flourInventoryItemId: flourOutput.flourInventoryItemId,
                lineIndex,
            });
        }
    }
    const resolvedLines = allOutputLines.map((line) => ({
        ...line,
        typeKey: line.typeKey ?? "UNKNOWN",
        kgPerUnit: line.kgPerUnit > 0 ? line.kgPerUnit : deriveKgPerUnitFromTypeKey(line.typeKey),
    }));
    const totalPackagedKg = resolvedLines.reduce((s, l) => s + l.unitsProduced * l.kgPerUnit, 0);
    const yieldPercent = totalFlourIn > 0 ? (totalPackagedKg / totalFlourIn) * 100 : 0;
    if (totalFlourIn <= 0) {
        throw new Error("Enter flour consumed or spillage for this packaging run.");
    }
    if (totalPackagedKg > totalFlourIn + 0.01) {
        throw new Error("Packaged output cannot exceed total flour input (incl. spillage).");
    }
    // Pre-validate flour stock
    for (const row of input.flourConsumption) {
        const totalRequired = row.consumedKg + row.spillageKg;
        if (totalRequired <= 0)
            continue;
        const item = await server_1.prisma.inventoryItem.findUnique({
            where: { id: row.flourInventoryItemId },
            select: { sku: true, quantity: true },
        });
        if (!item)
            throw new Error(`Flour inventory item not found: ${row.flourInventoryItemId}`);
        const available = Number(item.quantity);
        if (available < totalRequired - 0.001) {
            throw new Error(`Insufficient stock for ${item.sku}. ` +
                `Available: ${available.toFixed(3)} kg, required: ${totalRequired.toFixed(3)} kg ` +
                `(${row.consumedKg.toFixed(3)} consumed + ${row.spillageKg.toFixed(3)} spillage).`);
        }
    }
    // Pre-validate packaging materials against PACKAGING_STORE StoreInventoryBalance
    const packagingLocation = await server_1.prisma.inventoryLocation.findUnique({
        where: { code: PACKAGING_STORE_CODE },
        select: { id: true },
    });
    if (!packagingLocation) {
        throw new Error(`Packaging store (${PACKAGING_STORE_CODE}) not found. Please ensure stores are seeded.`);
    }
    for (const pm of input.packagingMaterials) {
        const totalDeduct = pm.consumed + pm.destroyed;
        if (totalDeduct <= 0)
            continue;
        const item = await server_1.prisma.inventoryItem.findUnique({
            where: { id: pm.inventoryItemId },
            select: { sku: true },
        });
        const balance = await server_1.prisma.storeInventoryBalance.findUnique({
            where: { itemId_locationId: { itemId: pm.inventoryItemId, locationId: packagingLocation.id } },
            select: { physicalQty: true },
        });
        const available = balance ? Number(balance.physicalQty) : 0;
        if (available < totalDeduct - 0.001) {
            throw new Error(`Insufficient stock in Packaging Store for ${item?.sku ?? pm.inventoryItemId}. ` +
                `Available: ${available.toFixed(3)}, required: ${totalDeduct.toFixed(3)}.`);
        }
    }
    return server_1.prisma.$transaction(async (tx) => {
        const runNumber = `PKG-${Date.now().toString().slice(-8)}`;
        const outputCreateData = await Promise.all(input.flourPackedOutputs.flatMap((flourOutput) => flourOutput.outputLines.map(async (line, lineIndex) => {
            const resolved = resolvedLines.find((r) => r.flourInventoryItemId === flourOutput.flourInventoryItemId &&
                r.lineIndex === lineIndex);
            const kgPerUnit = resolved?.kgPerUnit ?? LEGACY_BALE_KG;
            const packagedKg = line.unitsProduced * kgPerUnit;
            return {
                finishedProductName: flourOutput.flourInventoryItemId,
                typeKey: resolved?.typeKey ?? line.typeKey ?? "UNKNOWN",
                inventoryItemId: line.packedBaleInventoryItemId ?? null, // ← ADD THIS
                balesProduced: line.unitsProduced,
                packagedKg: packagedKg.toFixed(3),
                kgPerUnit: kgPerUnit.toFixed(3),
            };
        })));
        const inputCreateData = await Promise.all(input.flourConsumption
            .filter((c) => c.consumedKg > 0 || c.spillageKg > 0)
            .map(async (c) => {
            const item = await tx.inventoryItem.findUnique({
                where: { id: c.flourInventoryItemId },
                select: { sku: true },
            });
            return {
                inventoryItemId: c.flourInventoryItemId,
                finishedProductName: item?.sku ?? "Unknown",
                flourConsumedKg: c.consumedKg.toFixed(3),
                flourSpillageKg: c.spillageKg.toFixed(3),
            };
        }));
        const run = await tx.packagingRun.create({
            data: {
                runNumber,
                operatorName: input.operatorName,
                baleWeightKg: LEGACY_BALE_KG.toFixed(3),
                // Store combined spillage on run header for backwards compat
                flourSpillage: totalFlourSpillage.toFixed(3),
                totalPackagedKg: totalPackagedKg.toFixed(3),
                yieldPercent: yieldPercent.toFixed(2),
                electricityKwh: input.electricityKwh != null ? input.electricityKwh.toFixed(3) : null,
                notes: input.notes,
                finishedProductInputs: { create: inputCreateData },
                finishedProductOutputs: { create: outputCreateData },
            }, // eslint-disable-line @typescript-eslint/no-explicit-any
        });
        const alertItems = [];
        // Deduct flour (consumed + per-flour spillage)
        for (const row of input.flourConsumption) {
            if (row.consumedKg > 0) {
                const r = await applyMovement(tx, {
                    itemId: row.flourInventoryItemId,
                    movementType: "ISSUE_TO_PACKAGING",
                    quantityDelta: -row.consumedKg,
                    packagingRunId: run.id,
                    notes: `Packaging run ${runNumber} — bulk flour consumed`,
                });
                alertItems.push({ id: row.flourInventoryItemId, prev: r.prevQty });
            }
            if (row.spillageKg > 0.001) {
                await applyMovement(tx, {
                    itemId: row.flourInventoryItemId,
                    movementType: "ADJUSTMENT",
                    quantityDelta: -row.spillageKg,
                    packagingRunId: run.id,
                    notes: `Packaging flour spillage ${runNumber}`,
                });
            }
        }
        // Packaging materials — deduct from PACKAGING_STORE StoreInventoryBalance
        for (const pm of input.packagingMaterials) {
            if (pm.received > 0) {
                // Receipt into packaging store balance
                await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                    itemId: pm.inventoryItemId,
                    locationId: packagingLocation.id,
                    physicalDelta: pm.received,
                });
                const r = await applyMovement(tx, {
                    itemId: pm.inventoryItemId,
                    movementType: "RECEIPT",
                    quantityDelta: pm.received,
                    packagingRunId: run.id,
                    locationId: packagingLocation.id,
                    notes: `Packaging material received — ${runNumber}`,
                });
                alertItems.push({ id: pm.inventoryItemId, prev: r.prevQty });
            }
            if (pm.consumed > 0) {
                // Deduct from packaging store balance
                await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                    itemId: pm.inventoryItemId,
                    locationId: packagingLocation.id,
                    physicalDelta: -pm.consumed,
                });
                const r = await applyMovement(tx, {
                    itemId: pm.inventoryItemId,
                    movementType: "ISSUE_TO_PACKAGING",
                    quantityDelta: -pm.consumed,
                    packagingRunId: run.id,
                    locationId: packagingLocation.id,
                    notes: `Packaging material consumed — ${runNumber}`,
                });
                alertItems.push({ id: pm.inventoryItemId, prev: r.prevQty });
            }
            if (pm.destroyed > 0) {
                await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                    itemId: pm.inventoryItemId,
                    locationId: packagingLocation.id,
                    physicalDelta: -pm.destroyed,
                });
                const r = await applyMovement(tx, {
                    itemId: pm.inventoryItemId,
                    movementType: "ADJUSTMENT",
                    quantityDelta: -pm.destroyed,
                    packagingRunId: run.id,
                    locationId: packagingLocation.id,
                    notes: `Packaging material destroyed — ${runNumber}`,
                });
                alertItems.push({ id: pm.inventoryItemId, prev: r.prevQty });
            }
        }
        // Credit packed bale outputs into Packaging Store balance
        const baleOutputLocation = await tx.inventoryLocation.findUnique({
            where: { code: BALE_OUTPUT_STORE_CODE },
            select: { id: true },
        });
        if (!baleOutputLocation) {
            throw new Error(`Bale output store (${BALE_OUTPUT_STORE_CODE}) not found.`);
        }
        for (const line of resolvedLines) {
            const balesProduced = line.unitsProduced;
            if (balesProduced <= 0)
                continue;
            // Resolution priority:
            //  1. packedBaleInventoryItemId explicitly provided on the line — always preferred.
            //  2. typeKey matches exactly ONE InventoryItem.type — unambiguous auto-resolve.
            //  3. Multiple candidates — abort asking for explicit selection.
            //  4. No candidate — abort with a helpful message.
            let baleItemId = line.packedBaleInventoryItemId ?? null;
            if (!baleItemId && line.typeKey && line.typeKey !== "UNKNOWN") {
                const candidates = await tx.inventoryItem.findMany({
                    where: { type: line.typeKey },
                    select: { id: true, name: true },
                });
                if (candidates.length === 1) {
                    baleItemId = candidates[0].id;
                }
                else if (candidates.length > 1) {
                    throw new Error(`Ambiguous output line: typeKey "${line.typeKey}" matches ${candidates.length} inventory items ` +
                        `(${candidates.map((c) => c.name).join(", ")}). ` +
                        `Select the specific brand using the "Brand / Item" selector on the output line.`);
                }
            }
            if (!baleItemId) {
                throw new Error(`Cannot credit Packaging Store: no InventoryItem found for typeKey "${line.typeKey}". ` +
                    `Add a packaging item with this type or select the item explicitly on the output line.`);
            }
            // Link item back onto the output row for traceability (if not already set)
            await tx.packagingRunFinishedProductOutput.updateMany({
                where: {
                    packagingRunId: run.id,
                    typeKey: line.typeKey ?? "UNKNOWN",
                    finishedProductName: line.flourInventoryItemId,
                    inventoryItemId: null,
                },
                data: { inventoryItemId: baleItemId },
            });
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                itemId: baleItemId,
                locationId: baleOutputLocation.id,
                physicalDelta: balesProduced,
            });
            await applyMovement(tx, {
                itemId: baleItemId,
                movementType: "RECEIPT",
                quantityDelta: balesProduced,
                packagingRunId: run.id,
                locationId: baleOutputLocation.id,
                notes: `Packaging run ${runNumber} — ${balesProduced} × ${line.typeKey ?? "bale"} produced`,
            });
        }
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
        electricityKwh: run.electricityKwh != null ? Number(run.electricityKwh) : null,
    };
}
