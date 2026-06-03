import { Router, Response, NextFunction } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import {
  acknowledgeReceiptController,
  approveIssueStockTransferController,
  createStockTransferController,
  getStockTransferController,
  listStockTransfersController,
  listStoreBalancesController,
  rejectReceiptController,
  rejectStockTransferController,
} from "../controllers/stock-transfer";

const handle = (fn: (req: AuthenticatedRequest, res: Response) => Promise<any>) =>
  (req: any, res: Response, next: NextFunction) => fn(req as AuthenticatedRequest, res).catch(next);

export const stockTransferRouter = Router();

stockTransferRouter.use(requireAuth);

/** Per-store inventory (physical + in-transit) */
stockTransferRouter.get("/balances", handle(listStoreBalancesController));

/** List transfer requests (RBAC-scoped) */
stockTransferRouter.get("/", handle(listStockTransfersController));

/** Get single transfer */
stockTransferRouter.get("/:id", handle(getStockTransferController));

/** CREATE_REQUEST → PENDING */
stockTransferRouter.post("/", handle(createStockTransferController));

/**
 * APPROVE_AND_ISSUE → APPROVED_IN_TRANSIT
 * Also handles re-issue after PENDING_CORRECTION (receipt was rejected by receiving store).
 * Body: { lines?: [{ lineId, qtyIssued? }] }
 * qtyIssued may be less than qtyRequested when main store stock is limited.
 */
stockTransferRouter.post(
  "/:id/approve-issue",
  handle(approveIssueStockTransferController)
);

/**
 * ACKNOWLEDGE_RECEIPT → COMPLETED
 * Receiving store records what was actually received.
 * Body: { lines: [{ lineId, qtyReceived }] }
 */
stockTransferRouter.post("/:id/receive", handle(acknowledgeReceiptController));

/**
 * REJECT_RECEIPT → PENDING_CORRECTION
 * Receiving store rejects the entire delivery and returns stock to main store.
 * Body: { rejectionReason: string } — mandatory
 */
stockTransferRouter.post("/:id/reject-receipt", handle(rejectReceiptController));

/**
 * REJECT → REJECTED (pending request only)
 * Main store manager rejects the request outright.
 * Body: { rejectionReason: string } — mandatory
 */
stockTransferRouter.post("/:id/reject", handle(rejectStockTransferController));
