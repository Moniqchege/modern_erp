"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncItemProfilesFromInventory = syncItemProfilesFromInventory;
const server_1 = require("../../server");
function safeToEnum(value, allowed) {
    if (typeof value !== "string")
        return null;
    if (allowed.includes(value))
        return value;
    return null;
}
async function syncItemProfilesFromInventory() {
    const inventoryItems = await server_1.prisma.inventoryItem.findMany({
        select: {
            id: true,
            sku: true,
            name: true,
            type: true,
            unit: true,
            reorderLevel: true,
            reorderQuantity: true,
        },
    });
    const allowedCategories = [
        "RAW_MATERIAL",
        "PACKAGING",
        "MILLING_CONSUMABLE",
        "ENGINEERING_SPARE",
    ];
    const allowedUnits = ["KG", "BAG", "PIECES", "BALE", "UNIT", "MT", "GRAMS", "L"];
    let createdCount = 0;
    let updatedCount = 0;
    let activatedCount = 0;
    let skippedCount = 0;
    for (const inv of inventoryItems) {
        if (String(inv.type) === "FINISHED_GOOD" || String(inv.type) === "BY_PRODUCT") {
            const existing = await server_1.prisma.procurementItemProfile.findUnique({
                where: { inventoryItemId: inv.id },
                select: { id: true },
            });
            if (existing?.id) {
                await server_1.prisma.procurementItemProfile.update({
                    where: { id: existing.id },
                    data: { isActive: false },
                });
            }
            skippedCount++;
            continue;
        }
        const category = mapInventoryItemTypeToProcurementCategory(inv.type) ?? "RAW_MATERIAL";
        const unit = safeToEnum(inv.unit, allowedUnits) ?? "KG";
        try {
            const existing = await server_1.prisma.procurementItemProfile.findUnique({
                where: { inventoryItemId: inv.id },
                include: { supplierLinks: false },
            });
            if (!existing) {
                await server_1.prisma.procurementItemProfile.create({
                    data: {
                        inventoryItemId: inv.id,
                        sku: inv.sku,
                        name: inv.name,
                        category,
                        unit,
                        lowStockThreshold: inv.reorderLevel ?? null,
                        reorderQuantity: inv.reorderQuantity ?? null,
                        isActive: true,
                    },
                });
                createdCount++;
            }
            else {
                const wasActive = existing.isActive;
                await server_1.prisma.procurementItemProfile.update({
                    where: { id: existing.id },
                    data: {
                        sku: inv.sku,
                        name: inv.name,
                        category,
                        unit,
                        lowStockThreshold: inv.reorderLevel ?? null,
                        reorderQuantity: inv.reorderQuantity ?? null,
                        isActive: true,
                    },
                });
                updatedCount++;
                if (!wasActive)
                    activatedCount++;
            }
        }
        catch (e) {
            skippedCount++;
        }
    }
    return { createdCount, updatedCount, activatedCount, skippedCount };
}
function mapInventoryItemTypeToProcurementCategory(type) {
    switch (type) {
        case "RAW_MATERIAL":
            return "RAW_MATERIAL";
        case "FINISHED_GOOD":
            return "RAW_MATERIAL";
        case "PACKETS_2KG":
        case "PACKETS_1KG":
        case "BAG_5KG":
        case "BAG_10KG":
        case "BAG_50KG":
        case "BAG_90KG":
        case "LAMINATED_BALER":
        case "KHAKI_BALER_2KG":
        case "KHAKI_BALER_1KG":
        case "NYLON_BALER_1KG":
        case "NYLON_BALER_2KG":
            return "PACKAGING";
        case "CLEAR_TAPES":
        case "GLUE":
            return "MILLING_CONSUMABLE";
        case "BAG_5KG":
        default:
            return "ENGINEERING_SPARE";
    }
}
