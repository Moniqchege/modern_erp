"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessBatchSchema = void 0;
exports.processBatch = processBatch;
const zod_1 = require("zod");
const server_1 = require("../server");
const inventory_alert_service_1 = require("../services/inventory-alert.service");
// Schema for production batch validation
exports.ProcessBatchSchema = zod_1.z.object({
    rawMaizeConsumed: zod_1.z.number().positive("Consumed maize must be greater than 0"),
    flourOutputs: zod_1.z
        .array(zod_1.z.object({
        inventoryItemId: zod_1.z.string().min(1),
        quantityKg: zod_1.z.number().nonnegative("Quantity must be >= 0"),
    }))
        .min(1, "At least one flour output is required"),
    maizeJamProduced: zod_1.z.number().nonnegative("Maize Jam produced must be at least 0"),
});
async function processBatch(req, res) {
    try {
        const parse = exports.ProcessBatchSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                message: "Invalid batch parameters",
                errors: parse.error.flatten(),
            });
        }
        const { rawMaizeConsumed, flourOutputs, maizeJamProduced } = parse.data;
        // We execute everything in a Prisma Transaction to guarantee ACID compliance
        const result = await server_1.prisma.$transaction(async (tx) => {
            // 1. Find the raw material item (Maize)
            let rawMaize = await tx.inventoryItem.findFirst({
                where: {
                    OR: [{ sku: "MZ-RAW-01" }, { type: "RAW_MATERIAL" }],
                },
            });
            if (!rawMaize) {
                throw new Error("Raw Material item not found. Please create a 'Raw Material' in the catalog first (e.g. Raw Maize).");
            }
            // Check for sufficient inventory
            const currentRawQty = Number(rawMaize.quantity);
            if (currentRawQty < rawMaizeConsumed) {
                throw new Error(`Insufficient ${rawMaize.name} stock. Available: ${currentRawQty.toFixed(2)} ${rawMaize.unit}, Consumed: ${rawMaizeConsumed.toFixed(2)} ${rawMaize.unit}.`);
            }
            // Find byproduct item (Jam/Hulls)
            let maizeJam = await tx.inventoryItem.findFirst({
                where: {
                    OR: [{ sku: "BY-JAM-03" }, { type: "BY_PRODUCT" }],
                },
            });
            if (maizeJamProduced > 0 && !maizeJam) {
                throw new Error("By-product item not found. Please create a 'By-Product' in the catalog first (e.g. Maize Jam).");
            }
            // 2. Deduct Raw Material Maize
            const updatedRawMaize = await tx.inventoryItem.update({
                where: { id: rawMaize.id },
                data: {
                    quantity: (currentRawQty - rawMaizeConsumed).toFixed(3),
                },
            });
            // 3. Add produced Finished Goods outputs (dynamic)
            let totalOutputsKg = 0;
            // Apply each finished-good output to its corresponding inventory item
            for (const output of flourOutputs) {
                const target = await tx.inventoryItem.findUnique({ where: { id: output.inventoryItemId } });
                if (!target) {
                    throw new Error(`Inventory item not found: ${output.inventoryItemId}`);
                }
                if (target.type !== "FINISHED_GOOD")
                    throw new Error(`Inventory item ${target.sku} is not FINISHED_GOOD`);
                await tx.inventoryItem.update({
                    where: { id: target.id },
                    data: {
                        quantity: (Number(target.quantity) + output.quantityKg).toFixed(3),
                    },
                });
                totalOutputsKg += output.quantityKg;
            }
            let updatedMaizeJam = null;
            if (maizeJam) {
                updatedMaizeJam = await tx.inventoryItem.update({
                    where: { id: maizeJam.id },
                    data: {
                        quantity: (Number(maizeJam.quantity) + maizeJamProduced).toFixed(3),
                    },
                });
            }
            totalOutputsKg += maizeJamProduced;
            // 4. Calculate Efficiency & Waste
            const wasteLoss = rawMaizeConsumed - totalOutputsKg;
            const efficiency = (totalOutputsKg / rawMaizeConsumed) * 100;
            // 5. Log Production Batch
            const batchNumber = `M-BATCH-${Date.now().toString().slice(-8)}`;
            const batch = await tx.productionBatch.create({
                data: {
                    batchNumber,
                    rawMaizeConsumed: rawMaizeConsumed.toFixed(3),
                    wasteLoss: wasteLoss.toFixed(3),
                    efficiency: efficiency.toFixed(2),
                    outputs: {
                        create: [
                            ...flourOutputs.map(o => ({
                                inventoryItemId: o.inventoryItemId,
                                quantityKg: o.quantityKg.toFixed(3)
                            })),
                            {
                                inventoryItemId: maizeJam.id,
                                quantityKg: maizeJamProduced.toFixed(3)
                            }
                        ]
                    }
                },
                include: { outputs: { include: { inventoryItem: true } } }
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
        await (0, inventory_alert_service_1.checkReorderAlert)(result.inventory.rawMaize.id, result.prevRawQty);
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
    }
    catch (error) {
        res.status(400).json({
            message: error.message || "Failed to process production batch",
        });
    }
}
