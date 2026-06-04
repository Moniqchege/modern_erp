"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStockTransferRequest = createStockTransferRequest;
exports.approveAndIssueStockTransfer = approveAndIssueStockTransfer;
exports.acknowledgeStockTransferReceipt = acknowledgeStockTransferReceipt;
exports.rejectStockTransferReceipt = rejectStockTransferReceipt;
exports.rejectStockTransferRequest = rejectStockTransferRequest;
exports.listStockTransferRequests = listStockTransferRequests;
exports.getStockTransferRequest = getStockTransferRequest;
exports.listStoreInventoryBalances = listStoreInventoryBalances;
const server_1 = require("../server");
const store_rbac_service_1 = require("./store-rbac.service");
const store_inventory_service_1 = require("./store-inventory.service");
const store_seed_service_1 = require("./store-seed.service");
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
async function nextRequestNumber(tx) {
    const prefix = `STR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const count = await tx.stockTransferRequest.count({
        where: { requestNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}
async function getTransferForUser(transferId, auth, tx = server_1.prisma) {
    const visibility = (0, store_rbac_service_1.stockTransferVisibilityFilter)(auth);
    const transfer = await tx.stockTransferRequest.findFirst({
        where: { id: transferId, ...visibility },
        include: transferInclude,
    });
    if (!transfer)
        throw new Error("Stock transfer request not found");
    return transfer;
}
// ─────────────────────────────────────────────────────────────────────────────
// CREATE REQUEST  PENDING
// ─────────────────────────────────────────────────────────────────────────────
async function createStockTransferRequest(auth, input) {
    await (0, store_seed_service_1.ensureDefaultStores)();
    if (input.sourceStoreCode === input.destinationStoreCode) {
        throw new Error("Source and destination stores must differ");
    }
    if (!input.items.length) {
        throw new Error("At least one line item is required");
    }
    (0, store_rbac_service_1.assertCanCreateRequest)(auth.role, input.destinationStoreCode);
    for (const line of input.items) {
        if (!Number.isFinite(line.qtyRequested) || line.qtyRequested <= 0) {
            throw new Error("Each requested quantity must be greater than zero");
        }
    }
    const sourceLocationId = await (0, store_seed_service_1.getLocationIdByCode)(input.sourceStoreCode);
    const destinationLocationId = await (0, store_seed_service_1.getLocationIdByCode)(input.destinationStoreCode);
    return server_1.prisma.$transaction(async (tx) => {
        for (const line of input.items) {
            const item = await tx.inventoryItem.findUnique({
                where: { id: line.itemId },
            });
            if (!item)
                throw new Error(`Inventory item not found: ${line.itemId}`);
        }
        const requestNumber = await nextRequestNumber(tx);
        const transfer = await tx.stockTransferRequest.create({
            data: {
                requestNumber,
                sourceLocationId,
                destinationLocationId,
                requestedByUserId: auth.userId,
                status: "PENDING",
                notes: input.notes?.trim() || null,
                items: {
                    create: input.items.map((line) => ({
                        itemId: line.itemId,
                        qtyRequested: line.qtyRequested.toFixed(3),
                    })),
                },
            },
            include: transferInclude,
        });
        return formatTransfer(transfer);
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// APPROVE & ISSUE  APPROVED_IN_TRANSIT
//
// The main store manager specifies how much of each line they can actually
// issue. Partial quantities (qtyIssued < qtyRequested) are allowed — the
// issued amount is what gets deducted from main store inventory and put
// in-transit to the destination. The requesting store manager can see
// qtyRequested vs qtyIssued on the transfer.
// ─────────────────────────────────────────────────────────────────────────────
async function approveAndIssueStockTransfer(auth, transferId, lines) {
    (0, store_rbac_service_1.assertCanApproveIssue)(auth.role);
    await (0, store_seed_service_1.ensureDefaultStores)();
    return server_1.prisma.$transaction(async (tx) => {
        const transfer = await getTransferForUser(transferId, auth, tx);
        // Allow re-issuing a transfer that came back from receipt rejection
        if (transfer.status !== "PENDING" &&
            transfer.status !== "PENDING_CORRECTION") {
            throw new Error(`Cannot issue transfer in status ${transfer.status}`);
        }
        const issueByLineId = new Map((lines ?? []).map((l) => [l.lineId, l]));
        for (const line of transfer.items) {
            const qtyRequested = Number(line.qtyRequested);
            const qtyIssued = issueByLineId.get(line.id)?.qtyIssued ?? qtyRequested;
            const partialIssueReason = issueByLineId.get(line.id)?.partialIssueReason;
            if (!Number.isFinite(qtyIssued) || qtyIssued <= 0) {
                throw new Error(`Issued quantity for ${line.item.sku} must be greater than zero`);
            }
            if (qtyIssued > qtyRequested + 0.0005) {
                throw new Error(`Issued quantity (${qtyIssued}) cannot exceed requested quantity (${qtyRequested}) for ${line.item.sku}`);
            }
            // When issuing less than requested, a reason is mandatory so the
            // receiving store knows why they are getting a short delivery.
            const isPartial = qtyIssued < qtyRequested - 0.0005;
            if (isPartial && !partialIssueReason?.trim()) {
                throw new Error(`A reason is required when issuing less than the requested quantity for ${line.item.sku} ` +
                    `(requested: ${qtyRequested}, issuing: ${qtyIssued})`);
            }
            // Deduct from source (main store) physical inventory
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                itemId: line.itemId,
                locationId: transfer.sourceLocationId,
                physicalDelta: -qtyIssued,
            });
            // Place in-transit at destination
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                itemId: line.itemId,
                locationId: transfer.destinationLocationId,
                transitDelta: qtyIssued,
            });
            await (0, store_inventory_service_1.recordTransferMovement)(tx, {
                itemId: line.itemId,
                locationId: transfer.sourceLocationId,
                quantityDelta: -qtyIssued,
                movementType: "ADJUSTMENT",
                stockTransferRequestId: transfer.id,
                notes: `Issue ${transfer.requestNumber} from ${transfer.sourceLocation.code}`,
            });
            await tx.stockTransferItem.update({
                where: { id: line.id },
                data: {
                    qtyIssued: qtyIssued.toFixed(3),
                    partialIssueReason: isPartial ? partialIssueReason.trim() : null,
                    // Clear any previous received qty and discrepancy note on re-issue
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
                // Clear receipt rejection fields on re-issue
                receiptRejectionReason: null,
                receiptRejectedByUserId: null,
                receiptRejectedAt: null,
            },
            include: transferInclude,
        });
        return formatTransfer(updated);
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// ACKNOWLEDGE RECEIPT  COMPLETED
//
// The receiving store manager records how much they actually received.
// If quantity received differs from what was issued the discrepancy is logged,
// but the transfer still completes. To dispute the transfer entirely, use
// rejectReceipt instead.
// ─────────────────────────────────────────────────────────────────────────────
async function acknowledgeStockTransferReceipt(auth, transferId, lines) {
    await (0, store_seed_service_1.ensureDefaultStores)();
    return server_1.prisma.$transaction(async (tx) => {
        const transfer = await getTransferForUser(transferId, auth, tx);
        (0, store_rbac_service_1.assertCanAcknowledgeReceipt)(auth.role, transfer.destinationLocation.code);
        if (transfer.status !== "APPROVED_IN_TRANSIT") {
            throw new Error(`Cannot receive transfer in status ${transfer.status}`);
        }
        if (!lines.length) {
            throw new Error("Receipt lines are required");
        }
        const receiveByLineId = new Map(lines.map((l) => [l.lineId, l.qtyReceived]));
        for (const line of transfer.items) {
            const qtyIssued = line.qtyIssued != null ? Number(line.qtyIssued) : null;
            if (qtyIssued == null) {
                throw new Error(`Line ${line.id} was not issued`);
            }
            const qtyReceived = receiveByLineId.get(line.id);
            if (qtyReceived == null) {
                throw new Error(`Missing received quantity for line ${line.id}`);
            }
            if (!Number.isFinite(qtyReceived) || qtyReceived < 0) {
                throw new Error("Received quantity must be zero or greater");
            }
            if (qtyReceived > qtyIssued + 0.0005) {
                throw new Error(`Received quantity (${qtyReceived}) cannot exceed issued quantity (${qtyIssued}) for ${line.item.sku}`);
            }
            // Remove from in-transit and add to physical at destination
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                itemId: line.itemId,
                locationId: transfer.destinationLocationId,
                transitDelta: -qtyIssued,
                physicalDelta: qtyReceived,
            });
            if (qtyReceived + 0.0005 < qtyIssued) {
                const qtyShort = qtyIssued - qtyReceived;
                // Delete any old discrepancy for this line before creating a new one
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
                    locationId: transfer.destinationLocationId,
                    quantityDelta: qtyReceived,
                    movementType: "RECEIPT",
                    stockTransferRequestId: transfer.id,
                    notes: `Receipt ${transfer.requestNumber} at ${transfer.destinationLocation.code}`,
                });
            }
        }
        const updated = await tx.stockTransferRequest.update({
            where: { id: transfer.id },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
            },
            include: transferInclude,
        });
        return formatTransfer(updated);
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// REJECT RECEIPT  RECEIPT_REJECTED → PENDING_CORRECTION
//
// The receiving store manager rejects the entire delivery (wrong items,
// wrong quantities, damaged goods, etc.). A mandatory reason is required.
//
// Inventory effect: all in-transit quantities for this transfer are reversed
// back to the main store's physical stock so the main store manager can
// correct and re-issue.
// ─────────────────────────────────────────────────────────────────────────────
async function rejectStockTransferReceipt(auth, transferId, rejectionReason) {
    await (0, store_seed_service_1.ensureDefaultStores)();
    const reason = rejectionReason?.trim();
    if (!reason) {
        throw new Error("A rejection reason is required when rejecting a receipt");
    }
    return server_1.prisma.$transaction(async (tx) => {
        const transfer = await getTransferForUser(transferId, auth, tx);
        (0, store_rbac_service_1.assertCanRejectReceipt)(auth.role, transfer.destinationLocation.code);
        if (transfer.status !== "APPROVED_IN_TRANSIT") {
            throw new Error(`Cannot reject receipt for transfer in status ${transfer.status}`);
        }
        // Reverse inventory: remove in-transit from destination and return
        // physical stock to source (main store)
        for (const line of transfer.items) {
            const qtyIssued = line.qtyIssued != null ? Number(line.qtyIssued) : null;
            if (qtyIssued == null)
                continue; // safety – should always be set here
            // Remove from destination in-transit
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                itemId: line.itemId,
                locationId: transfer.destinationLocationId,
                transitDelta: -qtyIssued,
            });
            // Return to source (main store) physical
            await (0, store_inventory_service_1.adjustStoreBalance)(tx, {
                itemId: line.itemId,
                locationId: transfer.sourceLocationId,
                physicalDelta: qtyIssued,
            });
            await (0, store_inventory_service_1.recordTransferMovement)(tx, {
                itemId: line.itemId,
                locationId: transfer.sourceLocationId,
                quantityDelta: qtyIssued,
                movementType: "ADJUSTMENT",
                stockTransferRequestId: transfer.id,
                notes: `Receipt rejected — ${transfer.requestNumber} returned to ${transfer.sourceLocation.code}: ${reason}`,
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
// ─────────────────────────────────────────────────────────────────────────────
// REJECT PENDING REQUEST  REJECTED
//
// Main store manager rejects the request outright (unnecessary, duplicate,
// or request for items not available at all). Reason is mandatory.
// ─────────────────────────────────────────────────────────────────────────────
async function rejectStockTransferRequest(auth, transferId, rejectionReason) {
    (0, store_rbac_service_1.assertCanReject)(auth.role);
    const reason = rejectionReason?.trim();
    if (!reason) {
        throw new Error("A rejection reason is required");
    }
    return server_1.prisma.$transaction(async (tx) => {
        const transfer = await getTransferForUser(transferId, auth, tx);
        if (transfer.status !== "PENDING") {
            throw new Error(`Cannot reject transfer in status ${transfer.status}`);
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
// ─────────────────────────────────────────────────────────────────────────────
// LIST / GET
// ─────────────────────────────────────────────────────────────────────────────
async function listStockTransferRequests(auth, query) {
    await (0, store_seed_service_1.ensureDefaultStores)();
    const visibility = (0, store_rbac_service_1.stockTransferVisibilityFilter)(auth);
    const transfers = await server_1.prisma.stockTransferRequest.findMany({
        where: {
            ...visibility,
            ...(query?.status ? { status: query.status } : {}),
        },
        include: transferInclude,
        orderBy: { createdAt: "desc" },
        take: 200,
    });
    return transfers.map(formatTransfer);
}
async function getStockTransferRequest(auth, transferId) {
    await (0, store_seed_service_1.ensureDefaultStores)();
    const transfer = await getTransferForUser(transferId, auth);
    return formatTransfer(transfer);
}
async function listStoreInventoryBalances(auth, filters) {
    await (0, store_seed_service_1.ensureDefaultStores)();
    const balances = await server_1.prisma.storeInventoryBalance.findMany({
        where: {
            ...(0, store_rbac_service_1.storeBalanceVisibilityFilter)(auth),
            ...(filters?.itemId ? { itemId: filters.itemId } : {}),
            ...(filters?.storeCode
                ? { location: { code: filters.storeCode } }
                : {}),
        },
        include: {
            item: { select: { id: true, sku: true, name: true, unit: true } },
            location: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ location: { code: "asc" } }, { item: { sku: "asc" } }],
    });
    return balances.map((b) => ({
        ...b,
        physicalQty: Number(b.physicalQty),
        transitQty: Number(b.transitQty),
    }));
}
