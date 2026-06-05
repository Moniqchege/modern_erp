"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockStoreBalance = lockStoreBalance;
exports.adjustStoreBalance = adjustStoreBalance;
exports.recordTransferMovement = recordTransferMovement;
const library_1 = require("@prisma/client/runtime/library");
function dec(n) {
    return new library_1.Decimal(n);
}
/** Row-lock balance row (MySQL FOR UPDATE) and return current quantities */
async function lockStoreBalance(tx, itemId, locationId) {
    const rows = await tx.$queryRaw `
    SELECT id, physicalQty, transitQty
    FROM StoreInventoryBalance
    WHERE itemId = ${itemId} AND locationId = ${locationId}
    FOR UPDATE
  `;
    if (rows.length > 0) {
        return {
            id: rows[0].id,
            physicalQty: Number(rows[0].physicalQty),
            transitQty: Number(rows[0].transitQty),
        };
    }
    const created = await tx.storeInventoryBalance.create({
        data: {
            itemId,
            locationId,
            physicalQty: "0.000",
            transitQty: "0.000",
        },
    });
    return {
        id: created.id,
        physicalQty: 0,
        transitQty: 0,
    };
}
async function adjustStoreBalance(tx, params) {
    const balance = await lockStoreBalance(tx, params.itemId, params.locationId);
    const nextPhysical = balance.physicalQty + (params.physicalDelta ?? 0);
    const nextTransit = balance.transitQty + (params.transitDelta ?? 0);
    if (nextPhysical < -0.0005) {
        throw new Error("Insufficient physical quantity at source store");
    }
    if (nextTransit < -0.0005) {
        throw new Error("Insufficient in-transit quantity");
    }
    await tx.storeInventoryBalance.update({
        where: { id: balance.id },
        data: {
            physicalQty: dec(nextPhysical).toFixed(3),
            transitQty: dec(nextTransit).toFixed(3),
        },
    });
    return { physicalQty: nextPhysical, transitQty: nextTransit };
}
async function recordTransferMovement(tx, params) {
    await tx.inventoryMovement.create({
        data: {
            itemId: params.itemId,
            movementType: params.movementType,
            quantityDelta: dec(params.quantityDelta).toFixed(3),
            unitPriceApplied: "0.00",
            locationId: params.locationId,
            stockTransferRequestId: params.stockTransferRequestId,
            notes: params.notes,
        },
    });
}
