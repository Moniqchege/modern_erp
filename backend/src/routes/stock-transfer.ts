import { Router, Response, NextFunction } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import {
  acknowledgeReceiptController,
  approveIssueStockTransferController,
  createStockTransferController,
  getStockTransferController,
  listStockTransfersController,
  listStoreBalancesController,
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

/** APPROVE_AND_ISSUE → APPROVED_IN_TRANSIT */
stockTransferRouter.post(
  "/:id/approve-issue",
  handle(approveIssueStockTransferController)
);

/** ACKNOWLEDGE_RECEIPT → COMPLETED */
stockTransferRouter.post("/:id/receive", handle(acknowledgeReceiptController));

/** REJECT pending request */
stockTransferRouter.post("/:id/reject", handle(rejectStockTransferController));
