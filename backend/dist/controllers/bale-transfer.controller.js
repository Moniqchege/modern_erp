"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPushTransferController = createPushTransferController;
exports.createPullRequestController = createPullRequestController;
exports.listBaleTransfersController = listBaleTransfersController;
exports.getBaleTransferController = getBaleTransferController;
exports.issuePullRequestController = issuePullRequestController;
exports.rejectPullRequestController = rejectPullRequestController;
exports.acknowledgeBaleReceiptController = acknowledgeBaleReceiptController;
exports.rejectBaleDeliveryController = rejectBaleDeliveryController;
exports.getBaleStockController = getBaleStockController;
const zod_1 = require("zod");
const bale_transfer_service_1 = require("../services/bale-transfer.service");
// ─── Validation Schemas ───────────────────────────────────────────────────────
const TransferItemSchema = zod_1.z.object({
    inventoryItemId: zod_1.z.string().min(1, "inventoryItemId is required"),
    qtyRequested: zod_1.z
        .number()
        .positive("Quantity must be greater than zero")
        .refine((v) => {
        const parts = v.toString().split(".");
        return !parts[1] || parts[1].length <= 3;
    }, "Quantity must have at most 3 decimal places"),
});
const CreatePushTransferSchema = zod_1.z.object({
    items: zod_1.z
        .array(TransferItemSchema)
        .min(1, "At least one transfer item is required")
        .max(50, "At most 50 items per transfer"),
    notes: zod_1.z.string().max(2000).optional(),
});
const CreatePullRequestSchema = zod_1.z.object({
    items: zod_1.z
        .array(TransferItemSchema)
        .min(1, "At least one transfer item is required")
        .max(50, "At most 50 items per request"),
    notes: zod_1.z.string().max(2000).optional(),
});
const IssueLinesSchema = zod_1.z.object({
    lines: zod_1.z
        .array(zod_1.z.object({
        lineId: zod_1.z.string().min(1),
        qtyIssued: zod_1.z.number().positive().optional(),
        partialIssueReason: zod_1.z.string().min(1).max(1000).optional(),
    }))
        .optional(),
});
const ReceiveLinesSchema = zod_1.z.object({
    lines: zod_1.z
        .array(zod_1.z.object({
        lineId: zod_1.z.string().min(1),
        qtyReceived: zod_1.z.number().positive(),
    }))
        .min(1, "At least one receipt line is required"),
});
const RejectSchema = zod_1.z.object({
    rejectionReason: zod_1.z.string().min(1, "Rejection reason is required").max(2000),
});
const RejectDeliverySchema = zod_1.z.object({
    receiptRejectionReason: zod_1.z.string().min(1, "Receipt rejection reason is required").max(2000),
});
// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStatusCode(err) {
    if (err && typeof err === "object" && "statusCode" in err) {
        return err.statusCode;
    }
    return 400;
}
// ─── Controllers ─────────────────────────────────────────────────────────────
/**
 * POST /bale-transfers/push
 * Packaging Store Manager pushes bales directly to Dispatch Store.
 */
async function createPushTransferController(req, res) {
    const parse = CreatePushTransferSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request payload", errors: parse.error.flatten() });
    }
    try {
        const transfer = await (0, bale_transfer_service_1.createPushTransfer)(req.auth, parse.data);
        res.status(201).json({ success: true, transfer });
    }
    catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}
/**
 * POST /bale-transfers/pull
 * Dispatch Store Manager requests bales from Packaging Store.
 */
async function createPullRequestController(req, res) {
    const parse = CreatePullRequestSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request payload", errors: parse.error.flatten() });
    }
    try {
        const transfer = await (0, bale_transfer_service_1.createPullRequest)(req.auth, parse.data);
        res.status(201).json({ success: true, transfer });
    }
    catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}
/**
 * GET /bale-transfers
 * List bale transfers (role-scoped).
 */
async function listBaleTransfersController(req, res) {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    try {
        const transfers = await (0, bale_transfer_service_1.listBaleTransfers)(req.auth, { status });
        res.json({ transfers, role: req.auth.role });
    }
    catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}
/**
 * GET /bale-transfers/:id
 */
async function getBaleTransferController(req, res) {
    try {
        const transfer = await (0, bale_transfer_service_1.getBaleTransferById)(req.auth, req.params.id);
        res.json({ transfer, role: req.auth.role });
    }
    catch (err) {
        const status = getStatusCode(err);
        res.status(status === 400 ? 404 : status).json({ message: err instanceof Error ? err.message : "Not found" });
    }
}
/**
 * POST /bale-transfers/:id/issue
 * Packaging Store Manager issues a pending pull request.
 */
async function issuePullRequestController(req, res) {
    const parse = IssueLinesSchema.safeParse(req.body ?? {});
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid issue payload", errors: parse.error.flatten() });
    }
    try {
        const transfer = await (0, bale_transfer_service_1.issuePullRequest)(req.auth, req.params.id, parse.data.lines);
        res.json({ success: true, transfer });
    }
    catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}
/**
 * POST /bale-transfers/:id/reject
 * Packaging Store Manager rejects a pending pull request.
 */
async function rejectPullRequestController(req, res) {
    const parse = RejectSchema.safeParse(req.body ?? {});
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid reject payload", errors: parse.error.flatten() });
    }
    try {
        const transfer = await (0, bale_transfer_service_1.rejectPullRequest)(req.auth, req.params.id, parse.data.rejectionReason);
        res.json({ success: true, transfer });
    }
    catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}
/**
 * POST /bale-transfers/:id/receive
 * Dispatch Store Manager acknowledges receipt of bales.
 */
async function acknowledgeBaleReceiptController(req, res) {
    const parse = ReceiveLinesSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid receipt payload", errors: parse.error.flatten() });
    }
    try {
        const transfer = await (0, bale_transfer_service_1.acknowledgeBaleReceipt)(req.auth, req.params.id, parse.data.lines);
        res.json({ success: true, transfer });
    }
    catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}
/**
 * POST /bale-transfers/:id/reject-delivery
 * Dispatch Store Manager rejects an incoming bale delivery.
 */
async function rejectBaleDeliveryController(req, res) {
    const parse = RejectDeliverySchema.safeParse(req.body ?? {});
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid payload", errors: parse.error.flatten() });
    }
    try {
        const transfer = await (0, bale_transfer_service_1.rejectBaleDelivery)(req.auth, req.params.id, parse.data.receiptRejectionReason);
        res.json({ success: true, transfer });
    }
    catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}
/**
 * GET /bale-transfers/bale-stock
 * Returns items that have been produced as packed bales in packaging runs,
 * with their current Packaging Store physical and transit quantities.
 * Used by the transfer form so only actual bale items are shown (not raw bags).
 */
async function getBaleStockController(req, res) {
    try {
        const stock = await (0, bale_transfer_service_1.getPackagingStoreBaleStock)();
        res.json({ stock });
    }
    catch (err) {
        res.status(500).json({ message: err instanceof Error ? err.message : "Failed to load bale stock" });
    }
}
