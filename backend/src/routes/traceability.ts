/**
 * TRACEABILITY API ROUTES
 * 
 * RESTful endpoints for food safety traceability operations.
 * Implements HACCP/ISO 22000 compliant tracking workflows.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import traceabilityService from "../services/traceability.service";

const router = Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const receiveRawMaizeSchema = z.object({
    supplierId: z.string().min(1, "Supplier ID is required"),
    farmOrigin: z.string().optional(),
    harvestDate: z.string().datetime().optional(),
    truckRegistration: z.string().min(1, "Truck registration is required"),
    driverName: z.string().optional(),
    driverPhone: z.string().optional(),
    grossWeight: z.number().positive("Gross weight must be positive"),
    tareWeight: z.number().positive("Tare weight must be positive"),
    siloId: z.string().optional(),
    expiryDate: z.string().datetime().optional(),
});

const qualityTestSchema = z.object({
    rawMaizeBatchId: z.string().min(1, "Raw maize batch ID is required"),
    moistureContent: z.number().min(0).max(100, "Moisture must be 0-100%"),
    aflatoxinLevel: z.number().min(0, "Aflatoxin level must be non-negative"),
    foreignMatter: z.number().min(0).max(100, "Foreign matter must be 0-100%"),
    brokenKernels: z.number().min(0).max(100).optional(),
    testedBy: z.string().min(1, "Tester name/ID is required"),
    remarks: z.string().optional(),
});

const productionRunSchema = z.object({
    millingLine: z.string().min(1, "Milling line is required"),
    operatorName: z.string().min(1, "Operator name is required"),
    rawMaizeBatchInputs: z
        .array(
            z.object({
                batchId: z.string().min(1),
                quantityUsed: z.number().positive(),
            })
        )
        .min(1, "At least one raw maize batch input is required"),
    startTime: z.string().datetime(),
    endTime: z.string().datetime().optional(),
    yieldData: z.object({
        grade1Flour: z.number().min(0),
        grade2Flour: z.number().min(0),
        maizeBran: z.number().min(0),
        maizeGerm: z.number().min(0),
    }),
});

// ============================================
// RAW MATERIAL RECEIVING
// ============================================

/**
 * POST /api/traceability/receive-raw-maize
 * 
 * Record inbound raw maize delivery with weighbridge data.
 * Batch is automatically quarantined pending QC approval.
 */
router.post("/receive-raw-maize", async (req: Request, res: Response) => {
    try {
        const data = receiveRawMaizeSchema.parse(req.body);

        const batch = await traceabilityService.receiveRawMaize({
            ...data,
            harvestDate: data.harvestDate ? new Date(data.harvestDate) : undefined,
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        });

        res.status(201).json({
            success: true,
            message: "Raw maize batch received and quarantined pending QC",
            batch,
        });
    } catch (error: any) {
        console.error("Error receiving raw maize:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to receive raw maize",
        });
    }
});

/**
 * POST /api/traceability/quality-control
 * 
 * Perform quality control test on quarantined raw maize batch.
 * Automatically approves or rejects based on compliance thresholds.
 */
router.post("/quality-control", async (req: Request, res: Response) => {
    try {
        const data = qualityTestSchema.parse(req.body);

        const qcLog = await traceabilityService.performQualityControl(data);

        res.status(201).json({
            success: true,
            message: `Quality control test completed: ${qcLog.status}`,
            qcLog,
        });
    } catch (error: any) {
        console.error("Error performing quality control:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to perform quality control",
        });
    }
});

// ============================================
// PRODUCTION & MILLING
// ============================================

/**
 * POST /api/traceability/production-run
 * 
 * Create a production run with full traceability.
 * Links raw maize inputs to finished goods outputs.
 * Validates mass balance and flags variance alerts.
 */
