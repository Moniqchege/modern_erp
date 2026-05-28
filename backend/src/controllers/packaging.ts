import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../server";
import {
  formatPackagingRun,
  processPackagingRun,
  KG_PER_UNIT_BY_TYPE,
} from "../services/packaging.service";

const cleanPackagingRunResponse = (run: any) => {
  const { grade1FlourConsumed, grade2FlourConsumed, ...rest } = run;
  return rest;
};

const OutputLineSchema = z.object({
  // Bale/bag format key (e.g. NYLON_BALER_1KG, BAG_10KG)
  typeKey: z.string().min(1).optional(),
  packedBaleInventoryItemId: z.string().min(1).optional(),
  unitsProduced: z.number().int().nonnegative(),
  // Optional override; if omitted, server resolves from KG_PER_UNIT_BY_TYPE
  kgPerUnit: z.number().nonnegative().optional().default(0),
}).refine((v) => Boolean(v.typeKey || v.packedBaleInventoryItemId), {
  message: "Either typeKey or packedBaleInventoryItemId is required",
});

const FlourPackedOutputSchema = z.object({
  flourInventoryItemId: z.string().min(1),
  outputLines: z.array(OutputLineSchema).default([]),
});

export const ProcessPackagingSchema = z.object({
  operatorName: z.string().min(1).max(120),

  flourConsumption: z
    .array(
      z.object({
        flourInventoryItemId: z.string().min(1),
        consumedKg: z.number().nonnegative(),
      })
    )
    .min(1, "At least one flour consumption row is required"),

  flourSpillage: z.number().nonnegative().default(0),

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
  flourPackedOutputs: z.array(FlourPackedOutputSchema).default([]),

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
      return res.status(404).json({ message: "Packaging run could not be created" });
    }

    res.status(201).json({
      message: "Packaging run recorded successfully",
      run: cleanPackagingRunResponse(formatPackagingRun(run)),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to process packaging run";
    res.status(400).json({ message });
  }
}

export async function listPackagingRuns(_req: Request, res: Response) {
  try {
    const runs = await prisma.packagingRun.findMany({
      include: {
        finishedProductInputs: { include: { inventoryItem: true } },
        finishedProductOutputs: { include: { inventoryItem: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.status(200).json({
      runs: runs.map((r) => cleanPackagingRunResponse(formatPackagingRun(r))),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch packaging runs", error: String(error) });
  }
}

export async function getKgPerUnitMap(_req: Request, res: Response) {
  res.json({ kgPerUnitByType: KG_PER_UNIT_BY_TYPE });
}

export async function getFinishedGoods(_req: Request, res: Response) {
  const items = await prisma.inventoryItem.findMany({
    where: {
      type: "FINISHED_GOOD",
      unit: "UNIT",
    },
    orderBy: { name: "asc" },
  });

  res.json({ items });
}