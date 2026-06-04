import { Router, Response, NextFunction } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import {
    createPushTransferController,
    createPullRequestController,
    listBaleTransfersController,
    getBaleTransferController,
    issuePullRequestController,
    rejectPullRequestController,
    acknowledgeBaleReceiptController,
    rejectBaleDeliveryController,
    getBaleStockController,
} from "../controllers/bale-transfer.controller";

const handle = (fn: (req: AuthenticatedRequest, res: Response) => Promise<any>) =>
    (req: any, res: Response, next: NextFunction) =>
        fn(req as AuthenticatedRequest, res).catch(next);

export const baleTransferRouter = Router();

baleTransferRouter.use(requireAuth);

/**
 * GET /bale-transfers/bale-stock
 * Items produced as packed bales with their Packaging Store balances.
 * Must be registered before /:id to avoid route collision.
 */
baleTransferRouter.get("/bale-stock", handle(getBaleStockController));

/**
 * GET  /bale-transfers
 * List bale transfers visible to the authenticated user (role-scoped).
 * Query: ?status=PENDING|APPROVED_IN_TRANSIT|COMPLETED|REJECTED|PENDING_CORRECTION
 */
baleTransferRouter.get("/", handle(listBaleTransfersController));

/**
 * GET  /bale-transfers/:id
 * Get a single bale transfer by ID.
 */
baleTransferRouter.get("/:id", handle(getBaleTransferController));

/**
 * POST /bale-transfers/push
 * Packaging Store Manager pushes bales directly to Dispatch Store.
 * Body: { items: [{ inventoryItemId, qtyRequested }], notes? }
 * Creates a transfer in APPROVED_IN_TRANSIT status immediately.
 */
baleTransferRouter.post("/push", handle(createPushTransferController));

/**
 * POST /bale-transfers/pull
 * Dispatch Store Manager requests bales from Packaging Store.
 * Body: { items: [{ inventoryItemId, qtyRequested }], notes? }
 * Creates a transfer in PENDING status for Packaging Store to review.
 */
baleTransferRouter.post("/pull", handle(createPullRequestController));

/**
 * POST /bale-transfers/:id/issue
 * Packaging Store Manager approves and issues a PENDING (or PENDING_CORRECTION) pull request.
 * Body: { lines?: [{ lineId, qtyIssued?, partialIssueReason? }] }
 * When lines are omitted, full qtyRequested is issued for each line.
 */
baleTransferRouter.post("/:id/issue", handle(issuePullRequestController));

/**
 * POST /bale-transfers/:id/reject
 * Packaging Store Manager rejects a PENDING pull request entirely.
 * Body: { rejectionReason: string }
 */
baleTransferRouter.post("/:id/reject", handle(rejectPullRequestController));

/**
 * POST /bale-transfers/:id/receive
 * Dispatch Store Manager acknowledges receipt of bales (APPROVED_IN_TRANSIT → COMPLETED).
 * Body: { lines: [{ lineId, qtyReceived }] }
 */
baleTransferRouter.post("/:id/receive", handle(acknowledgeBaleReceiptController));

/**
 * POST /bale-transfers/:id/reject-delivery
 * Dispatch Store Manager rejects an incoming delivery (APPROVED_IN_TRANSIT → PENDING_CORRECTION).
 * Inventory is reversed back to Packaging Store.
 * Body: { receiptRejectionReason: string }
 */
baleTransferRouter.post("/:id/reject-delivery", handle(rejectBaleDeliveryController));
