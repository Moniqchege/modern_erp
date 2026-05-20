"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessBatchSchema = void 0;
exports.processBatch = processBatch;
const zod_1 = require("zod");
const server_1 = require("../server");
// Schema for production batch validation
exports.ProcessBatchSchema = zod_1.z.object({
    rawMaizeConsumed: zod_1.z.number().positive("Consumed maize must be greater than 0"),
    grade1Produced: zod_1.z.number().nonnegative("Grade 1 flour produced must be at least 0"),
    grade2Produced: zod_1.z.number().nonnegative("Grade 2 flour produced must be at least 0"),
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
        const { rawMaizeConsumed, grade1Produced, grade2Produced, maizeJamProduced } = parse.data;
        // We execute everything in a Prisma Transaction to guarantee ACID compliance
        const result = await server_1.prisma.$transaction(async (tx) => {
            // 1. Find or seed the raw Maize inventory item
            let rawMaize = await tx.inventoryItem.findUnique({
                where: { sku: "MZ-RAW-01" },
            });
            if (!rawMaize) {
                // Seed initial raw Maize so first run works immediately
                rawMaize = await tx.inventoryItem.create({
                    data: {
                        sku: "MZ-RAW-01",
                        name: "Raw Maize",
                        description: "Bulk unprocessed raw maize grain",
                        type: "RAW_MATERIAL",
                        unit: "KG",
                        quantity: 5000.0, // Seed with 5,000 KG
                        unitPrice: 0.45,
                    },
                });
            }
            // Check for sufficient inventory
            const currentRawQty = Number(rawMaize.quantity);
            if (currentRawQty < rawMaizeConsumed) {
                throw new Error(`Insufficient Raw Maize stock. Available: ${currentRawQty.toFixed(2)} KG, Consumed: ${rawMaizeConsumed.toFixed(2)} KG.`);
            }
            // Find or seed finished goods outputs
            let grade1 = await tx.inventoryItem.findUnique({ where: { sku: "FL-GR1-01" } });
            if (!grade1) {
                grade1 = await tx.inventoryItem.create({
                    data: {
                        sku: "FL-GR1-01",
                        name: "Grade 1 Maize Flour",
                        description: "Premium fine milled maize flour",
                        type: "FINISHED_GOOD",
                        unit: "KG",
                        quantity: 0.0,
                        unitPrice: 1.20,
                    },
                });
            }
            let grade2 = await tx.inventoryItem.findUnique({ where: { sku: "FL-GR2-02" } });
            if (!grade2) {
                grade2 = await tx.inventoryItem.create({
                    data: {
                        sku: "FL-GR2-02",
                        name: "Grade 2 Maize Flour",
                        description: "Standard sifted maize flour",
                        type: "FINISHED_GOOD",
                        unit: "KG",
                        quantity: 0.0,
                        unitPrice: 0.90,
                    },
                });
            }
            let maizeJam = await tx.inventoryItem.findUnique({ where: { sku: "BY-JAM-03" } });
            if (!maizeJam) {
                maizeJam = await tx.inventoryItem.create({
                    data: {
                        sku: "BY-JAM-03",
                        name: "Maize Jam",
                        description: "Milling by-product, animal feed grade",
                        type: "BY_PRODUCT",
                        unit: "KG",
                        quantity: 0.0,
                        unitPrice: 0.30,
                    },
                });
            }
            // 2. Deduct Raw Material Maize
            const updatedRawMaize = await tx.inventoryItem.update({
                where: { sku: "MZ-RAW-01" },
                data: {
                    quantity: (currentRawQty - rawMaizeConsumed).toFixed(3),
                },
            });
            // 3. Add produced Finished Goods & By-Products
            const updatedGrade1 = await tx.inventoryItem.update({
                where: { sku: "FL-GR1-01" },
                data: {
                    quantity: (Number(grade1.quantity) + grade1Produced).toFixed(3),
                },
            });
            const updatedGrade2 = await tx.inventoryItem.update({
                where: { sku: "FL-GR2-02" },
                data: {
                    quantity: (Number(grade2.quantity) + grade2Produced).toFixed(3),
                },
            });
            const updatedMaizeJam = await tx.inventoryItem.update({
                where: { sku: "BY-JAM-03" },
                data: {
                    quantity: (Number(maizeJam.quantity) + maizeJamProduced).toFixed(3),
                },
            });
            // 4. Calculate Efficiency & Waste
            const totalOutput = grade1Produced + grade2Produced + maizeJamProduced;
            const wasteLoss = rawMaizeConsumed - totalOutput;
            const efficiency = (totalOutput / rawMaizeConsumed) * 100;
            // 5. Log Production Batch
            const batchNumber = `M-BATCH-${Date.now().toString().slice(-8)}`;
            const batch = await tx.productionBatch.create({
                data: {
                    batchNumber,
                    rawMaizeConsumed: rawMaizeConsumed.toFixed(3),
                    grade1Produced: grade1Produced.toFixed(3),
                    grade2Produced: grade2Produced.toFixed(3),
                    maizeJamProduced: maizeJamProduced.toFixed(3),
                    wasteLoss: wasteLoss.toFixed(3),
                    efficiency: efficiency.toFixed(2),
                },
            });
            return {
                batch,
                inventory: {
                    rawMaize: updatedRawMaize,
                    grade1: updatedGrade1,
                    grade2: updatedGrade2,
                    maizeJam: updatedMaizeJam,
                },
            };
        });
        res.status(201).json({
            message: "Production batch processed successfully",
            batch: {
                ...result.batch,
                rawMaizeConsumed: Number(result.batch.rawMaizeConsumed),
                grade1Produced: Number(result.batch.grade1Produced),
                grade2Produced: Number(result.batch.grade2Produced),
                maizeJamProduced: Number(result.batch.maizeJamProduced),
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
