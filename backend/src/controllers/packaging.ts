import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../server";
import { formatPackagingRun, processPackagingRun } from "../services/packaging.service";

const cleanPackagingRunResponse = (run: any) => {
  const { grade1FlourConsumed, grade2FlourConsumed, ...rest } = run;
  return rest;
};


export const ProcessPackagingSchema = z.object({
  operatorName: z.string().min(1).max(120),

  // Dynamic flour types consumed (bulk, FINISHED_GOOD inventory items)
  flourConsumption: z
    .array(
      z.object({
        flourInventoryItemId: z.string().min(1),
        consumedKg: z.number().nonnegative(),
      })
    )
    .min(1, "At least one flour consumption row is required"),

  // Optional spillage total (kg). Will be distributed proportionally across flourConsumption.
  flourSpillage: z.number().nonnegative().default(0),

  // Packaging materials (all inventory items except RAW_MATERIAL / FINISHED_GOOD / BY_PRODUCT)
  packagingMaterials: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        received: z.number().nonnegative(),
        consumed: z.number().nonnegative(),
        destroyed: z.number().nonnegative(),
      })
    )
    .optional()
    .default([]),


  // Dynamic bale outputs per flour type
  flourPackedOutputs: z
    .array(
      z.object({
        flourInventoryItemId: z.string().min(1),
        packedBaleInventoryItemId: z.string().min(0).optional().default(""),
        balesProduced: z.number().int().nonnegative(),
      })
    )
    .default([]),

  baleWeightKg: z.number().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export async function processPackaging(req: Request, res: Response) {
  try {
    const parse = ProcessPackagingSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        message: "Invalid packaging parameters",
        errors: parse.error.flatten(),
      });
    }

    const run = await processPackagingRun(parse.data);
    if (!run) {
      return res.status(404).json({
        message: "Packaging run could not be created",
      });
    }
    res.status(201).json({
      message: "Packaging run recorded successfully",
      run: cleanPackagingRunResponse(formatPackagingRun(run)),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process packaging run";
    res.status(400).json({ message });
  }
}

export async function listPackagingRuns(_req: Request, res: Response) {
  try {
    const runs = await prisma.packagingRun.findMany({
      include: {
        finishedProductInputs: {
          include: {
            inventoryItem: true
          }
        },
        finishedProductOutputs: {
          include: {
            inventoryItem: true
          }
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.status(200).json({ runs: runs.map(r => cleanPackagingRunResponse(formatPackagingRun(r))) });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch packaging runs", error: String(error) });
  }
}
