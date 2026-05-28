import { prisma } from "../../server";
import { ProcurementCategory, UnitOfMeasure } from "@prisma/client";

type SyncResult = {
    createdCount: number;
    updatedCount: number;
    activatedCount: number;
    skippedCount: number;
};

function safeToEnum<T extends string>(value: unknown, allowed: T[]): T | null {
    if (typeof value !== "string") return null;
    if ((allowed as string[]).includes(value)) return value as T;
    return null;
}

/**
 * Sync procurement item profiles from InventoryItem.
 *
 * Rules (deterministic, safe defaults):
 * - One ProcurementItemProfile per InventoryItem (via inventoryItemId unique).
 * - Always set isActive=true.
 * - sku/name: derived from InventoryItem.sku/name.
 * - category: best-effort from InventoryItem.type, otherwise RAW_MATERIAL.
 * - unit: derived from InventoryItem.unit, otherwise KG.
 * - thresholds/grade-specific fields are left null unless inventory has reorderLevel/reorderQuantity.
 */
export async function syncItemProfilesFromInventory(): Promise<SyncResult> {
    const inventoryItems = await prisma.inventoryItem.findMany({
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



    const allowedCategories: ProcurementCategory[] = [
        "RAW_MATERIAL",
        "PACKAGING",
        "MILLING_CONSUMABLE",
        "ENGINEERING_SPARE",
    ];

    const allowedUnits: UnitOfMeasure[] = ["KG", "BAG", "PIECES", "BALE", "UNIT", "MT", "GRAMS", "L"];

    let createdCount = 0;
    let updatedCount = 0;
    let activatedCount = 0;
    let skippedCount = 0;

    for (const inv of inventoryItems) {
        const category =
            mapInventoryItemTypeToProcurementCategory(inv.type) ?? "RAW_MATERIAL";

        const unit = safeToEnum<UnitOfMeasure>(inv.unit as unknown, allowedUnits) ?? "KG";


        // If we cannot create (e.g. sku already taken for a different inventoryItemId),
        // count as skipped; this keeps sync idempotent and avoids corrupting unique constraints.
        try {
            const existing = await prisma.procurementItemProfile.findUnique({
                where: { inventoryItemId: inv.id },
                include: { supplierLinks: false as never } as any,
            });

            if (!existing) {
                await prisma.procurementItemProfile.create({
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
            } else {
                // update + ensure activation
                const wasActive = existing.isActive;
                await prisma.procurementItemProfile.update({
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
                if (!wasActive) activatedCount++;
            }
        } catch (e) {
            skippedCount++;
        }
    }

    return { createdCount, updatedCount, activatedCount, skippedCount };
}

function mapInventoryItemTypeToProcurementCategory(type: string): ProcurementCategory | null {
    switch (type) {
        case "RAW_MATERIAL":
            return "RAW_MATERIAL";
        case "FINISHED_GOOD":
            // finished goods are treated as raw-material category for purchasing catalogs
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

