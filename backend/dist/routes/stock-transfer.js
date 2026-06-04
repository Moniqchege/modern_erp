"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockTransferRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const stock_transfer_1 = require("../controllers/stock-transfer");
const handle = (fn) => (req, res, next) => fn(req, res).catch(next);
exports.stockTransferRouter = (0, express_1.Router)();
exports.stockTransferRouter.use(auth_1.requireAuth);
/** Per-store inventory (physical + in-transit) */
exports.stockTransferRouter.get("/balances", handle(stock_transfer_1.listStoreBalancesController));
/** List transfer requests (RBAC-scoped) */
exports.stockTransferRouter.get("/", handle(stock_transfer_1.listStockTransfersController));
/** Get single transfer */
exports.stockTransferRouter.get("/:id", handle(stock_transfer_1.getStockTransferController));
/** CREATE_REQUEST → PENDING */
exports.stockTransferRouter.post("/", handle(stock_transfer_1.createStockTransferController));
/**
 * APPROVE_AND_ISSUE → APPROVED_IN_TRANSIT
 * Also handles re-issue after PENDING_CORRECTION (receipt was rejected by receiving store).
 * Body: { lines?: [{ lineId, qtyIssued? }] }
 * qtyIssued may be less than qtyRequested when main store stock is limited.
 */
exports.stockTransferRouter.post("/:id/approve-issue", handle(stock_transfer_1.approveIssueStockTransferController));
/**
 * ACKNOWLEDGE_RECEIPT → COMPLETED
 * Receiving store records what was actually received.
 * Body: { lines: [{ lineId, qtyReceived }] }
 */
exports.stockTransferRouter.post("/:id/receive", handle(stock_transfer_1.acknowledgeReceiptController));
/**
 * REJECT_RECEIPT → PENDING_CORRECTION
 * Receiving store rejects the entire delivery and returns stock to main store.
 * Body: { rejectionReason: string } — mandatory
 */
exports.stockTransferRouter.post("/:id/reject-receipt", handle(stock_transfer_1.rejectReceiptController));
/**
 * REJECT → REJECTED (pending request only)
 * Main store manager rejects the request outright.
 * Body: { rejectionReason: string } — mandatory
 */
exports.stockTransferRouter.post("/:id/reject", handle(stock_transfer_1.rejectStockTransferController));
