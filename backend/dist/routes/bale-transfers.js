"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.baleTransferRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const bale_transfer_controller_1 = require("../controllers/bale-transfer.controller");
const handle = (fn) => (req, res, next) => fn(req, res).catch(next);
exports.baleTransferRouter = (0, express_1.Router)();
exports.baleTransferRouter.use(auth_1.requireAuth);
/**
 * GET  /bale-transfers
 * List bale transfers visible to the authenticated user (role-scoped).
 * Query: ?status=PENDING|APPROVED_IN_TRANSIT|COMPLETED|REJECTED|PENDING_CORRECTION
 */
exports.baleTransferRouter.get("/", handle(bale_transfer_controller_1.listBaleTransfersController));
/**
 * GET  /bale-transfers/:id
 * Get a single bale transfer by ID.
 */
exports.baleTransferRouter.get("/:id", handle(bale_transfer_controller_1.getBaleTransferController));
/**
 * POST /bale-transfers/push
 * Packaging Store Manager pushes bales directly to Dispatch Store.
 * Body: { items: [{ inventoryItemId, qtyRequested }], notes? }
 * Creates a transfer in APPROVED_IN_TRANSIT status immediately.
 */
exports.baleTransferRouter.post("/push", handle(bale_transfer_controller_1.createPushTransferController));
/**
 * POST /bale-transfers/pull
 * Dispatch Store Manager requests bales from Packaging Store.
 * Body: { items: [{ inventoryItemId, qtyRequested }], notes? }
 * Creates a transfer in PENDING status for Packaging Store to review.
 */
exports.baleTransferRouter.post("/pull", handle(bale_transfer_controller_1.createPullRequestController));
/**
 * POST /bale-transfers/:id/issue
 * Packaging Store Manager approves and issues a PENDING (or PENDING_CORRECTION) pull request.
 * Body: { lines?: [{ lineId, qtyIssued?, partialIssueReason? }] }
 * When lines are omitted, full qtyRequested is issued for each line.
 */
exports.baleTransferRouter.post("/:id/issue", handle(bale_transfer_controller_1.issuePullRequestController));
/**
 * POST /bale-transfers/:id/reject
 * Packaging Store Manager rejects a PENDING pull request entirely.
 * Body: { rejectionReason: string }
 */
exports.baleTransferRouter.post("/:id/reject", handle(bale_transfer_controller_1.rejectPullRequestController));
/**
 * POST /bale-transfers/:id/receive
 * Dispatch Store Manager acknowledges receipt of bales (APPROVED_IN_TRANSIT → COMPLETED).
 * Body: { lines: [{ lineId, qtyReceived }] }
 */
exports.baleTransferRouter.post("/:id/receive", handle(bale_transfer_controller_1.acknowledgeBaleReceiptController));
/**
 * POST /bale-transfers/:id/reject-delivery
 * Dispatch Store Manager rejects an incoming delivery (APPROVED_IN_TRANSIT → PENDING_CORRECTION).
 * Inventory is reversed back to Packaging Store.
 * Body: { receiptRejectionReason: string }
 */
exports.baleTransferRouter.post("/:id/reject-delivery", handle(bale_transfer_controller_1.rejectBaleDeliveryController));
