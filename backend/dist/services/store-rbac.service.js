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
exports.assertCanReject = assertCanReject;
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
function assertCanReject(role) {
    assertCanApproveIssue(role);
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
