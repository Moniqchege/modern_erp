"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPushTransfer = createPushTransfer;
exports.createPullRequest = createPullRequest;
exports.issuePullRequest = issuePullRequest;
exports.rejectPullRequest = rejectPullRequest;
exports.acknowledgeBaleReceipt = acknowledgeBaleReceipt;
exports.rejectBaleDelivery = rejectBaleDelivery;
exports.listBaleTransfers = listBaleTransfers;
exports.getBaleTransferById = getBaleTransferById;
const server_1 = require("../server");
const store_rbac_service_1 = require("./store-rbac.service");
const store_inventory_service_1 = require("./store-inventory.service");
const store_seed_service_1 = require("./store-seed.service");
// ─── Constants ────────────────────────────────────────────────────────────────
const SOURCE_STORE_CODE = "PACKAGING_STORE";
const DEST_STORE_CODE = "DISPATCH_STORE";
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
};
function formatTransfer(row) {
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
    await (0, store_seed_service_1.ensureDefaultStores)();
    const [src, dst] = await Promise.all([
        server_1.prisma.inventoryLocation.findUniqueOrThrow({ where: { code: SOURCE_STORE_CODE }, select: { id: true } }),
        server_1.prisma.inventoryLocation.findUniqueOrThrow({ where: { code: DEST_STORE_CODE }, select: { id: true } }),
    ]);
    return { sourceLocationId: src.id, destLocationId: dst.id };
}
async function nextRequestNumber(tx) {
    const prefix = `STR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const count = await tx.stockTransferRequest.count({
        where: { requestNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}
/** Validate items array (duplicates, positive qty, item existence) */
async function validateItems(tx, items) {
    if (!items.length) {
        const err = new Error("At least one transfer item is required");
        Object.assign(err, { statusCode: 400 });
        throw err;
    }
    const seen = new Set();
    for (const line of items) {
        if (!Number.isFinite(line.qtyRequested) || line.qtyRequested <= 0) {
            const err = new Error(`Quantity for item ${line.inventoryItemId} must be a positive number with at most 3 decimal places`);
            Object.assign(err, { statusCode: 400 });
            throw err;
        }
        // Max 3 decimal places
        const parts = line.qtyRequested.toString().split(".");
        if (parts[1] && parts[1].length > 3) {
            const err = new Error(`Quantity for item ${line.inventoryItemId} must have at most 3 decimal places`);
            Object.assign(err, { statusCode: 400 });
            throw err;
        }
        if (seen.has(line.inventoryItemId)) {
            const err = new Error(`Duplicate inventoryItemId "${line.inventoryItemId}" — each item may appear only once per transfer`);
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
async function getBaleTransfer(transferId, tx) {
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
async function createPushTransfer(auth, input) {
    (0, store_rbac_service_1.assertIsPackagingStoreManager)(auth.role);
    const { sourceLocationId, destLocationId } = await getStoreLocationIds();
    return server_1.prisma.$transaction(async (tx) => {
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
                const err = new Error(`No stock available in Packaging Store for "${item?.name ?? line.inventoryItemId}" (${item?.sku ?? ""}).`);
                Object.assign(err, { statusCode: 422 });
                throw err;
            }
            if (line.qtyRequested > available + 0.0005) {
                const item = await tx.inventoryItem.findUnique({
                    where: { id: line.inventoryItemId },
                    select: { name: true, sku: true },
                });
                const err = new Error(`Insufficient stock in Packaging Store for "${item?.name ?? line.inventoryItemId}". ` +
                    `Requested: ${line.qtyRequested.toFixed(3)}, available: ${available.toFixed(3)}.`);
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
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                itemId: line.inventoryItemId,
                locationId: sourceLocationId,
                physicalDelta: -line.qtyRequested,
            });
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                itemId: line.inventoryItemId,
                locationId: destLocationId,
                transitDelta: line.qtyRequested,
            });
            await (0, store_inventory_service_1.recordTransferMovement)(tx, {
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
async function createPullRequest(auth, input) {
    (0, store_rbac_service_1.assertIsDispatchStoreManager)(auth.role);
    const { sourceLocationId, destLocationId } = await getStoreLocationIds();
    return server_1.prisma.$transaction(async (tx) => {
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
async function issuePullRequest(auth, transferId, lines) {
    (0, store_rbac_service_1.assertIsPackagingStoreManager)(auth.role);
    const { sourceLocationId, destLocationId } = await getStoreLocationIds();
    return server_1.prisma.$transaction(async (tx) => {
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
                const err = new Error(`Issued quantity for "${line.item.sku}" must be greater than zero`);
                Object.assign(err, { statusCode: 422 });
                throw err;
            }
            if (qtyIssued > qtyRequested + 0.0005) {
                const err = new Error(`Issued quantity (${qtyIssued}) cannot exceed requested quantity (${qtyRequested}) for "${line.item.sku}"`);
                Object.assign(err, { statusCode: 422 });
                throw err;
            }
            const isPartial = qtyIssued < qtyRequested - 0.0005;
            if (isPartial && !partialReason?.trim()) {
                const err = new Error(`A partialIssueReason is required when issuing less than requested for "${line.item.sku}" ` +
                    `(requested: ${qtyRequested}, issuing: ${qtyIssued})`);
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
                const err = new Error(`Insufficient stock in Packaging Store for "${line.item.name}". ` +
                    `Issuing: ${qtyIssued.toFixed(3)}, available: ${available.toFixed(3)}.`);
                Object.assign(err, { statusCode: 422 });
                throw err;
            }
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                itemId: line.itemId,
                locationId: sourceLocationId,
                physicalDelta: -qtyIssued,
            });
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                itemId: line.itemId,
                locationId: destLocationId,
                transitDelta: qtyIssued,
            });
            await (0, store_inventory_service_1.recordTransferMovement)(tx, {
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
                    partialIssueReason: isPartial ? partialReason.trim() : null,
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
async function rejectPullRequest(auth, transferId, rejectionReason) {
    (0, store_rbac_service_1.assertIsPackagingStoreManager)(auth.role);
    const reason = rejectionReason?.trim();
    if (!reason) {
        const err = new Error("A rejectionReason is required");
        Object.assign(err, { statusCode: 422 });
        throw err;
    }
    return server_1.prisma.$transaction(async (tx) => {
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
async function acknowledgeBaleReceipt(auth, transferId, lines) {
    (0, store_rbac_service_1.assertIsDispatchStoreManager)(auth.role);
    const { sourceLocationId, destLocationId } = await getStoreLocationIds();
    return server_1.prisma.$transaction(async (tx) => {
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
                const err = new Error(`Received quantity for "${line.item.name}" must be a positive number; got ${qtyReceived}`);
                Object.assign(err, { statusCode: 422 });
                throw err;
            }
            if (qtyReceived > qtyIssued + 0.0005) {
                const err = new Error(`Received quantity (${qtyReceived}) cannot exceed issued quantity (${qtyIssued}) for "${line.item.name}"`);
                Object.assign(err, { statusCode: 422 });
                throw err;
            }
            // Transit → Physical at Dispatch Store
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
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
            }
            else {
                await tx.stockTransferItem.update({
                    where: { id: line.id },
                    data: { qtyReceived: qtyReceived.toFixed(3) },
                });
            }
            if (qtyReceived > 0) {
                await (0, store_inventory_service_1.recordTransferMovement)(tx, {
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
async function rejectBaleDelivery(auth, transferId, receiptRejectionReason) {
    (0, store_rbac_service_1.assertIsDispatchStoreManager)(auth.role);
    const reason = receiptRejectionReason?.trim();
    if (!reason) {
        const err = new Error("A receiptRejectionReason is required when rejecting a delivery");
        Object.assign(err, { statusCode: 422 });
        throw err;
    }
    const { sourceLocationId, destLocationId } = await getStoreLocationIds();
    return server_1.prisma.$transaction(async (tx) => {
        const transfer = await getBaleTransfer(transferId, tx);
        if (transfer.status !== "APPROVED_IN_TRANSIT") {
            const err = new Error(`Cannot reject delivery in status "${transfer.status}"`);
            Object.assign(err, { statusCode: 422 });
            throw err;
        }
        // Reverse: remove transitQty from Dispatch Store, restore physicalQty to Packaging Store
        for (const line of transfer.items) {
            const qtyIssued = line.qtyIssued != null ? Number(line.qtyIssued) : null;
            if (qtyIssued == null)
                continue;
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                itemId: line.itemId,
                locationId: destLocationId,
                transitDelta: -qtyIssued,
            });
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                itemId: line.itemId,
                locationId: sourceLocationId,
                physicalDelta: qtyIssued,
            });
            await (0, store_inventory_service_1.recordTransferMovement)(tx, {
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
const VALID_STATUSES = new Set([
    "PENDING",
    "APPROVED_IN_TRANSIT",
    "COMPLETED",
    "REJECTED",
    "PENDING_CORRECTION",
]);
async function listBaleTransfers(auth, query) {
    (0, store_rbac_service_1.assertIsBaleTransferParticipant)(auth.role);
    if (query?.status && !VALID_STATUSES.has(query.status)) {
        const err = new Error(`Invalid status "${query.status}". Valid values: ${[...VALID_STATUSES].join(", ")}`);
        Object.assign(err, { statusCode: 400 });
        throw err;
    }
    await (0, store_seed_service_1.ensureDefaultStores)();
    const { sourceLocationId, destLocationId } = await getStoreLocationIds();
    // Scope visibility: Packaging sees both sides, Dispatch sees both sides, Admin sees all
    let locationFilter;
    if ((0, store_rbac_service_1.isGlobalInventoryAdmin)(auth.role)) {
        // Admin: no location restriction, but only Packaging↔Dispatch transfers
        locationFilter = {
            sourceLocationId,
            destinationLocationId: destLocationId,
        };
    }
    else if (auth.role === "PACKAGING_STORE_MANAGER") {
        locationFilter = {
            OR: [
                { sourceLocationId },
                { destinationLocationId: sourceLocationId },
            ],
        };
    }
    else {
        // DISPATCH_STORE_MANAGER
        locationFilter = {
            OR: [
                { destinationLocationId: destLocationId },
                { sourceLocationId: destLocationId },
            ],
        };
    }
    const transfers = await server_1.prisma.stockTransferRequest.findMany({
        where: {
            ...locationFilter,
            ...(query?.status ? { status: query.status } : {}),
        },
        include: transferInclude,
        orderBy: { createdAt: "desc" },
        take: 200,
    });
    return transfers.map(formatTransfer);
}
// ─── Get Single Bale Transfer ─────────────────────────────────────────────────
async function getBaleTransferById(auth, transferId) {
    (0, store_rbac_service_1.assertIsBaleTransferParticipant)(auth.role);
    await (0, store_seed_service_1.ensureDefaultStores)();
    return server_1.prisma.$transaction(async (tx) => {
        const transfer = await getBaleTransfer(transferId, tx);
        return formatTransfer(transfer);
    });
}
