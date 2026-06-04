import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth";
import {
    createPushTransfer,
    createPullRequest,
    issuePullRequest,
    rejectPullRequest,
    acknowledgeBaleReceipt,
    rejectBaleDelivery,
    listBaleTransfers,
    getBaleTransferById,
    getPackagingStoreBaleStock,
} from "../services/bale-transfer.service";

// ─── Validation Schemas ───────────────────────────────────────────────────────

const TransferItemSchema = z.object({
    inventoryItemId: z.string().min(1, "inventoryItemId is required"),
    qtyRequested: z
        .number()
        .positive("Quantity must be greater than zero")
        .refine(
            (v) => {
                const parts = v.toString().split(".");
                return !parts[1] || parts[1].length <= 3;
            },
            "Quantity must have at most 3 decimal places"
        ),
});

const CreatePushTransferSchema = z.object({
    items: z
        .array(TransferItemSchema)
        .min(1, "At least one transfer item is required")
        .max(50, "At most 50 items per transfer"),
    notes: z.string().max(2000).optional(),
});

const CreatePullRequestSchema = z.object({
    items: z
        .array(TransferItemSchema)
        .min(1, "At least one transfer item is required")
        .max(50, "At most 50 items per request"),
    notes: z.string().max(2000).optional(),
});

const IssueLinesSchema = z.object({
    lines: z
        .array(
            z.object({
                lineId: z.string().min(1),
                qtyIssued: z.number().positive().optional(),
                partialIssueReason: z.string().min(1).max(1000).optional(),
            })
        )
        .optional(),
});

const ReceiveLinesSchema = z.object({
    lines: z
        .array(
            z.object({
                lineId: z.string().min(1),
                qtyReceived: z.number().positive(),
            })
        )
        .min(1, "At least one receipt line is required"),
});

const RejectSchema = z.object({
    rejectionReason: z.string().min(1, "Rejection reason is required").max(2000),
});

const RejectDeliverySchema = z.object({
    receiptRejectionReason: z.string().min(1, "Receipt rejection reason is required").max(2000),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusCode(err: unknown): number {
    if (err && typeof err === "object" && "statusCode" in err) {
        return (err as { statusCode: number }).statusCode;
    }
    return 400;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /bale-transfers/push
 * Packaging Store Manager pushes bales directly to Dispatch Store.
 */
export async function createPushTransferController(
    req: AuthenticatedRequest,
    res: Response
) {
    const parse = CreatePushTransferSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request payload", errors: parse.error.flatten() });
    }
    try {
        const transfer = await createPushTransfer(req.auth, parse.data);
        res.status(201).json({ success: true, transfer });
    } catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}

/**
 * POST /bale-transfers/pull
 * Dispatch Store Manager requests bales from Packaging Store.
 */
export async function createPullRequestController(
    req: AuthenticatedRequest,
    res: Response
) {
    const parse = CreatePullRequestSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request payload", errors: parse.error.flatten() });
    }
    try {
        const transfer = await createPullRequest(req.auth, parse.data);
        res.status(201).json({ success: true, transfer });
    } catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}

/**
 * GET /bale-transfers
 * List bale transfers (role-scoped).
 */
export async function listBaleTransfersController(
    req: AuthenticatedRequest,
    res: Response
) {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    try {
        const transfers = await listBaleTransfers(req.auth, { status });
        res.json({ transfers, role: req.auth.role });
    } catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}

/**
 * GET /bale-transfers/:id
 */
export async function getBaleTransferController(
    req: AuthenticatedRequest,
    res: Response
) {
    try {
        const transfer = await getBaleTransferById(req.auth, req.params.id);
        res.json({ transfer, role: req.auth.role });
    } catch (err) {
        const status = getStatusCode(err);
        res.status(status === 400 ? 404 : status).json({ message: err instanceof Error ? err.message : "Not found" });
    }
}

/**
 * POST /bale-transfers/:id/issue
 * Packaging Store Manager issues a pending pull request.
 */
export async function issuePullRequestController(
    req: AuthenticatedRequest,
    res: Response
) {
    const parse = IssueLinesSchema.safeParse(req.body ?? {});
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid issue payload", errors: parse.error.flatten() });
    }
    try {
        const transfer = await issuePullRequest(req.auth, req.params.id, parse.data.lines);
        res.json({ success: true, transfer });
    } catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}

/**
 * POST /bale-transfers/:id/reject
 * Packaging Store Manager rejects a pending pull request.
 */
export async function rejectPullRequestController(
    req: AuthenticatedRequest,
    res: Response
) {
    const parse = RejectSchema.safeParse(req.body ?? {});
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid reject payload", errors: parse.error.flatten() });
    }
    try {
        const transfer = await rejectPullRequest(req.auth, req.params.id, parse.data.rejectionReason);
        res.json({ success: true, transfer });
    } catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}

/**
 * POST /bale-transfers/:id/receive
 * Dispatch Store Manager acknowledges receipt of bales.
 */
export async function acknowledgeBaleReceiptController(
    req: AuthenticatedRequest,
    res: Response
) {
    const parse = ReceiveLinesSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid receipt payload", errors: parse.error.flatten() });
    }
    try {
        const transfer = await acknowledgeBaleReceipt(req.auth, req.params.id, parse.data.lines);
        res.json({ success: true, transfer });
    } catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}

/**
 * POST /bale-transfers/:id/reject-delivery
 * Dispatch Store Manager rejects an incoming bale delivery.
 */
export async function rejectBaleDeliveryController(
    req: AuthenticatedRequest,
    res: Response
) {
    const parse = RejectDeliverySchema.safeParse(req.body ?? {});
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid payload", errors: parse.error.flatten() });
    }
    try {
        const transfer = await rejectBaleDelivery(
            req.auth,
            req.params.id,
            parse.data.receiptRejectionReason
        );
        res.json({ success: true, transfer });
    } catch (err) {
        res.status(getStatusCode(err)).json({ message: err instanceof Error ? err.message : "Failed" });
    }
}

/**
 * GET /bale-transfers/bale-stock
 * Returns items that have been produced as packed bales in packaging runs,
 * with their current Packaging Store physical and transit quantities.
 * Used by the transfer form so only actual bale items are shown (not raw bags).
 */
export async function getBaleStockController(
    req: AuthenticatedRequest,
    res: Response
) {
    try {
        const stock = await getPackagingStoreBaleStock();
        res.json({ stock });
    } catch (err) {
        res.status(500).json({ message: err instanceof Error ? err.message : "Failed to load bale stock" });
    }
}
