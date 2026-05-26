import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../server";
import { checkReorderAlert } from "../services/inventory-alert.service";

export const ProcessBatchSchema = z.object({
  rawMaizeConsumed: z.number().positive("Consumed maize must be greater than 0"),
  flourOutputs: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        quantityKg: z.number().nonnegative("Quantity must be >= 0"),
      })
    )
    .min(1, "At least one flour output is required"),
  maizeJamProduced: z.number().nonnegative("Maize Jam produced must be at least 0"),
});

export async function processBatch(req: Request, res: Response) {
  try {
    const parse = ProcessBatchSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        message: "Invalid batch parameters",
        errors: parse.error.flatten(),
      });
    }

    const { rawMaizeConsumed, flourOutputs, maizeJamProduced } = parse.data;
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find the raw material item (Maize)
      let rawMaize = await tx.inventoryItem.findFirst({
        where: {
          OR: [{ sku: "MZ-RAW-01" }, { type: "RAW_MATERIAL" }],
        },
      });

      if (!rawMaize) {
        throw new Error("Raw Material item not found. Please create a 'Raw Material' in the catalog first (e.g. Raw Maize).");
      }

      const currentRawQty = Number(rawMaize.quantity);
      if (currentRawQty < rawMaizeConsumed) {
        throw new Error(
          `Insufficient ${rawMaize.name} stock. Available: ${currentRawQty.toFixed(2)} ${rawMaize.unit}, Consumed: ${rawMaizeConsumed.toFixed(2)} ${rawMaize.unit}.`
        );
      }

      let maizeJam = await tx.inventoryItem.findFirst({
        where: {
          OR: [{ sku: "BY-JAM-03" }, { type: "BY_PRODUCT" }],
        },
      });

      if (maizeJamProduced > 0 && !maizeJam) {
        throw new Error("By-product item not found. Please create a 'By-Product' in the catalog first (e.g. Maize Jam).");
      }

      const jamItem = maizeJam;

      const updatedRawMaize = await tx.inventoryItem.update({
        where: { id: rawMaize.id },
        data: {
          quantity: (currentRawQty - rawMaizeConsumed).toFixed(3),
        },
      });

      let totalOutputsKg = 0;
      for (const output of flourOutputs) {
        const target = await tx.inventoryItem.findUnique({ where: { id: output.inventoryItemId } });
        if (!target) {
          throw new Error(`Inventory item not found: ${output.inventoryItemId}`);
        }
        if (target.type !== "FINISHED_GOOD") throw new Error(`Inventory item ${target.sku} is not FINISHED_GOOD`);

        await tx.inventoryItem.update({
          where: { id: target.id },
          data: {
            quantity: (Number(target.quantity) + output.quantityKg).toFixed(3),
          },
        });
        totalOutputsKg += output.quantityKg;
      }

      let updatedMaizeJam = null;
      if (jamItem) {
        updatedMaizeJam = await tx.inventoryItem.update({
          where: { id: jamItem.id },
          data: {
            quantity: (Number(jamItem.quantity) + maizeJamProduced).toFixed(3),
          },
        });
      }
      totalOutputsKg += maizeJamProduced;

      const wasteLoss = rawMaizeConsumed - totalOutputsKg;
      const efficiency = (totalOutputsKg / rawMaizeConsumed) * 100;

      const batchNumber = `M-BATCH-${Date.now().toString().slice(-8)}`;
     const batch = await tx.productionBatch.create({
  data: {
    batchNumber,
    rawMaizeConsumed: rawMaizeConsumed.toFixed(3),
    wasteLoss: wasteLoss.toFixed(3),
    efficiency: efficiency.toFixed(2),
    outputs: {
      create: [
        ...flourOutputs.map((o) => ({
          inventoryItemId: o.inventoryItemId,
          quantityKg: o.quantityKg.toFixed(3),
        })),

        ...(jamItem && maizeJamProduced > 0
          ? [
              {
                inventoryItemId: jamItem.id,
                quantityKg: maizeJamProduced.toFixed(3),
              },
            ]
          : []),
      ],
    },
  },
  include: {
    outputs: {
      include: { inventoryItem: true },
    },
  },
});

      return {
        batch,
        inventory: {
          rawMaize: updatedRawMaize,
          maizeJam: updatedMaizeJam || null,
        },
        prevRawQty: currentRawQty,
      };
    });

    await checkReorderAlert(result.inventory.rawMaize.id, result.prevRawQty);

    res.status(201).json({
      message: "Production batch processed successfully",
      batch: {
        ...result.batch,
        rawMaizeConsumed: Number(result.batch.rawMaizeConsumed),
        wasteLoss: Number(result.batch.wasteLoss),
        efficiency: Number(result.batch.efficiency),
      },
      inventory: result.inventory,
    });
  } catch (error: any) {
    res.status(400).json({
      message: error.message || "Failed to process production batch",
    });
  }
}
