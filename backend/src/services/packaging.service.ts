import { Prisma } from "@prisma/client";
import { prisma } from "../server";
import { checkReorderAlert } from "./inventory-alert.service";


export const KG_PER_UNIT_BY_TYPE: Record<string, number> = {
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

export type OutputLine = {
  typeKey?: string;
  packedBaleInventoryItemId?: string;
  unitsProduced: number;
  kgPerUnit: number;
};

export type FlourPackedOutput = {
  flourInventoryItemId: string;
  outputLines: OutputLine[];
};

export type ProcessPackagingInput = {
  operatorName: string;
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

  flourPackedOutputs: FlourPackedOutput[];
  notes?: string;
};

function deriveKgPerUnitFromTypeKey(typeKey: string | undefined): number {
  if (!typeKey) return LEGACY_BALE_KG;
  if (KG_PER_UNIT_BY_TYPE[typeKey] != null) return KG_PER_UNIT_BY_TYPE[typeKey];

  // Supports keys like NYLON_BALER_0.5KG, BAG_5KG, 5KG_BAG, PACK_2KG
  const normalized = typeKey.toUpperCase().replace(/_/g, " ");
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*KG/);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return LEGACY_BALE_KG;
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
  if (!item) throw new Error(`Inventory item not found: ${params.itemId}`);

  const prevQty = Number(item.quantity);
  const newQty = prevQty + params.quantityDelta;
  if (newQty < -0.001) {
    throw new Error(
      `Insufficient stock for ${item.sku}. ` +
      `Available: ${prevQty.toFixed(3)}, required: ${Math.abs(params.quantityDelta).toFixed(3)}`
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
  const totalFlourBulkIn = input.flourConsumption.reduce((s, r) => s + r.consumedKg, 0);
  const totalFlourIn = totalFlourBulkIn + input.flourSpillage;
  const allOutputLines: (OutputLine & { flourInventoryItemId: string; lineIndex: number })[] = [];
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

  // const resolvedLines = await Promise.all(
  //   allOutputLines.map(async (line) => {
  //     const item = line.packedBaleInventoryItemId
  //       ? await prisma.inventoryItem.findUnique({
  //           where: { id: line.packedBaleInventoryItemId },
  //           select: { id: true, type: true, name: true },
  //         })
  //       : null;

  //     const resolvedTypeKey = line.typeKey ?? item?.type ?? "UNKNOWN";
  //     const kgPerUnit =
  //       line.kgPerUnit > 0 ? line.kgPerUnit : deriveKgPerUnitFromTypeKey(resolvedTypeKey);

  //     return {
  //       ...line,
  //       typeKey: resolvedTypeKey,
  //       packedBaleInventoryItemId: line.packedBaleInventoryItemId ?? item?.id,
  //       kgPerUnit,
  //     };
  //   })
  // );

  const resolvedLines = allOutputLines.map((line) => ({
    ...line,
    typeKey: line.typeKey ?? "UNKNOWN",
    kgPerUnit: line.kgPerUnit > 0 ? line.kgPerUnit : deriveKgPerUnitFromTypeKey(line.typeKey),
  }));

  const totalPackagedKg = resolvedLines.reduce(
    (s, l) => s + l.unitsProduced * l.kgPerUnit,
    0
  );
  const yieldPercent = totalFlourIn > 0 ? (totalPackagedKg / totalFlourIn) * 100 : 0;

  if (totalFlourIn <= 0) {
    throw new Error("Enter flour consumed or spillage for this packaging run.");
  }
  if (totalPackagedKg > totalFlourIn + 0.01) {
    throw new Error("Packaged output cannot exceed total flour input (incl. spillage).");
  }

  // Pre-validate: compute total deduction per flour item (consumption + proportional spillage)
  // and check against current stock before entering the transaction.
  for (const row of input.flourConsumption) {
    if (row.consumedKg <= 0) continue;

    const spillageShare =
      totalFlourBulkIn > 0
        ? (input.flourSpillage * row.consumedKg) / totalFlourBulkIn
        : 0;
    const totalRequired = row.consumedKg + spillageShare;

    const item = await prisma.inventoryItem.findUnique({
      where: { id: row.flourInventoryItemId },
      select: { sku: true, quantity: true },
    });
    if (!item) throw new Error(`Flour inventory item not found: ${row.flourInventoryItemId}`);

    const available = Number(item.quantity);
    if (available < totalRequired - 0.001) {
      throw new Error(
        `Insufficient stock for ${item.sku}. ` +
        `Available: ${available.toFixed(3)} kg, required: ${totalRequired.toFixed(3)} kg ` +
        `(${row.consumedKg.toFixed(3)} consumed + ${spillageShare.toFixed(3)} spillage).`
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const runNumber = `PKG-${Date.now().toString().slice(-8)}`;
    const outputCreateData = await Promise.all(
      input.flourPackedOutputs.flatMap((flourOutput) =>
        flourOutput.outputLines.map(async (line, lineIndex) => {
          const resolved = resolvedLines.find(
            (r) =>
              r.flourInventoryItemId === flourOutput.flourInventoryItemId &&
              r.lineIndex === lineIndex
          );
          const kgPerUnit = resolved?.kgPerUnit ?? LEGACY_BALE_KG;
          const packagedKg = line.unitsProduced * kgPerUnit;

          return {
            finishedProductName: flourOutput.flourInventoryItemId,
            typeKey: resolved?.typeKey ?? line.typeKey ?? "UNKNOWN",
            // inventoryItemId: resolved?.packedBaleInventoryItemId ?? null,
            balesProduced: line.unitsProduced,
            packagedKg: packagedKg.toFixed(3),
            kgPerUnit: kgPerUnit.toFixed(3),
          };
        })
      )
    );

    const inputCreateData = await Promise.all(
      input.flourConsumption
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
        })
    );

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

    const alertItems: Array<{ id: string; prev: number }> = [];
    for (const row of input.flourConsumption) {
      if (row.consumedKg <= 0) continue;
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
        if (row.consumedKg <= 0) continue;
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

    // for (const line of resolvedLines) {
    //   if (!line.packedBaleInventoryItemId || line.unitsProduced <= 0) continue;
    //   await applyMovement(tx, {
    //     itemId: line.packedBaleInventoryItemId,
    //     movementType: "RECEIPT",
    //     quantityDelta: line.unitsProduced,
    //     packagingRunId: run.id,
    //     notes: `Packaging output ${line.typeKey} — ${runNumber}`,
    //   });
    // }


    for (const { id, prev } of alertItems) {
      await checkReorderAlert(id, prev);
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