/**
 * Bale Transfer Service
 *
 * Handles movement of packed flour bales from Packaging Store → Dispatch Store.
 *
 * Two workflows:
 *  - Push Transfer  : Packaging Store Manager directly dispatches bales
 *                     (status goes straight to APPROVED_IN_TRANSIT).
 *  - Pull Request   : Dispatch Store Manager requests bales (PENDING),
 *                     Packaging Store Manager reviews and issues them.
 *
 * Lifecycle recap:
 *   Pull:  PENDING → (issue) APPROVED_IN_TRANSIT → (receive) COMPLETED
 *                                                → (reject)  PENDING_CORRECTION → (re-issue) APPROVED_IN_TRANSIT
 *          PENDING → (reject) REJECTED
 *   Push:  created directly as APPROVED_IN_TRANSIT → (receive) COMPLETED
 *                                                   → (reject)  PENDING_CORRECTION → (re-issue) APPROVED_IN_TRANSIT
 */

import { Prisma, StockTransferStatus } from "@prisma/client";
import type { AccessTokenPayload } from "../auth/jwt";
import { prisma } from "../server";
import {
    assertIsPackagingStoreManager,
    assertIsDispatchStoreManager,
    assertIsBaleTransferParticipant,
    isGlobalInventoryAdmin,
} from "./store-rbac.service";
import { adjustStoreBalance, recordTransferMovement } from "./store-inventory.service";
import { ensureDefaultStores } from "./store-seed.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_STORE_CODE = "PACKAGING_STORE";
const DEST_STORE_CODE = "DISPATCH_STORE";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BaleTransferItem = {
    inventoryItemId: string;
    qtyRequested: number;
};

export type CreatePushTransferInput = {
    items: BaleTransferItem[];
    notes?: string;
};

export type CreatePullRequestInput = {
    items: BaleTransferItem[];
    notes?: string;
};

export type IssuePullRequestLineInput = {
    lineId: string;
    qtyIssued?: number;        // defaults to qtyRequested when omitted
    partialIssueReason?: string;
};

export type ReceiveBaleTransferLineInput = {
    lineId: string;
    qtyReceived: number;
};

// ─── Prisma include shape ────────────────────────────────────────────────────

const transferInclude = {
    sourceLocation: true,
    destinationLocation: true,
    requestedBy: { select: { id: true, name: true, email: true, role: true } },
    approvedBy: { select: { id: true, name: true, email: true, role: true } },
    receiptRejectedBy: { select: { id: true, name: true, email: true, role: true } },
    items: {
        include: {
            item: { select: { id: true, sku: true, name: true, unit: true } },
        },
    },
    discrepancies: true,
} satisfies Prisma.StockTransferRequestInclude;

