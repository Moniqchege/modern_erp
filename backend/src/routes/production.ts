import { Router } from "express";
import { processBatch } from "../controllers/production";
import { prisma } from "../server";

export const productionRouter = Router();

// GET all production batches (traceability logs)
productionRouter.get("/", async (_req, res) => {
  try {
    const batches = await prisma.productionBatch.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Format Prisma Decimal fields for simpler JSON conversion
    const formatted = batches.map((b) => ({
      ...b,
      rawMaizeConsumed: Number(b.rawMaizeConsumed),
      grade1Produced: Number(b.grade1Produced),
      grade2Produced: Number(b.grade2Produced),
      maizeJamProduced: Number(b.maizeJamProduced),
      wasteLoss: Number(b.wasteLoss),
      efficiency: Number(b.efficiency),
    }));

    res.status(200).json({ batches: formatted });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch production batches", error: String(error) });
  }
});

// POST a new production run
productionRouter.post("/", processBatch);
