import { PrismaClient, BatchStatus, QCStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

export interface RawMaizeReceiptData {
    supplierId: string;
    farmOrigin?: string;
    harvestDate?: Date;
    truckRegistration: string;
    driverName?: string;
    driverPhone?: string;
    grossWeight: number;
    tareWeight: number;
    siloId?: string;
    expiryDate?: Date;
}

export interface QualityTestData {
    rawMaizeBatchId: string;
    moistureContent: number;
    aflatoxinLevel: number;
    foreignMatter: number;
    brokenKernels?: number;
    testedBy: string;
    remarks?: string;
}

export interface ProductionRunData {
    millingLine: string;
    operatorName: string;
    rawMaizeBatchInputs: Array<{
        batchId: string;
        quantityUsed: number;
    }>;
    startTime: Date;
    endTime?: Date;
}

export interface MillingYieldData {
    grade1Flour: number;
    grade2Flour: number;
    maizeBran: number;
    maizeGerm: number;
}

export interface ForwardTraceResult {
    rawMaizeBatch: {
        batchNumber: string;
        supplier: string;
        farmOrigin: string | null;
        receivedAt: Date;
        netWeight: number;
    };
    qualityTests: Array<{
        testDate: Date;
        status: string;
        moistureContent: number;
        aflatoxinLevel: number;
        foreignMatter: number;
    }>;
    productionRuns: Array<{
        runNumber: string;
        millingLine: string;
        startTime: Date;
        quantityUsed: number;
        finishedGoods: Array<{
            batchNumber: string;
            productType: string;
            quantity: number;
            pallets: Array<{
                palletBarcode: string;
                dispatches: Array<{
                    dispatchNumber: string;
                    customer: string;
                    deliveredAt: Date | null;
                }>;
            }>;
        }>;
    }>;
}

export interface BackwardTraceResult {
    bag: {
        bagBarcode: string;
        weight: number;
        createdAt: Date;
    };
    bale: {
        baleBarcode: string;
        totalWeight: number;
    };
    pallet: {
        palletBarcode: string;
        totalWeight: number;
    };
    finishedGoodsBatch: {
        batchNumber: string;
        productType: string;
        packagingDate: Date;
        expiryDate: Date;
    };
    productionRun: {
        runNumber: string;
        millingLine: string;
        operatorName: string;
        startTime: Date;
        endTime: Date | null;
        yieldEfficiency: number;
    };
    rawMaizeBatches: Array<{
        batchNumber: string;
        supplier: {
            name: string;
            farmLocation: string | null;
        };
        truckRegistration: string;
        netWeight: number;
        receivedAt: Date;
        qualityTests: Array<{
            status: string;
            moistureContent: number;
            aflatoxinLevel: number;
            foreignMatter: number;
            testDate: Date;
            testedBy: string;
        }>;
    }>;
}

export interface FIFOPickingResult {
    batchId: string;
    batchNumber: string;
    availableQuantity: number;
    receivedAt?: Date;
    expiryDate?: Date;
    ageInDays: number;
    priority: number; // 1 = highest priority
}

// ============================================
// CORE SERVICE FUNCTIONS
// ============================================

/**
 * RECEIVE RAW MAIZE
 * 
 * Records inbound truck delivery with weighbridge data.
 * Automatically sets batch to QUARANTINED status pending QC approval.
 * 
 * @param data - Raw maize receipt information
 * @returns Created raw maize batch with QUARANTINED status
 */
export async function receiveRawMaize(data: RawMaizeReceiptData) {
    // Calculate net weight
    const netWeight = data.grossWeight - data.tareWeight;

    if (netWeight <= 0) {
        throw new Error("Invalid weight calculation: Net weight must be positive");
    }

    // Generate unique batch number
    const batchNumber = await generateBatchNumber("RMB");

    // Create raw maize batch in QUARANTINED state
    const batch = await prisma.rawMaizeBatch.create({
        data: {
            batchNumber,
            supplierId: data.supplierId,
            farmOrigin: data.farmOrigin,
            harvestDate: data.harvestDate,
            truckRegistration: data.truckRegistration,
            driverName: data.driverName,
            driverPhone: data.driverPhone,
            grossWeight: new Decimal(data.grossWeight),
            tareWeight: new Decimal(data.tareWeight),
            netWeight: new Decimal(netWeight),
            currentQuantity: new Decimal(netWeight), // Initially full
            status: BatchStatus.QUARANTINED, // CRITICAL: Prevent use until QC approved
            siloId: data.siloId,
            expiryDate: data.expiryDate,
        },
        include: {
            supplier: true,
            silo: true,
        },
    });

    // Update silo level if assigned
    if (data.siloId) {
        await prisma.silo.update({
            where: { id: data.siloId },
            data: {
                currentLevel: {
                    increment: netWeight,
                },
            },
        });
    }

    return batch;
}

/**
 * PERFORM QUALITY CONTROL TEST
 * 
 * Records QC test results and updates batch status based on compliance thresholds.
 * 
 * Compliance Thresholds:
 * - Moisture: < 14% (Approved), >= 14% (Rejected)
 * - Aflatoxin: < 10 ppb (Approved), >= 10 ppb (Rejected)
 * - Foreign Matter: < 2% (Approved), >= 2% (Rejected)
 * 
 * @param data - Quality test results
 * @returns QC log with status determination
 */
export async function performQualityControl(data: QualityTestData) {
    // Determine QC status based on thresholds
    let status: QCStatus = QCStatus.APPROVED;

    if (
        data.moistureContent >= 14 ||
        data.aflatoxinLevel >= 10 ||
        data.foreignMatter >= 2
    ) {
        status = QCStatus.REJECTED;
    }

    // Create QC log
    const qcLog = await prisma.qualityControlLog.create({
        data: {
            rawMaizeBatchId: data.rawMaizeBatchId,
            moistureContent: new Decimal(data.moistureContent),
            aflatoxinLevel: new Decimal(data.aflatoxinLevel),
            foreignMatter: new Decimal(data.foreignMatter),
            brokenKernels: data.brokenKernels
                ? new Decimal(data.brokenKernels)
                : undefined,
            status,
            testedBy: data.testedBy,
            remarks: data.remarks,
        },
    });

    // Update raw maize batch status
    const batchStatus =
        status === QCStatus.APPROVED ? BatchStatus.APPROVED : BatchStatus.REJECTED;

    await prisma.rawMaizeBatch.update({
        where: { id: data.rawMaizeBatchId },
        data: {
            status: batchStatus,
            approvedAt: status === QCStatus.APPROVED ? new Date() : undefined,
        },
    });

    return qcLog;
}

/**
 * CALCULATE MILLING YIELD
 * 
 * Mass balance function to validate production efficiency.
 * Calculates variance between input and output, flags alerts if > 3%.
 * 
 * Formula:
 * Input = Raw Maize Weight
 * Output = Grade 1 Flour + Grade 2 Flour + Bran + Germ + Moisture Loss
 * Variance = Input - Output
 * Variance % = (Variance / Input) * 100
 * 
 * @param rawMaizeWeight - Total raw maize input (KG)
 * @param yieldData - Production output weights (KG)
 * @returns Yield calculation with variance analysis
 */
export function calculateMillingYield(
    rawMaizeWeight: number,
    yieldData: MillingYieldData
) {
    const totalFlourOutput = yieldData.grade1Flour + yieldData.grade2Flour;
    const totalByProductOutput = yieldData.maizeBran + yieldData.maizeGerm;

    // Expected moisture loss: ~12-14% of raw weight
    const expectedMoistureLoss = rawMaizeWeight * 0.13;

    // Total output including moisture loss
    const totalOutput =
        totalFlourOutput + totalByProductOutput + expectedMoistureLoss;

    // Calculate variance
    const variance = rawMaizeWeight - totalOutput;
    const variancePercent = (Math.abs(variance) / rawMaizeWeight) * 100;

    // Yield efficiency (flour output / raw input)
    const yieldEfficiency = (totalFlourOutput / rawMaizeWeight) * 100;

    // Alert if variance exceeds 3%
    const varianceAlert = variancePercent > 3;

    return {
        totalRawInput: rawMaizeWeight,
        totalFlourOutput,
        totalByProductOutput,
        moistureLoss: expectedMoistureLoss,
        variance,
        variancePercent: parseFloat(variancePercent.toFixed(2)),
        yieldEfficiency: parseFloat(yieldEfficiency.toFixed(2)),
        varianceAlert,
        message: varianceAlert
            ? `⚠️ ALERT: Variance of ${variancePercent.toFixed(2)}% exceeds 3% threshold`
            : `✓ Variance within acceptable range (${variancePercent.toFixed(2)}%)`,
    };
}

/**
 * CREATE PRODUCTION RUN
 * 
 * Records a milling production run with full traceability.
 * Links raw maize inputs to finished goods outputs.
 * Validates mass balance and updates inventory quantities.
 * 
 * @param runData - Production run details
 * @param yieldData - Milling output weights
 * @returns Created production run with traceability links
 */
export async function createProductionRun(
    runData: ProductionRunData,
    yieldData: MillingYieldData
) {
    // Validate all raw maize batches are APPROVED
    const batchIds = runData.rawMaizeBatchInputs.map((input) => input.batchId);
    const batches = await prisma.rawMaizeBatch.findMany({
        where: { id: { in: batchIds } },
    });

    const quarantinedBatches = batches.filter(
        (b) => b.status === BatchStatus.QUARANTINED
    );
    if (quarantinedBatches.length > 0) {
        throw new Error(
            `Cannot use QUARANTINED batches: ${quarantinedBatches.map((b) => b.batchNumber).join(", ")}`
        );
    }

    // Calculate total raw input
    const totalRawInput = runData.rawMaizeBatchInputs.reduce(
        (sum, input) => sum + input.quantityUsed,
        0
    );

    // Calculate yield metrics
    const yieldMetrics = calculateMillingYield(totalRawInput, yieldData);

    // Generate production run number
    const runNumber = await generateBatchNumber("PR");

    // Create production run
    const productionRun = await prisma.productionRun.create({
        data: {
            runNumber,
            millingLine: runData.millingLine,
            operatorName: runData.operatorName,
            totalRawInput: new Decimal(yieldMetrics.totalRawInput),
            totalFlourOutput: new Decimal(yieldMetrics.totalFlourOutput),
            totalByProductOutput: new Decimal(yieldMetrics.totalByProductOutput),
            moistureLoss: new Decimal(yieldMetrics.moistureLoss),
            variance: new Decimal(yieldMetrics.variance),
            variancePercent: new Decimal(yieldMetrics.variancePercent),
            yieldEfficiency: new Decimal(yieldMetrics.yieldEfficiency),
            varianceAlert: yieldMetrics.varianceAlert,
            startTime: runData.startTime,
            endTime: runData.endTime,
        },
    });

    // Create production run inputs (traceability links)
    for (const input of runData.rawMaizeBatchInputs) {
        await prisma.productionRunInput.create({
            data: {
                productionRunId: productionRun.id,
                rawMaizeBatchId: input.batchId,
                quantityUsed: new Decimal(input.quantityUsed),
            },
        });

        // Update raw maize batch quantity
        await prisma.rawMaizeBatch.update({
            where: { id: input.batchId },
            data: {
                currentQuantity: {
                    decrement: input.quantityUsed,
                },
                status: BatchStatus.IN_PRODUCTION,
            },
        });
    }

    // Create finished goods batches
    if (yieldData.grade1Flour > 0) {
        await createFinishedGoodsBatch(
            productionRun.id,
            "GRADE_1_FLOUR",
            yieldData.grade1Flour
        );
    }

    if (yieldData.grade2Flour > 0) {
        await createFinishedGoodsBatch(
            productionRun.id,
            "GRADE_2_FLOUR",
            yieldData.grade2Flour
        );
    }

    // Create by-product batches
    if (yieldData.maizeBran > 0) {
        await createByProductBatch(
            productionRun.id,
            "MAIZE_BRAN",
            yieldData.maizeBran
        );
    }

    if (yieldData.maizeGerm > 0) {
        await createByProductBatch(
            productionRun.id,
            "MAIZE_GERM",
            yieldData.maizeGerm
        );
    }

    return {
        productionRun,
        yieldMetrics,
    };
}

/**
 * ENFORCE FIFO PICKING
 * 
 * Suggests which raw maize batch or finished goods to pick next.
 * Prioritizes oldest expiration date or reception date (First In, First Out).
 * 
 * @param itemType - "RAW_MAIZE" or "FINISHED_GOODS"
 * @param requiredQuantity - Amount needed (optional, for filtering)
 * @returns Sorted list of batches/pallets by FIFO priority
 */
export async function enforceFIFOPicking(
    itemType: "RAW_MAIZE" | "FINISHED_GOODS",
    requiredQuantity?: number
): Promise<FIFOPickingResult[]> {
    const now = new Date();

    if (itemType === "RAW_MAIZE") {
        // Get all APPROVED raw maize batches with available quantity
        const batches = await prisma.rawMaizeBatch.findMany({
            where: {
                status: BatchStatus.APPROVED,
                currentQuantity: { gt: 0 },
            },
            include: {
                supplier: true,
            },
            orderBy: [
                { expiryDate: "asc" }, // Oldest expiry first
                { receivedAt: "asc" }, // Then oldest received
            ],
        });

        return batches.map((batch, index) => {
            const ageInDays = Math.floor(
                (now.getTime() - batch.receivedAt.getTime()) / (1000 * 60 * 60 * 24)
            );

            return {
                batchId: batch.id,
                batchNumber: batch.batchNumber,
                availableQuantity: parseFloat(batch.currentQuantity.toString()),
                receivedAt: batch.receivedAt,
                expiryDate: batch.expiryDate || undefined,
                ageInDays,
                priority: index + 1,
            };
        });
    } else {
        // Get all finished goods batches with available quantity
        const batches = await prisma.finishedGoodsBatch.findMany({
            where: {
                currentQuantity: { gt: 0 },
            },
            orderBy: [
                { expiryDate: "asc" }, // Oldest expiry first
                { packagingDate: "asc" }, // Then oldest packaged
            ],
        });

        return batches.map((batch, index) => {
            const ageInDays = Math.floor(
                (now.getTime() - batch.packagingDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            return {
                batchId: batch.id,
                batchNumber: batch.batchNumber,
                availableQuantity: parseFloat(batch.currentQuantity.toString()),
                receivedAt: batch.packagingDate,
                expiryDate: batch.expiryDate,
                ageInDays,
                priority: index + 1,
            };
        });
    }
}

/**
 * FORWARD TRACEABILITY
 * 
 * Traces a raw maize batch forward through the supply chain.
 * Returns complete tree: Raw Batch → Production Runs → Finished Goods → Dispatches
 * 
 * @param rawMaizeBatchId - Raw maize batch ID to trace
 * @returns Complete forward traceability report
 */
export async function traceForward(
    rawMaizeBatchId: string
): Promise<ForwardTraceResult> {
    // Get raw maize batch with supplier
    const rawBatch = await prisma.rawMaizeBatch.findUnique({
        where: { id: rawMaizeBatchId },
        include: {
            supplier: true,
            qualityControlLogs: {
                orderBy: { testDate: "desc" },
            },
            productionInputs: {
                include: {
                    productionRun: {
                        include: {
                            finishedGoods: {
                                include: {
                                    pallets: {
                                        include: {
                                            dispatchItems: {
                                                include: {
                                                    dispatchLog: {
                                                        include: {
                                                            customer: true,
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!rawBatch) {
        throw new Error(`Raw maize batch not found: ${rawMaizeBatchId}`);
    }

    // Build forward trace result
    const result: ForwardTraceResult = {
        rawMaizeBatch: {
            batchNumber: rawBatch.batchNumber,
            supplier: rawBatch.supplier.name,
            farmOrigin: rawBatch.farmOrigin,
            receivedAt: rawBatch.receivedAt,
            netWeight: parseFloat(rawBatch.netWeight.toString()),
        },
        qualityTests: rawBatch.qualityControlLogs.map((qc) => ({
            testDate: qc.testDate,
            status: qc.status,
            moistureContent: parseFloat(qc.moistureContent.toString()),
            aflatoxinLevel: parseFloat(qc.aflatoxinLevel.toString()),
            foreignMatter: parseFloat(qc.foreignMatter.toString()),
        })),
        productionRuns: rawBatch.productionInputs.map((input) => ({
            runNumber: input.productionRun.runNumber,
            millingLine: input.productionRun.millingLine,
            startTime: input.productionRun.startTime,
            quantityUsed: parseFloat(input.quantityUsed.toString()),
            finishedGoods: input.productionRun.finishedGoods.map((fg) => ({
                batchNumber: fg.batchNumber,
                productType: fg.productType,
                quantity: parseFloat(fg.totalQuantity.toString()),
                pallets: fg.pallets.map((pallet) => ({
                    palletBarcode: pallet.palletBarcode,
                    dispatches: pallet.dispatchItems.map((item) => ({
                        dispatchNumber: item.dispatchLog.dispatchNumber,
                        customer: item.dispatchLog.customer.name,
                        deliveredAt: item.dispatchLog.deliveredAt,
                    })),
                })),
            })),
        })),
    };

    return result;
}

/**
 * BACKWARD TRACEABILITY
 * 
 * Traces a finished product (bag barcode) backward to source.
 * Returns complete chain: Bag → Bale → Pallet → Batch → Production Run → Raw Maize → Supplier
 * 
 * @param finishedGoodBarcode - Bag barcode to trace
 * @returns Complete backward traceability report
 */
export async function traceBackward(
    finishedGoodBarcode: string
): Promise<BackwardTraceResult> {
    // Find bag by barcode
    const bag = await prisma.bag.findUnique({
        where: { bagBarcode: finishedGoodBarcode },
        include: {
            bale: {
                include: {
                    pallet: {
                        include: {
                            finishedGoodsBatch: {
                                include: {
                                    productionRun: {
                                        include: {
                                            inputs: {
                                                include: {
                                                    rawMaizeBatch: {
                                                        include: {
                                                            supplier: true,
                                                            qualityControlLogs: {
                                                                orderBy: { testDate: "desc" },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!bag) {
        throw new Error(`Finished good not found: ${finishedGoodBarcode}`);
    }

    const bale = bag.bale;
    const pallet = bale.pallet;
    const fgBatch = pallet.finishedGoodsBatch;
    const productionRun = fgBatch.productionRun;

    // Build backward trace result
    const result: BackwardTraceResult = {
        bag: {
            bagBarcode: bag.bagBarcode,
            weight: parseFloat(bag.weight.toString()),
            createdAt: bag.createdAt,
        },
        bale: {
            baleBarcode: bale.baleBarcode,
            totalWeight: parseFloat(bale.totalWeight.toString()),
        },
        pallet: {
            palletBarcode: pallet.palletBarcode,
            totalWeight: parseFloat(pallet.totalWeight.toString()),
        },
        finishedGoodsBatch: {
            batchNumber: fgBatch.batchNumber,
            productType: fgBatch.productType,
            packagingDate: fgBatch.packagingDate,
            expiryDate: fgBatch.expiryDate,
        },
        productionRun: {
            runNumber: productionRun.runNumber,
            millingLine: productionRun.millingLine,
            operatorName: productionRun.operatorName,
            startTime: productionRun.startTime,
            endTime: productionRun.endTime,
            yieldEfficiency: parseFloat(productionRun.yieldEfficiency.toString()),
        },
        rawMaizeBatches: productionRun.inputs.map((input) => ({
            batchNumber: input.rawMaizeBatch.batchNumber,
            supplier: {
                name: input.rawMaizeBatch.supplier.name,
                farmLocation: input.rawMaizeBatch.supplier.farmLocation,
            },
            truckRegistration: input.rawMaizeBatch.truckRegistration,
            netWeight: parseFloat(input.rawMaizeBatch.netWeight.toString()),
            receivedAt: input.rawMaizeBatch.receivedAt,
            qualityTests: input.rawMaizeBatch.qualityControlLogs.map((qc) => ({
                status: qc.status,
                moistureContent: parseFloat(qc.moistureContent.toString()),
                aflatoxinLevel: parseFloat(qc.aflatoxinLevel.toString()),
                foreignMatter: parseFloat(qc.foreignMatter.toString()),
                testDate: qc.testDate,
                testedBy: qc.testedBy,
            })),
        })),
    };

    return result;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function generateBatchNumber(prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM (
      SELECT id FROM RawMaizeBatch WHERE batchNumber LIKE ${`${prefix}-${year}-%`}
      UNION ALL
      SELECT id FROM ProductionRun WHERE runNumber LIKE ${`${prefix}-${year}-%`}
      UNION ALL
      SELECT id FROM FinishedGoodsBatch WHERE batchNumber LIKE ${`${prefix}-${year}-%`}
      UNION ALL
      SELECT id FROM ByProductBatch WHERE batchNumber LIKE ${`${prefix}-${year}-%`}
    ) as combined
  `;

    const sequence = Number(count[0].count) + 1;
    return `${prefix}-${year}-${sequence.toString().padStart(4, "0")}`;
}

async function createFinishedGoodsBatch(
    productionRunId: string,
    productType: string,
    quantity: number
) {
    const batchNumber = await generateBatchNumber("FG");

    // Calculate expiry date (e.g., 6 months from production)
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 6);

    return prisma.finishedGoodsBatch.create({
        data: {
            batchNumber,
            productionRunId,
            productType,
            totalQuantity: new Decimal(quantity),
            currentQuantity: new Decimal(quantity),
            expiryDate,
        },
    });
}

async function createByProductBatch(
    productionRunId: string,
    productType: string,
    quantity: number
) {
    const batchNumber = await generateBatchNumber("BP");

    return prisma.byProductBatch.create({
        data: {
            batchNumber,
            productionRunId,
            productType,
            quantity: new Decimal(quantity),
            currentQuantity: new Decimal(quantity),
        },
    });
}

export default {
    receiveRawMaize,
    performQualityControl,
    calculateMillingYield,
    createProductionRun,
    enforceFIFOPicking,
    traceForward,
    traceBackward,
};
