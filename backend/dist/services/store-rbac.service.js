"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_STORE_CODES = void 0;
exports.isGlobalInventoryAdmin = isGlobalInventoryAdmin;
exports.isMainStoreApprover = isMainStoreApprover;
exports.getScopedStoreCode = getScopedStoreCode;
exports.resolveScopedStoreCode = resolveScopedStoreCode;
exports.assertCanCreateRequest = assertCanCreateRequest;
exports.assertCanApproveIssue = assertCanApproveIssue;
exports.assertCanAcknowledgeReceipt = assertCanAcknowledgeReceipt;
exports.assertCanRejectReceipt = assertCanRejectReceipt;
exports.assertCanReject = assertCanReject;
exports.assertIsPackagingStoreManager = assertIsPackagingStoreManager;
exports.assertIsDispatchStoreManager = assertIsDispatchStoreManager;
exports.assertIsBaleTransferParticipant = assertIsBaleTransferParticipant;
exports.stockTransferVisibilityFilter = stockTransferVisibilityFilter;
exports.storeBalanceVisibilityFilter = storeBalanceVisibilityFilter;
const server_1 = require("../server");
exports.LEGACY_STORE_CODES = [
    "MAIN_STORE",
    "PACKAGING_STORE",
    "MAIZE_STORE",
    "DISPATCH_STORE",
];
const ROLE_TO_STORE = {
    MAIN_STORE_MANAGER: "MAIN_STORE",
    MAIZE_STORE_MANAGER: "MAIZE_STORE",
    PACKAGING_STORE_MANAGER: "PACKAGING_STORE",
    DISPATCH_STORE_MANAGER: "DISPATCH_STORE",
};
function isGlobalInventoryAdmin(role) {
    return role === "SUPERADMIN" || role === "ADMIN";
}
function isMainStoreApprover(role) {
    return (isGlobalInventoryAdmin(role) ||
        role === "MAIN_STORE_MANAGER");
}
function getScopedStoreCode(role) {
    if (isGlobalInventoryAdmin(role))
        return null;
    return ROLE_TO_STORE[role] ?? null;
}
/**
 * Resolves a user's scoped store code, checking dynamic assignments first,
 * then falling back to the legacy role-to-store mapping.
 */
async function resolveScopedStoreCode(auth) {
    if (isGlobalInventoryAdmin(auth.role))
        return null;
    // Check dynamic assignment
    const assignment = await server_1.prisma.storeManagerAssignment.findUnique({
        where: { userId: auth.userId },
        include: { store: { select: { code: true } } },
    });
    if (assignment)
        return assignment.store.code;
    // Fall back to legacy role mapping
    return ROLE_TO_STORE[auth.role] ?? null;
}
function assertCanCreateRequest(role, destinationStoreCode) {
    if (isGlobalInventoryAdmin(role))
        return;
    const scoped = getScopedStoreCode(role);
    if (!scoped) {
        throw new Error("Your role cannot create stock transfer requests");
    }
    if (scoped !== destinationStoreCode) {
        throw new Error(`You may only request stock to your assigned store (${scoped})`);
    }
    if (scoped === "MAIN_STORE") {
        throw new Error("Main store managers approve requests; they do not create inbound requests to Main Store");
    }
}
function assertCanApproveIssue(role) {
    if (!isMainStoreApprover(role)) {
        throw new Error("Only Main Store managers or Superadmin can approve and issue stock");
    }
}
function assertCanAcknowledgeReceipt(role, destinationStoreCode) {
    if (isGlobalInventoryAdmin(role))
        return;
    const scoped = getScopedStoreCode(role);
    if (!scoped || scoped !== destinationStoreCode) {
        throw new Error("You may only acknowledge receipts for your assigned destination store");
    }
}
/**
 * Receiving store manager rejects a delivery and sends it back to main store.
 * Uses the same RBAC rule as acknowledging a receipt — only the manager of
 * the destination store can reject its own incoming transfer.
 */
function assertCanRejectReceipt(role, destinationStoreCode) {
    assertCanAcknowledgeReceipt(role, destinationStoreCode);
}
/** Only main store managers / admins can fully reject a pending request */
function assertCanReject(role) {
    assertCanApproveIssue(role);
}
// ─────────────────────────────────────────────────────────────────────────────
// BALE TRANSFER RBAC  (Packaging Store → Dispatch Store)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Packaging Store Manager can push bales directly to Dispatch Store (push transfer)
 * or issue / reject a pull request made by Dispatch Store.
 */
function assertIsPackagingStoreManager(role) {
    if (!isGlobalInventoryAdmin(role) && role !== "PACKAGING_STORE_MANAGER") {
        throw Object.assign(new Error("Only Packaging Store managers can perform this action"), { statusCode: 403 });
    }
}
/**
 * Dispatch Store Manager can create a pull request or acknowledge / reject a
 * bale delivery to Dispatch Store.
 */
function assertIsDispatchStoreManager(role) {
    if (!isGlobalInventoryAdmin(role) && role !== "DISPATCH_STORE_MANAGER") {
        throw Object.assign(new Error("Only Dispatch Store managers can perform this action"), { statusCode: 403 });
    }
}
/**
 * Packaging Store Manager OR Dispatch Store Manager (or admin) can list
 * bale transfers, scoped to their own store.
 */
function assertIsBaleTransferParticipant(role) {
    if (!isGlobalInventoryAdmin(role) &&
        role !== "PACKAGING_STORE_MANAGER" &&
        role !== "DISPATCH_STORE_MANAGER") {
        throw Object.assign(new Error("You do not have access to bale transfers"), { statusCode: 403 });
    }
}
/** Prisma filter: transfers visible to the current user */
function stockTransferVisibilityFilter(auth) {
    const scoped = getScopedStoreCode(auth.role);
    if (!scoped)
        return undefined;
    return {
        OR: [
            { sourceLocation: { code: scoped } },
            { destinationLocation: { code: scoped } },
        ],
    };
}
function storeBalanceVisibilityFilter(auth) {
    const scoped = getScopedStoreCode(auth.role);
    if (!scoped)
        return undefined;
    return { location: { code: scoped } };
}
