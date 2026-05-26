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
/** APPROVE_AND_ISSUE → APPROVED_IN_TRANSIT */
exports.stockTransferRouter.post("/:id/approve-issue", handle(stock_transfer_1.approveIssueStockTransferController));
/** ACKNOWLEDGE_RECEIPT → COMPLETED */
exports.stockTransferRouter.post("/:id/receive", handle(stock_transfer_1.acknowledgeReceiptController));
/** REJECT pending request */
exports.stockTransferRouter.post("/:id/reject", handle(stock_transfer_1.rejectStockTransferController));
