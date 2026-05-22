"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessPackagingSchema = void 0;
exports.processPackaging = processPackaging;
exports.listPackagingRuns = listPackagingRuns;
const zod_1 = require("zod");
const server_1 = require("../server");
const packaging_service_1 = require("../services/packaging.service");
exports.ProcessPackagingSchema = zod_1.z.object({
    operatorName: zod_1.z.string().min(1).max(120),
    // Dynamic flour types consumed (bulk, FINISHED_GOOD inventory items)
    flourConsumption: zod_1.z
        .array(zod_1.z.object({
        flourInventoryItemId: zod_1.z.string().min(1),
        consumedKg: zod_1.z.number().nonnegative(),
    }))
        .min(1, "At least one flour consumption row is required"),
    // Optional spillage total (kg). Will be distributed proportionally across flourConsumption.
    flourSpillage: zod_1.z.number().nonnegative().default(0),
    // Packaging materials (still uses the single PKG-MAT-01 inventory item in current backend)
    packagingMaterialReceived: zod_1.z.number().nonnegative().optional(),
    packagingMaterialConsumed: zod_1.z.number().nonnegative(),
    packagingMaterialDestroyed: zod_1.z.number().nonnegative().optional(),
    // Dynamic bale outputs per flour type
    flourPackedOutputs: zod_1.z
        .array(zod_1.z.object({
        flourInventoryItemId: zod_1.z.string().min(1),
        packedBaleInventoryItemId: zod_1.z.string().min(0).optional().default(""),
        balesProduced: zod_1.z.number().int().nonnegative(),
    }))
        .default([]),
    baleWeightKg: zod_1.z.number().positive().optional(),
    notes: zod_1.z.string().max(2000).optional(),
});
async function processPackaging(req, res) {
    try {
        const parse = exports.ProcessPackagingSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                message: "Invalid packaging parameters",
                errors: parse.error.flatten(),
            });
        }
        const run = await (0, packaging_service_1.processPackagingRun)(parse.data);
        if (!run) {
            return res.status(404).json({
                message: "Packaging run could not be created",
            });
        }
        res.status(201).json({
            message: "Packaging run recorded successfully",
            run: (0, packaging_service_1.formatPackagingRun)(run),
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to process packaging run";
        res.status(400).json({ message });
    }
}
async function listPackagingRuns(_req, res) {
    try {
        const runs = await server_1.prisma.packagingRun.findMany({
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        res.status(200).json({ runs: runs.map(packaging_service_1.formatPackagingRun) });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch packaging runs", error: String(error) });
    }
}
