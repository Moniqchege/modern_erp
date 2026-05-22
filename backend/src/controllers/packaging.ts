import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../server";
import {
  formatPackagingRun,
  processPackagingRun,
} from "../services/packaging.service";

export const ProcessPackagingSchema = z.object({
  operatorName: z.string().min(1).max(120),
  grade1FlourConsumed: z.number().nonnegative(),
  grade2FlourConsumed: z.number().nonnegative(),
  flourSpillage: z.number().nonnegative().default(0),
  packagingMaterialReceived: z.number().nonnegative().optional(),
  packagingMaterialConsumed: z.number().nonnegative(),
  packagingMaterialDestroyed: z.number().nonnegative().optional(),
  balesProducedGrade1: z.number().int().nonnegative(),
  balesProducedGrade2: z.number().int().nonnegative(),
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
    res.status(201).json({
      message: "Packaging run recorded successfully",
      run: formatPackagingRun(run),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process packaging run";
    res.status(400).json({ message });
  }
}

export async function listPackagingRuns(_req: Request, res: Response) {
  try {
    const runs = await prisma.packagingRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.status(200).json({ runs: runs.map(formatPackagingRun) });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch packaging runs", error: String(error) });
  }
}