function formatTransfer(
    row: Prisma.StockTransferRequestGetPayload<{ include: typeof transferInclude }>
) {
    return {
        ...row,
        items: row.items.map((line) => ({
            ...line,
            qtyRequested: Number(line.qtyRequested),
            qtyIssued: line.qtyIssued != null ? Number(line.qtyIssued) : null,
            qtyReceived: line.qtyReceived != null ? Number(line.qtyReceived) : null,
        })),
        discrepancies: row.discrepancies.map((d) => ({
            ...d,
            qtyIssued: Number(d.qtyIssued),
            qtyReceived: Number(d.qtyReceived),
            qtyShort: Number(d.qtyShort),
        })),
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getStoreLocationIds() {
    await ensureDefaultStores();
    const [src, dst] = await Promise.all([
        prisma.inventoryLocation.findUniqueOrThrow({ where: { code: SOURCE_STORE_CODE }, select: { id: true } }),
        prisma.inventoryLocation.findUniqueOrThrow({ where: { code: DEST_STORE_CODE }, select: { id: true } }),
    ]);
    return { sourceLocationId: src.id, destLocationId: dst.id };
}

async function nextRequestNumber(tx: Prisma.TransactionClient) {
    const prefix = `STR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const count = await tx.stockTransferRequest.count({
        where: { requestNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

/** Validate items array (duplicates, positive qty, item existence) */
async function validateItems(
    tx: Prisma.TransactionClient,
    items: BaleTransferItem[]
): Promise<void> {
    if (!items.length) {
        const err = new Error("At least one transfer item is required");
        Object.assign(err, { statusCode: 400 });
        throw err;
    }

    const seen = new Set<string>();
    for (const line of items) {
        if (!Number.isFinite(line.qtyRequested) || line.qtyRequested <= 0) {
            const err = new Error(
                `Quantity for item ${line.inventoryItemId} must be a positive number with at most 3 decimal places`
            );
            Object.assign(err, { statusCode: 400 });
            throw err;
        }

        // Max 3 decimal places
        const parts = line.qtyRequested.toString().split(".");
        if (parts[1] && parts[1].length > 3) {
            const err = new Error(
                `Quantity for item ${line.inventoryItemId} must have at most 3 decimal places`
            );
            Object.assign(err, { statusCode: 400 });
            throw err;
        }

        if (seen.has(line.inventoryItemId)) {
            const err = new Error(
                `Duplicate inventoryItemId "${line.inventoryItemId}" — each item may appear only once per transfer`
            );
            Object.assign(err, { statusCode: 400 });
            throw err;
        }
        seen.add(line.inventoryItemId);
    }

    // Check all items exist
    for (const line of items) {
        const exists = await tx.inventoryItem.findUnique({
            where: { id: line.inventoryItemId },
            select: { id: true },
        });
        if (!exists) {
            const err = new Error(`InventoryItem not found: ${line.inventoryItemId}`);
            Object.assign(err, { statusCode: 422 });
            throw err;
        }
    }
}

/** Retrieve a bale transfer that belongs to Packaging or Dispatch store */
async function getBaleTransfer(
    transferId: string,
    tx: Prisma.TransactionClient
) {
    const transfer = await tx.stockTransferRequest.findFirst({
        where: {
            id: transferId,
            OR: [
                { sourceLocation: { code: SOURCE_STORE_CODE } },
                { destinationLocation: { code: DEST_STORE_CODE } },
            ],
        },
        include: transferInclude,
    });
    if (!transfer) {
        const err = new Error("Bale transfer not found");
        Object.assign(err, { statusCode: 404 });
        throw err;
    }
    return transfer;
}

// ─── Push Transfer (Packaging → Dispatch, direct APPROVED_IN_TRANSIT) ────────

export async function createPushTransfer(
    auth: AccessTokenPayload,
    input: CreatePushTransferInput
) {
    assertIsPackagingStoreManager(auth.role);

    const { sourceLocationId, destLocationId } = await getStoreLocationIds();

    return prisma.$transaction(async (tx) => {
        await validateItems(tx, input.items);

        // Check Packaging Store has enough physical stock for each item
        for (const line of input.items) {
            const balance = await tx.storeInventoryBalance.findUnique({
                where: { itemId_locationId: { itemId: line.inventoryItemId, locationId: sourceLocationId } },
                select: { physicalQty: true },
            });
            const available = balance ? Number(balance.physicalQty) : 0;

            if (available <= 0) {
                const item = await tx.inventoryItem.findUnique({
                    where: { id: line.inventoryItemId },
                    select: { name: true, sku: true },
                });
                const err = new Error(
                    `No stock available in Packaging Store for "${item?.name ?? line.inventoryItemId}" (${item?.sku ?? ""}).`
                );
                Object.assign(err, { statusCode: 422 });
                throw err;
            }
            if (line.qtyRequested > available + 0.0005) {
                const item = await tx.inventoryItem.findUnique({
                    where: { id: line.inventoryItemId },
                    select: { name: true, sku: true },
                });
                const err = new Error(
                    `Insufficient stock in Packaging Store for "${item?.name ?? line.inventoryItemId}". ` +
                    `Requested: ${line.qtyRequested.toFixed(3)}, available: ${available.toFixed(3)}.`
                );
                Object.assign(err, { statusCode: 422 });
                throw err;
            }
        }

        const requestNumber = await nextRequestNumber(tx);

        const transfer = await tx.stockTransferRequest.create({
            data: {
                requestNumber,
                sourceLocationId,
                destinationLocationId: destLocationId,
                requestedByUserId: auth.userId,
                approvedByUserId: auth.userId,
                status: "APPROVED_IN_TRANSIT",
                approvedAt: new Date(),
                notes: input.notes?.trim() || null,
                items: {
                    create: input.items.map((line) => ({
                        itemId: line.inventoryItemId,
                        qtyRequested: line.qtyRequested.toFixed(3),
                        qtyIssued: line.qtyRequested.toFixed(3),
                    })),
                },
            },
            include: transferInclude,
        });

        // Adjust balances: deduct physicalQty from Packaging Store, add transitQty to Dispatch Store
        for (const line of input.items) {
            await adjustStoreBalance(tx, {
                itemId: line.inventoryItemId,
                locationId: sourceLocationId,
                physicalDelta: -line.qtyRequested,
            });
            await adjustStoreBalance(tx, {
                itemId: line.inventoryItemId,
                locationId: destLocationId,
                transitDelta: line.qtyRequested,
            });
            await recordTransferMovement(tx, {
                itemId: line.inventoryItemId,
                locationId: sourceLocationId,
                quantityDelta: -line.qtyRequested,
                movementType: "ADJUSTMENT",
                stockTransferRequestId: transfer.id,
                notes: `Push transfer ${requestNumber} from ${SOURCE_STORE_CODE}`,
            });
        }

        return formatTransfer(transfer);
    });
}

// ─── Pull Request (Dispatch requests from Packaging, PENDING) ─────────────────

export async function createPullRequest(
    auth: AccessTokenPayload,
    input: CreatePullRequestInput
) {
    assertIsDispatchStoreManager(auth.role);

    const { sourceLocationId, destLocationId } = await getStoreLocationIds();

    return prisma.$transaction(async (tx) => {
        await validateItems(tx, input.items);

        const requestNumber = await nextRequestNumber(tx);

        const transfer = await tx.stockTransferRequest.create({
            data: {
                requestNumber,
                sourceLocationId,
                destinationLocationId: destLocationId,
                requestedByUserId: auth.userId,
                status: "PENDING",
                notes: input.notes?.trim() || null,
                items: {
                    create: input.items.map((line) => ({
                        itemId: line.inventoryItemId,
                        qtyRequested: line.qtyRequested.toFixed(3),
                    })),
                },
            },
            include: transferInclude,
        });

        // No inventory adjustment on pull request creation — deferred to issuance.
        return formatTransfer(transfer);
    });
}

// ─── Issue a Pull Request (Packaging Store Manager approves & sends) ──────────

export async function issuePullRequest(
    auth: AccessTokenPayload,
    transferId: string,
    lines?: IssuePullRequestLineInput[]
) {
    assertIsPackagingStoreManager(auth.role);

    const { sourceLocationId, destLocationId } = await getStoreLocationIds();

    return prisma.$transaction(async (tx) => {
        const transfer = await getBaleTransfer(transferId, tx);

        if (transfer.status !== "PENDING" && transfer.status !== "PENDING_CORRECTION") {
            const err = new Error(`Cannot issue transfer in status "${transfer.status}"`);
            Object.assign(err, { statusCode: 422 });
            throw err;
        }

        const issueMap = new Map((lines ?? []).map((l) => [l.lineId, l]));

        for (const line of transfer.items) {
            const qtyRequested = Number(line.qtyRequested);
            const override = issueMap.get(line.id);
            const qtyIssued = override?.qtyIssued ?? qtyRequested;
            const partialReason = override?.partialIssueReason;

            if (!Number.isFinite(qtyIssued) || qtyIssued <= 0) {
                const err = new Error(
                    `Issued quantity for "${line.item.sku}" must be greater than zero`
                );
                Object.assign(err, { statusCode: 422 });
                throw err;
            }
            if (qtyIssued > qtyRequested + 0.0005) {
                const err = new Error(
                    `Issued quantity (${qtyIssued}) cannot exceed requested quantity (${qtyRequested}) for "${line.item.sku}"`
                );
                Object.assign(err, { statusCode: 422 });
                throw err;
            }

            const isPartial = qtyIssued < qtyRequested - 0.0005;
            if (isPartial && !partialReason?.trim()) {
                const err = new Error(
                    `A partialIssueReason is required when issuing less than requested for "${line.item.sku}" ` +
                    `(requested: ${qtyRequested}, issuing: ${qtyIssued})`
                );
                Object.assign(err, { statusCode: 422 });
                throw err;
            }

            // Check Packaging Store balance
            const balance = await tx.storeInventoryBalance.findUnique({
                where: { itemId_locationId: { itemId: line.itemId, locationId: sourceLocationId } },
                select: { physicalQty: true },
            });
            const available = balance ? Number(balance.physicalQty) : 0;
            if (qtyIssued > available + 0.0005) {
                const err = new Error(
                    `Insufficient stock in Packaging Store for "${line.item.name}". ` +
                    `Issuing: ${qtyIssued.toFixed(3)}, available: ${available.toFixed(3)}.`
                );
                Object.assign(err, { statusCode: 422 });
                throw err;
            }

            await adjustStoreBalance(tx, {
                itemId: line.itemId,
                locationId: sourceLocationId,
                physicalDelta: -qtyIssued,
            });
            await adjustStoreBalance(tx, {
                itemId: line.itemId,
                locationId: destLocationId,
                transitDelta: qtyIssued,
            });
            await recordTransferMovement(tx, {
                itemId: line.itemId,
                locationId: sourceLocationId,
                quantityDelta: -qtyIssued,
                movementType: "ADJUSTMENT",
                stockTransferRequestId: transfer.id,
                notes: `Issue ${transfer.requestNumber} from ${SOURCE_STORE_CODE}`,
            });

            await tx.stockTransferItem.update({
                where: { id: line.id },
                data: {
                    qtyIssued: qtyIssued.toFixed(3),
                    partialIssueReason: isPartial ? partialReason!.trim() : null,
                    qtyReceived: null,
                    discrepancyNote: null,
                },
            });
        }

        const updated = await tx.stockTransferRequest.update({
            where: { id: transfer.id },
            data: {
                status: "APPROVED_IN_TRANSIT",
                approvedByUserId: auth.userId,
                approvedAt: new Date(),
                receiptRejectionReason: null,
                receiptRejectedByUserId: null,
                receiptRejectedAt: null,
            },
            include: transferInclude,
        });

        return formatTransfer(updated);
    });
}

// ─── Reject a Pull Request (Packaging Store Manager declines) ─────────────────

export async function rejectPullRequest(
    auth: AccessTokenPayload,
    transferId: string,
    rejectionReason: string
) {
    assertIsPackagingStoreManager(auth.role);

    const reason = rejectionReason?.trim();
    if (!reason) {
        const err = new Error("A rejectionReason is required");
        Object.assign(err, { statusCode: 422 });
        throw err;
    }

    return prisma.$transaction(async (tx) => {
        const transfer = await getBaleTransfer(transferId, tx);

        if (transfer.status !== "PENDING") {
            const err = new Error(`Cannot reject transfer in status "${transfer.status}"`);
            Object.assign(err, { statusCode: 422 });
            throw err;
        }

        const updated = await tx.stockTransferRequest.update({
            where: { id: transfer.id },
            data: {
                status: "REJECTED",
                rejectionReason: reason,
                approvedByUserId: auth.userId,
            },
            include: transferInclude,
        });

        return formatTransfer(updated);
    });
}

// ─── Acknowledge Receipt (Dispatch Store Manager confirms) ────────────────────

export async function acknowledgeBaleReceipt(
    auth: AccessTokenPayload,
    transferId: string,
    lines: ReceiveBaleTransferLineInput[]
) {
    assertIsDispatchStoreManager(auth.role);

    const { sourceLocationId, destLocationId } = await getStoreLocationIds();

    return prisma.$transaction(async (tx) => {
        const transfer = await getBaleTransfer(transferId, tx);

        if (transfer.status !== "APPROVED_IN_TRANSIT") {
            const err = new Error(`Cannot acknowledge receipt for transfer in status "${transfer.status}"`);
            Object.assign(err, { statusCode: 422 });
            throw err;
        }

        if (!lines.length) {
            const err = new Error("At least one receipt line is required");
            Object.assign(err, { statusCode: 400 });
            throw err;
        }

        const receiveMap = new Map(lines.map((l) => [l.lineId, l.qtyReceived]));

        for (const line of transfer.items) {
            const qtyIssued = line.qtyIssued != null ? Number(line.qtyIssued) : null;
            if (qtyIssued == null) {
                const err = new Error(`Line ${line.id} has not been issued yet`);
                Object.assign(err, { statusCode: 422 });
                throw err;
            }

            const qtyReceived = receiveMap.get(line.id);
            if (qtyReceived == null) {
                const err = new Error(`Missing received quantity for line ${line.id}`);
                Object.assign(err, { statusCode: 400 });
                throw err;
            }
            if (!Number.isFinite(qtyReceived) || qtyReceived <= 0) {
                const err = new Error(
                    `Received quantity for "${line.item.name}" must be a positive number; got ${qtyReceived}`
                );
                Object.assign(err, { statusCode: 422 });
                throw err;
            }
            if (qtyReceived > qtyIssued + 0.0005) {
                const err = new Error(
                    `Received quantity (${qtyReceived}) cannot exceed issued quantity (${qtyIssued}) for "${line.item.name}"`
                );
                Object.assign(err, { statusCode: 422 });
                throw err;
            }

            // Transit → Physical at Dispatch Store
            await adjustStoreBalance(tx, {
                itemId: line.itemId,
                locationId: destLocationId,
                transitDelta: -qtyIssued,
                physicalDelta: qtyReceived,
            });

            // Log discrepancy if short
            if (qtyReceived + 0.0005 < qtyIssued) {
                const qtyShort = qtyIssued - qtyReceived;

                await tx.stockTransferDiscrepancy.deleteMany({
                    where: { transferId: transfer.id, itemId: line.itemId },
                });
                await tx.stockTransferDiscrepancy.create({
                    data: {
                        transferId: transfer.id,
                        itemId: line.itemId,
                        qtyIssued: qtyIssued.toFixed(3),
                        qtyReceived: qtyReceived.toFixed(3),
                        qtyShort: qtyShort.toFixed(3),
                        notedByUserId: auth.userId,
                    },
                });
                await tx.stockTransferItem.update({
                    where: { id: line.id },
                    data: {
                        qtyReceived: qtyReceived.toFixed(3),
                        discrepancyNote: `Short receipt: issued ${qtyIssued}, received ${qtyReceived}`,
                    },
                });
            } else {
                await tx.stockTransferItem.update({
                    where: { id: line.id },
                    data: { qtyReceived: qtyReceived.toFixed(3) },
                });
            }

            if (qtyReceived > 0) {
                await recordTransferMovement(tx, {
                    itemId: line.itemId,
                    locationId: destLocationId,
                    quantityDelta: qtyReceived,
                    movementType: "RECEIPT",
                    stockTransferRequestId: transfer.id,
                    notes: `Receipt ${transfer.requestNumber} at ${DEST_STORE_CODE}`,
                });
            }
        }

        const updated = await tx.stockTransferRequest.update({
            where: { id: transfer.id },
            data: { status: "COMPLETED", completedAt: new Date() },
            include: transferInclude,
        });

        return formatTransfer(updated);
    });
}

// ─── Reject Delivery (Dispatch Store Manager rejects incoming bales) ──────────

export async function rejectBaleDelivery(
    auth: AccessTokenPayload,
    transferId: string,
    receiptRejectionReason: string
) {
    assertIsDispatchStoreManager(auth.role);

    const reason = receiptRejectionReason?.trim();
    if (!reason) {
        const err = new Error("A receiptRejectionReason is required when rejecting a delivery");
        Object.assign(err, { statusCode: 422 });
        throw err;
    }

    const { sourceLocationId, destLocationId } = await getStoreLocationIds();

    return prisma.$transaction(async (tx) => {
        const transfer = await getBaleTransfer(transferId, tx);

        if (transfer.status !== "APPROVED_IN_TRANSIT") {
            const err = new Error(`Cannot reject delivery in status "${transfer.status}"`);
            Object.assign(err, { statusCode: 422 });
            throw err;
        }

        // Reverse: remove transitQty from Dispatch Store, restore physicalQty to Packaging Store
        for (const line of transfer.items) {
            const qtyIssued = line.qtyIssued != null ? Number(line.qtyIssued) : null;
            if (qtyIssued == null) continue;

            await adjustStoreBalance(tx, {
                itemId: line.itemId,
                locationId: destLocationId,
                transitDelta: -qtyIssued,
            });
            await adjustStoreBalance(tx, {
                itemId: line.itemId,
                locationId: sourceLocationId,
                physicalDelta: qtyIssued,
            });
            await recordTransferMovement(tx, {
                itemId: line.itemId,
                locationId: sourceLocationId,
                quantityDelta: qtyIssued,
                movementType: "ADJUSTMENT",
                stockTransferRequestId: transfer.id,
                notes: `Delivery rejected — ${transfer.requestNumber} returned to ${SOURCE_STORE_CODE}: ${reason}`,
            });
        }

        const updated = await tx.stockTransferRequest.update({
            where: { id: transfer.id },
            data: {
                status: "PENDING_CORRECTION",
                receiptRejectionReason: reason,
                receiptRejectedByUserId: auth.userId,
                receiptRejectedAt: new Date(),
            },
            include: transferInclude,
        });

        return formatTransfer(updated);
    });
}

// ─── List Bale Transfers ──────────────────────────────────────────────────────

const VALID_STATUSES = new Set<string>([
    "PENDING",
    "APPROVED_IN_TRANSIT",
    "COMPLETED",
    "REJECTED",
    "PENDING_CORRECTION",
]);

export async function listBaleTransfers(
    auth: AccessTokenPayload,
    query?: { status?: string }
) {
    assertIsBaleTransferParticipant(auth.role);

    if (query?.status && !VALID_STATUSES.has(query.status)) {
        const err = new Error(
            `Invalid status "${query.status}". Valid values: ${[...VALID_STATUSES].join(", ")}`
        );
        Object.assign(err, { statusCode: 400 });
        throw err;
    }

    await ensureDefaultStores();

    const { sourceLocationId, destLocationId } = await getStoreLocationIds();

    // Scope visibility: Packaging sees both sides, Dispatch sees both sides, Admin sees all
    let locationFilter: Prisma.StockTransferRequestWhereInput;

    if (isGlobalInventoryAdmin(auth.role)) {
        // Admin: no location restriction, but only Packaging↔Dispatch transfers
        locationFilter = {
            sourceLocationId,
            destinationLocationId: destLocationId,
        };
    } else if (auth.role === "PACKAGING_STORE_MANAGER") {
        locationFilter = {
            OR: [
                { sourceLocationId },
                { destinationLocationId: sourceLocationId },
            ],
        };
    } else {
        // DISPATCH_STORE_MANAGER
        locationFilter = {
            OR: [
                { destinationLocationId: destLocationId },
                { sourceLocationId: destLocationId },
            ],
        };
    }

    const transfers = await prisma.stockTransferRequest.findMany({
        where: {
            ...locationFilter,
            ...(query?.status ? { status: query.status as StockTransferStatus } : {}),
        },
        include: transferInclude,
        orderBy: { createdAt: "desc" },
        take: 200,
    });

    return transfers.map(formatTransfer);
}

// ─── Get Bale Stock (items with packed bale balances in Packaging Store) ───────

export async function getPackagingStoreBaleStock() {
    await ensureDefaultStores();

    const src = await prisma.inventoryLocation.findUniqueOrThrow({
        where: { code: SOURCE_STORE_CODE },
        select: { id: true },
    });

    // Items that have ever been produced as a packaging run output
    // (these are the only items meaningful to bale transfer — not raw bags)
    const outputItems = await prisma.packagingRunFinishedProductOutput.findMany({
        where: { inventoryItemId: { not: null } },
        select: { inventoryItemId: true },
        distinct: ["inventoryItemId"],
    });

    const baleItemIds = outputItems
        .map((r) => r.inventoryItemId)
        .filter((id): id is string => id !== null);

    if (baleItemIds.length === 0) return [];

    // Get current Packaging Store balances for those items
    const balances = await prisma.storeInventoryBalance.findMany({
        where: {
            locationId: src.id,
            itemId: { in: baleItemIds },
        },
        include: {
            item: { select: { id: true, sku: true, name: true, unit: true, type: true } },
        },
    });

    return balances.map((b) => ({
        inventoryItemId: b.itemId,
        sku: b.item.sku,
        name: b.item.name,
        unit: b.item.unit,
        type: b.item.type,
        physicalQty: Number(b.physicalQty),
        transitQty: Number(b.transitQty),
    }));
}

export async function getBaleTransferById(
    auth: AccessTokenPayload,
    transferId: string
) {
    assertIsBaleTransferParticipant(auth.role);
    await ensureDefaultStores();

    return prisma.$transaction(async (tx) => {
        const transfer = await getBaleTransfer(transferId, tx);
        return formatTransfer(transfer);
    });
}
