"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStockTransferController = createStockTransferController;
exports.listStockTransfersController = listStockTransfersController;
exports.getStockTransferController = getStockTransferController;
exports.approveIssueStockTransferController = approveIssueStockTransferController;
exports.acknowledgeReceiptController = acknowledgeReceiptController;
exports.rejectStockTransferController = rejectStockTransferController;
exports.listStoreBalancesController = listStoreBalancesController;
const zod_1 = require("zod");
const stock_transfer_service_1 = require("../services/stock-transfer.service");
const StoreCodeSchema = zod_1.z.enum([
    "MAIN_STORE",
    "PACKAGING_STORE",
    "MAIZE_STORE",
    "DISPATCH_STORE",
]);
const CreateRequestSchema = zod_1.z.object({
    sourceStoreCode: StoreCodeSchema,
    destinationStoreCode: StoreCodeSchema,
    notes: zod_1.z.string().max(2000).optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        itemId: zod_1.z.string().min(1),
        qtyRequested: zod_1.z.number().positive(),
    }))
        .min(1),
});
const ApproveIssueSchema = zod_1.z.object({
    lines: zod_1.z
        .array(zod_1.z.object({
        lineId: zod_1.z.string().min(1),
        qtyIssued: zod_1.z.number().positive().optional(),
    }))
        .optional(),
});
const ReceiveSchema = zod_1.z.object({
    lines: zod_1.z
        .array(zod_1.z.object({
        lineId: zod_1.z.string().min(1),
        qtyReceived: zod_1.z.number().nonnegative(),
    }))
        .min(1),
});
const RejectSchema = zod_1.z.object({
    rejectionReason: zod_1.z.string().max(2000).optional(),
});
async function createStockTransferController(req, res) {
    try {
        const parse = CreateRequestSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                message: "Invalid request payload",
                errors: parse.error.flatten(),
            });
        }
        const transfer = await (0, stock_transfer_service_1.createStockTransferRequest)(req.auth, parse.data);
        res.status(201).json({ success: true, transfer });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create request";
        res.status(400).json({ message });
    }
}
async function listStockTransfersController(req, res) {
    try {
        const status = req.query.status;
        const transfers = await (0, stock_transfer_service_1.listStockTransferRequests)(req.auth, { status });
        res.json({ transfers, role: req.auth.role });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to list transfers";
        res.status(400).json({ message });
    }
}
async function getStockTransferController(req, res) {
    try {
        const transfer = await (0, stock_transfer_service_1.getStockTransferRequest)(req.auth, req.params.id);
        res.json({ transfer, role: req.auth.role });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Transfer not found";
        res.status(404).json({ message });
    }
}
async function approveIssueStockTransferController(req, res) {
    try {
        const parse = ApproveIssueSchema.safeParse(req.body ?? {});
        if (!parse.success) {
            return res.status(400).json({
                message: "Invalid approve/issue payload",
                errors: parse.error.flatten(),
            });
        }
        const transfer = await (0, stock_transfer_service_1.approveAndIssueStockTransfer)(req.auth, req.params.id, parse.data.lines);
        res.json({ success: true, transfer });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Approve/issue failed";
        res.status(400).json({ message });
    }
}
async function acknowledgeReceiptController(req, res) {
    try {
        const parse = ReceiveSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                message: "Invalid receipt payload",
                errors: parse.error.flatten(),
            });
        }
        const transfer = await (0, stock_transfer_service_1.acknowledgeStockTransferReceipt)(req.auth, req.params.id, parse.data.lines);
        res.json({ success: true, transfer });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Receipt acknowledgement failed";
        res.status(400).json({ message });
    }
}
async function rejectStockTransferController(req, res) {
    try {
        const parse = RejectSchema.safeParse(req.body ?? {});
        if (!parse.success) {
            return res.status(400).json({
                message: "Invalid reject payload",
                errors: parse.error.flatten(),
            });
        }
        const transfer = await (0, stock_transfer_service_1.rejectStockTransferRequest)(req.auth, req.params.id, parse.data.rejectionReason);
        res.json({ success: true, transfer });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Reject failed";
        res.status(400).json({ message });
    }
}
async function listStoreBalancesController(req, res) {
    try {
        const itemId = typeof req.query.itemId === "string" ? req.query.itemId : undefined;
        const storeCode = typeof req.query.storeCode === "string"
            ? req.query.storeCode
            : undefined;
        const balances = await (0, stock_transfer_service_1.listStoreInventoryBalances)(req.auth, {
            itemId,
            storeCode,
        });
        res.json({ balances, role: req.auth.role });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load balances";
        res.status(400).json({ message });
    }
}
