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

