"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productionRouter = void 0;
const express_1 = require("express");
const production_1 = require("../controllers/production");
const server_1 = require("../server");
exports.productionRouter = (0, express_1.Router)();
// GET all production batches (traceability logs)
exports.productionRouter.get("/", async (_req, res) => {
    try {
        const batches = await server_1.prisma.productionBatch.findMany({
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
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch production batches", error: String(error) });
    }
});
// POST a new production run
exports.productionRouter.post("/", production_1.processBatch);
