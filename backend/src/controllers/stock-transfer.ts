import { Response } from "express";
import { z } from "zod";
import { StockTransferStatus } from "@prisma/client";
import type { AuthenticatedRequest } from "../middleware/auth";
import {
  acknowledgeStockTransferReceipt,
  approveAndIssueStockTransfer,
  createStockTransferRequest,
  getStockTransferRequest,
  listStockTransferRequests,
  listStoreInventoryBalances,
  rejectStockTransferRequest,
} from "../services/stock-transfer.service";

const StoreCodeSchema = z.enum([
  "MAIN_STORE",
  "PACKAGING_STORE",
  "MAIZE_STORE",
  "DISPATCH_STORE",
]);

const CreateRequestSchema = z.object({
  sourceStoreCode: StoreCodeSchema,
  destinationStoreCode: StoreCodeSchema,
  notes: z.string().max(2000).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        qtyRequested: z.number().positive(),
      })
    )
    .min(1),
});

const ApproveIssueSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        qtyIssued: z.number().positive().optional(),
      })
    )
    .optional(),
});

const ReceiveSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        qtyReceived: z.number().nonnegative(),
      })
    )
    .min(1),
});

const RejectSchema = z.object({
  rejectionReason: z.string().max(2000).optional(),
});

export async function createStockTransferController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const parse = CreateRequestSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        message: "Invalid request payload",
        errors: parse.error.flatten(),
      });
    }

    const transfer = await createStockTransferRequest(req.auth, parse.data);
    res.status(201).json({ success: true, transfer });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create request";
    res.status(400).json({ message });
  }
}

export async function listStockTransfersController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const status = req.query.status as StockTransferStatus | undefined;
    const transfers = await listStockTransferRequests(req.auth, { status });
    res.json({ transfers, role: req.auth.role });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list transfers";
    res.status(400).json({ message });
  }
}

export async function getStockTransferController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const transfer = await getStockTransferRequest(
      req.auth,
      req.params.id
    );
    res.json({ transfer, role: req.auth.role });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transfer not found";
    res.status(404).json({ message });
  }
}

export async function approveIssueStockTransferController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const parse = ApproveIssueSchema.safeParse(req.body ?? {});
    if (!parse.success) {
      return res.status(400).json({
        message: "Invalid approve/issue payload",
        errors: parse.error.flatten(),
      });
    }

    const transfer = await approveAndIssueStockTransfer(
      req.auth,
      req.params.id,
      parse.data.lines
    );
    res.json({ success: true, transfer });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Approve/issue failed";
    res.status(400).json({ message });
  }
}

export async function acknowledgeReceiptController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const parse = ReceiveSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        message: "Invalid receipt payload",
        errors: parse.error.flatten(),
      });
    }

    const transfer = await acknowledgeStockTransferReceipt(
      req.auth,
      req.params.id,
      parse.data.lines
    );
    res.json({ success: true, transfer });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Receipt acknowledgement failed";
    res.status(400).json({ message });
  }
}

export async function rejectStockTransferController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const parse = RejectSchema.safeParse(req.body ?? {});
    if (!parse.success) {
      return res.status(400).json({
        message: "Invalid reject payload",
        errors: parse.error.flatten(),
      });
    }

    const transfer = await rejectStockTransferRequest(
      req.auth,
      req.params.id,
      parse.data.rejectionReason
    );
    res.json({ success: true, transfer });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Reject failed";
    res.status(400).json({ message });
  }
}

export async function listStoreBalancesController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const itemId =
      typeof req.query.itemId === "string" ? req.query.itemId : undefined;
    const storeCode =
      typeof req.query.storeCode === "string"
        ? (req.query.storeCode as z.infer<typeof StoreCodeSchema>)
        : undefined;

    const balances = await listStoreInventoryBalances(req.auth, {
      itemId,
      storeCode,
    });
    res.json({ balances, role: req.auth.role });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load balances";
    res.status(400).json({ message });
  }
}
