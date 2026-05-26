import type { Request } from "express";
import { Router } from "express";
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

export const stockTransferRouter = Router();

stockTransferRouter.use(requireAuth);

/** Per-store inventory (physical + in-transit) */
stockTransferRouter.get("/balances", (req, res) =>
  listStoreBalancesController(req as unknown as AuthenticatedRequest, res)
);

/** List transfer requests (RBAC-scoped) */
stockTransferRouter.get("/", (req, res) =>
  listStockTransfersController(req as unknown as AuthenticatedRequest, res)
);

/** Get single transfer */
stockTransferRouter.get("/:id", (req, res) =>
  getStockTransferController(req as unknown as AuthenticatedRequest, res)
);

/** CREATE_REQUEST → PENDING */
stockTransferRouter.post("/", (req, res) =>
  createStockTransferController(req as unknown as AuthenticatedRequest, res)
);

/** APPROVE_AND_ISSUE → APPROVED_IN_TRANSIT */
stockTransferRouter.post("/:id/approve-issue", (req, res) =>
  approveIssueStockTransferController(req as unknown as AuthenticatedRequest, res)
);

/** ACKNOWLEDGE_RECEIPT → COMPLETED */
stockTransferRouter.post("/:id/receive", (req, res) =>
  acknowledgeReceiptController(req as unknown as AuthenticatedRequest, res)
);

/** REJECT pending request */
stockTransferRouter.post("/:id/reject", (req, res) =>
  rejectStockTransferController(req as unknown as AuthenticatedRequest, res)
);

