import { Prisma } from "@prisma/client";
import { prisma } from "../server";
import { checkReorderAlert } from "./inventory-alert.service";

const BALE_WEIGHT_KG = 24;
const PKG_MAT_SKU = "PKG-MAT-01";

export type ProcessPackagingInput = {
  operatorName: string;

  // Dynamic flour types consumed
  flourConsumption: Array<{
    flourInventoryItemId: string;
    consumedKg: number;
  }>;

  flourSpillage: number;

  packagingMaterials: Array<{
    inventoryItemId: string;
    received: number;
    consumed: number;
    destroyed: number;
  }>;

  // Dynamic bale outputs mapping
  flourPackedOutputs: Array<{
    flourInventoryItemId: string;
    packedBaleInventoryItemId: string;
    balesProduced: number;
  }>;

  baleWeightKg?: number;
  notes?: string;
};



async function ensureItem(
  tx: Prisma.TransactionClient,
  sku: string,
  data: {
    name: string;
    description: string;
    type: "RAW_MATERIAL" | "FINISHED_GOOD" | "BY_PRODUCT";
    unit: "KG" | "BAG";
  }
) {
  let item = await tx.inventoryItem.findUnique({ where: { sku } });
  if (!item) {
    item = await tx.inventoryItem.create({
      data: { sku, ...data, quantity: "0" },
    });
  }
  return item;
}

async function applyMovement(
  tx: Prisma.TransactionClient,
  params: {
    itemId: string;
    movementType: "RECEIPT" | "ISSUE_TO_PACKAGING" | "ADJUSTMENT";
    quantityDelta: number;
    packagingRunId: string;
    notes: string;
  }
) {
  const item = await tx.inventoryItem.findUnique({ where: { id: params.itemId } });
  if (!item) throw new Error("Inventory item not found");

  const prevQty = Number(item.quantity);
  const newQty = prevQty + params.quantityDelta;
  if (newQty < -0.001) {
    throw new Error(
      `Insufficient stock for ${item.sku}. Available: ${prevQty.toFixed(3)}, required: ${Math.abs(params.quantityDelta).toFixed(3)}`
    );
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

export async function processPackagingRun(input: ProcessPackagingInput) {
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

  return prisma.$transaction(async (tx) => {
    const runNumber = `PKG-${Date.now().toString().slice(-8)}`;
    const run = await tx.packagingRun.create({
      data: {
        runNumber,
        operatorName: input.operatorName,
        baleWeightKg: baleWeight.toFixed(3),
        flourSpillage: input.flourSpillage.toFixed(3),
        // NOTE: PackagingRun table still has legacy single-material totals.
        // For inventory movements we process per-material rows from `packagingMaterials`.
        totalPackagedKg: totalPackagedKg.toFixed(3),

        yieldPercent: yieldPercent.toFixed(2),
        notes: input.notes,
        finishedProductInputs: {
          create: await Promise.all(input.flourConsumption.map(async c => {
            const item = await tx.inventoryItem.findUnique({ where: { id: c.flourInventoryItemId } });
            return {
              inventoryItemId: c.flourInventoryItemId,          // ← add this
              finishedProductName: item?.sku || "Unknown",
              flourConsumedKg: c.consumedKg.toFixed(3),
            };
          }))
        },
        finishedProductOutputs: {
          create: await Promise.all(input.flourPackedOutputs.map(async o => {
            const item = await tx.inventoryItem.findUnique({ where: { id: o.packedBaleInventoryItemId } });
            return {
              inventoryItemId: o.packedBaleInventoryItemId,     // ← add this
              finishedProductName: item?.sku || "Unknown",
              balesProduced: o.balesProduced,
              packagedKg: (o.balesProduced * baleWeight).toFixed(3),
            };
          }))
        },
      },
    });




    const alertItems: Array<{ id: string; prev: number }> = [];
    const flourRows = input.flourConsumption.map((r) => ({ ...r }));
    const baseSum = totalFlourBulkIn;

    for (const row of flourRows) {
      if (row.consumedKg <= 0) continue;
      const rMove = await applyMovement(tx, {
        itemId: row.flourInventoryItemId,
        movementType: "ISSUE_TO_PACKAGING",
        quantityDelta: -row.consumedKg,
        packagingRunId: run.id,
        notes: `Packaging run ${runNumber} — bulk flour`,
      });
      alertItems.push({ id: row.flourInventoryItemId, prev: rMove.prevQty });

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

    // Per packaging material movements
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

    // Bale outputs
    for (const out of input.flourPackedOutputs) {
      if (out.balesProduced <= 0) continue;
      const baleItemId = out.packedBaleInventoryItemId || (await tx.inventoryItem.findFirst({
        where: { type: "FINISHED_GOOD" },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      }))?.id;

      if (!baleItemId) {
        throw new Error(
          "Bale inventory item not found. Please configure packedBaleInventoryItemId or seed a BALE item."
        );
      }

      await applyMovement(tx, {
        itemId: baleItemId,
        movementType: "RECEIPT",
        quantityDelta: out.balesProduced,
        packagingRunId: run.id,
        notes: `${out.balesProduced} bales @ ${baleWeight}kg — ${runNumber}`,
      });
    }

    for (const { id, prev } of alertItems) {
      await checkReorderAlert(id, prev);
    }

    return tx.packagingRun.findUnique({ where: { id: run.id } })!;
  });

}

export function formatPackagingRun(run: {

  id: string;
  runNumber: string;
  operatorName: string;
  baleWeightKg: unknown;
  flourSpillage: unknown;
  packagingMaterialReceived: unknown;
  packagingMaterialConsumed: unknown;
  packagingMaterialDestroyed: unknown;
  totalPackagedKg: unknown;
  yieldPercent: unknown;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  finishedProductInputs?: unknown[];
  finishedProductOutputs?: unknown[];
}) {
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
