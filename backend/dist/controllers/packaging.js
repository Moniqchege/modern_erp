"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessPackagingSchema = void 0;
exports.processPackaging = processPackaging;
exports.listPackagingRuns = listPackagingRuns;
exports.getKgPerUnitMap = getKgPerUnitMap;
exports.getFinishedGoods = getFinishedGoods;
const zod_1 = require("zod");
const server_1 = require("../server");
const packaging_service_1 = require("../services/packaging.service");
const cleanPackagingRunResponse = (run) => {
    const { grade1FlourConsumed, grade2FlourConsumed, ...rest } = run;
    return rest;
};
const OutputLineSchema = zod_1.z.object({
    // Bale/bag format key (e.g. NYLON_BALER_1KG, BAG_10KG)
    typeKey: zod_1.z.string().min(1).optional(),
    packedBaleInventoryItemId: zod_1.z.string().min(1).optional(),
    unitsProduced: zod_1.z.number().int().nonnegative(),
    // Optional override; if omitted, server resolves from KG_PER_UNIT_BY_TYPE
    kgPerUnit: zod_1.z.number().nonnegative().optional().default(0),
}).refine((v) => Boolean(v.typeKey || v.packedBaleInventoryItemId), {
    message: "Either typeKey or packedBaleInventoryItemId is required",
});
const FlourPackedOutputSchema = zod_1.z.object({
    flourInventoryItemId: zod_1.z.string().min(1),
    outputLines: zod_1.z.array(OutputLineSchema).default([]),
});
exports.ProcessPackagingSchema = zod_1.z.object({
    operatorName: zod_1.z.string().min(1).max(120),
    flourConsumption: zod_1.z
        .array(zod_1.z.object({
        flourInventoryItemId: zod_1.z.string().min(1),
        consumedKg: zod_1.z.number().nonnegative(),
        spillageKg: zod_1.z.number().nonnegative().default(0),
    }))
        .min(1, "At least one flour consumption row is required"),
    packagingMaterials: zod_1.z
        .array(zod_1.z.object({
        inventoryItemId: zod_1.z.string().min(1),
        received: zod_1.z.number().nonnegative(),
        consumed: zod_1.z.number().nonnegative(),
        destroyed: zod_1.z.number().nonnegative(),
    }))
        .optional()
        .default([]),
    flourPackedOutputs: zod_1.z.array(FlourPackedOutputSchema).default([]),
    electricityKwh: zod_1.z.number().nonnegative().optional(),
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
            return res.status(404).json({ message: "Packaging run could not be created" });
        }
        res.status(201).json({
            message: "Packaging run recorded successfully",
            run: cleanPackagingRunResponse((0, packaging_service_1.formatPackagingRun)(run)),
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
            include: {
                finishedProductInputs: { include: { inventoryItem: true } },
                finishedProductOutputs: { include: { inventoryItem: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        res.status(200).json({
            runs: runs.map((r) => cleanPackagingRunResponse((0, packaging_service_1.formatPackagingRun)(r))),
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch packaging runs", error: String(error) });
    }
}
async function getKgPerUnitMap(_req, res) {
    res.json({ kgPerUnitByType: packaging_service_1.KG_PER_UNIT_BY_TYPE });
}
async function getFinishedGoods(_req, res) {
    const items = await server_1.prisma.inventoryItem.findMany({
        where: {
            type: "FINISHED_GOOD",
            unit: "UNIT",
        },
        orderBy: { name: "asc" },
    });
    res.json({ items });
}