router.post("/production-run", async (req: Request, res: Response) => {
    try {
        const data = productionRunSchema.parse(req.body);

        const result = await traceabilityService.createProductionRun(
            {
                millingLine: data.millingLine,
                operatorName: data.operatorName,
                rawMaizeBatchInputs: data.rawMaizeBatchInputs,
                startTime: new Date(data.startTime),
                endTime: data.endTime ? new Date(data.endTime) : undefined,
            },
            data.yieldData
        );

        res.status(201).json({
            success: true,
            message: result.yieldMetrics.message,
            productionRun: result.productionRun,
            yieldMetrics: result.yieldMetrics,
        });
    } catch (error: any) {
        console.error("Error creating production run:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to create production run",
        });
    }
});

/**
 * POST /api/traceability/calculate-yield
 * 
 * Calculate milling yield and mass balance.
 * Utility endpoint for pre-validation before creating production run.
 */
router.post("/calculate-yield", async (req: Request, res: Response) => {
    try {
        const { rawMaizeWeight, yieldData } = req.body;

        if (!rawMaizeWeight || !yieldData) {
            return res.status(400).json({
                success: false,
                message: "rawMaizeWeight and yieldData are required",
            });
        }

        const result = traceabilityService.calculateMillingYield(
            rawMaizeWeight,
            yieldData
        );

        res.json({
            success: true,
            yieldMetrics: result,
        });
    } catch (error: any) {
        console.error("Error calculating yield:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to calculate yield",
        });
    }
});

// ============================================
// FIFO INVENTORY PICKING
// ============================================

/**
 * GET /api/traceability/fifo-picking
 * 
 * Get FIFO-sorted list of batches for picking.
 * Prioritizes oldest expiration or reception date.
 * 
 * Query params:
 * - itemType: "RAW_MAIZE" or "FINISHED_GOODS"
 * - requiredQuantity: (optional) filter by minimum quantity
 */
router.get("/fifo-picking", async (req: Request, res: Response) => {
    try {
        const { itemType, requiredQuantity } = req.query;

        if (!itemType || (itemType !== "RAW_MAIZE" && itemType !== "FINISHED_GOODS")) {
            return res.status(400).json({
                success: false,
                message: 'itemType must be "RAW_MAIZE" or "FINISHED_GOODS"',
            });
        }

        const results = await traceabilityService.enforceFIFOPicking(
            itemType as "RAW_MAIZE" | "FINISHED_GOODS",
            requiredQuantity ? parseFloat(requiredQuantity as string) : undefined
        );

        res.json({
            success: true,
            itemType,
            pickingOrder: results,
            message: `Found ${results.length} batches sorted by FIFO priority`,
        });
    } catch (error: any) {
        console.error("Error enforcing FIFO picking:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to enforce FIFO picking",
        });
    }
});

// ============================================
// TRACEABILITY QUERIES
// ============================================

/**
 * GET /api/traceability/trace-forward/:batchId
 * 
 * Forward traceability: Raw Maize → Production → Finished Goods → Dispatch
 * Returns complete supply chain tree from source to customer.
 */
router.get("/trace-forward/:batchId", async (req: Request, res: Response) => {
    try {
        const { batchId } = req.params;

        const result = await traceabilityService.traceForward(batchId);

        res.json({
            success: true,
            traceability: result,
            message: "Forward traceability report generated",
        });
    } catch (error: any) {
        console.error("Error tracing forward:", error);
        res.status(404).json({
            success: false,
            message: error.message || "Failed to trace forward",
        });
    }
});

/**
 * GET /api/traceability/trace-backward/:barcode
 * 
 * Backward traceability: Finished Product → Production → Raw Maize → Supplier
 * Returns complete chain from retail bag to farm origin.
 */
router.get("/trace-backward/:barcode", async (req: Request, res: Response) => {
    try {
        const { barcode } = req.params;

        const result = await traceabilityService.traceBackward(barcode);

        res.json({
            success: true,
            traceability: result,
            message: "Backward traceability report generated",
        });
    } catch (error: any) {
        console.error("Error tracing backward:", error);
        res.status(404).json({
            success: false,
            message: error.message || "Failed to trace backward",
        });
    }
});

// ============================================
// HEALTH CHECK
// ============================================

router.get("/health", (_req: Request, res: Response) => {
    res.json({
        success: true,
        message: "Traceability module is operational",
        timestamp: new Date().toISOString(),
    });
});

export default router;
