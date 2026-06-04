import { Prisma, UserRole } from "@prisma/client";
import type { AccessTokenPayload } from "../auth/jwt";
import { prisma } from "../server";

export const LEGACY_STORE_CODES: string[] = [
  "MAIN_STORE",
  "PACKAGING_STORE",
  "MAIZE_STORE",
  "DISPATCH_STORE",
];

const ROLE_TO_STORE: Partial<Record<UserRole, string>> = {
  MAIN_STORE_MANAGER: "MAIN_STORE",
  MAIZE_STORE_MANAGER: "MAIZE_STORE",
  PACKAGING_STORE_MANAGER: "PACKAGING_STORE",
  DISPATCH_STORE_MANAGER: "DISPATCH_STORE",
};

export function isGlobalInventoryAdmin(role: string): boolean {
  return role === "SUPERADMIN" || role === "ADMIN";
}

export function isMainStoreApprover(role: string): boolean {
  return (
    isGlobalInventoryAdmin(role) ||
    role === "MAIN_STORE_MANAGER"
  );
}

export function getScopedStoreCode(role: string): string | null {
  if (isGlobalInventoryAdmin(role)) return null;
  return ROLE_TO_STORE[role as UserRole] ?? null;
}

/**
 * Resolves a user's scoped store code, checking dynamic assignments first,
 * then falling back to the legacy role-to-store mapping.
 */
export async function resolveScopedStoreCode(
  auth: AccessTokenPayload
): Promise<string | null> {
  if (isGlobalInventoryAdmin(auth.role)) return null;

  // Check dynamic assignment
  const assignment = await prisma.storeManagerAssignment.findUnique({
    where: { userId: auth.userId },
    include: { store: { select: { code: true } } },
  });
  if (assignment) return assignment.store.code;

  // Fall back to legacy role mapping
  return ROLE_TO_STORE[auth.role as UserRole] ?? null;
}

export function assertCanCreateRequest(
  role: string,
  destinationStoreCode: string
) {
  if (isGlobalInventoryAdmin(role)) return;

  const scoped = getScopedStoreCode(role);
  if (!scoped) {
    throw new Error("Your role cannot create stock transfer requests");
  }
  if (scoped !== destinationStoreCode) {
    throw new Error(
      `You may only request stock to your assigned store (${scoped})`
    );
  }
  if (scoped === "MAIN_STORE") {
    throw new Error("Main store managers approve requests; they do not create inbound requests to Main Store");
  }
}

export function assertCanApproveIssue(role: string) {
  if (!isMainStoreApprover(role)) {
    throw new Error("Only Main Store managers or Superadmin can approve and issue stock");
  }
}

export function assertCanAcknowledgeReceipt(
  role: string,
  destinationStoreCode: string
) {
  if (isGlobalInventoryAdmin(role)) return;

  const scoped = getScopedStoreCode(role);
  if (!scoped || scoped !== destinationStoreCode) {
    throw new Error(
      "You may only acknowledge receipts for your assigned destination store"
    );
  }
}

/**
 * Receiving store manager rejects a delivery and sends it back to main store.
 * Uses the same RBAC rule as acknowledging a receipt — only the manager of
 * the destination store can reject its own incoming transfer.
 */
export function assertCanRejectReceipt(
  role: string,
  destinationStoreCode: string
) {
  assertCanAcknowledgeReceipt(role, destinationStoreCode);
}

/** Only main store managers / admins can fully reject a pending request */
export function assertCanReject(role: string) {
  assertCanApproveIssue(role);
}

// ─────────────────────────────────────────────────────────────────────────────
// BALE TRANSFER RBAC  (Packaging Store → Dispatch Store)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Packaging Store Manager can push bales directly to Dispatch Store (push transfer)
 * or issue / reject a pull request made by Dispatch Store.
 */
export function assertIsPackagingStoreManager(role: string): void {
  if (!isGlobalInventoryAdmin(role) && role !== "PACKAGING_STORE_MANAGER") {
    throw Object.assign(
      new Error("Only Packaging Store managers can perform this action"),
      { statusCode: 403 }
    );
  }
}

/**
 * Dispatch Store Manager can create a pull request or acknowledge / reject a
 * bale delivery to Dispatch Store.
 */
export function assertIsDispatchStoreManager(role: string): void {
  if (!isGlobalInventoryAdmin(role) && role !== "DISPATCH_STORE_MANAGER") {
    throw Object.assign(
      new Error("Only Dispatch Store managers can perform this action"),
      { statusCode: 403 }
    );
  }
}

/**
 * Packaging Store Manager OR Dispatch Store Manager (or admin) can list
 * bale transfers, scoped to their own store.
 */
export function assertIsBaleTransferParticipant(role: string): void {
  if (
    !isGlobalInventoryAdmin(role) &&
    role !== "PACKAGING_STORE_MANAGER" &&
    role !== "DISPATCH_STORE_MANAGER"
  ) {
    throw Object.assign(
      new Error("You do not have access to bale transfers"),
      { statusCode: 403 }
    );
  }
}

/** Prisma filter: transfers visible to the current user */
export function stockTransferVisibilityFilter(
  auth: AccessTokenPayload
): Prisma.StockTransferRequestWhereInput | undefined {
  const scoped = getScopedStoreCode(auth.role);
  if (!scoped) return undefined;

  return {
    OR: [
      { sourceLocation: { code: scoped } },
      { destinationLocation: { code: scoped } },
    ],
  };
}

export function storeBalanceVisibilityFilter(
  auth: AccessTokenPayload
): Prisma.StoreInventoryBalanceWhereInput | undefined {
  const scoped = getScopedStoreCode(auth.role);
  if (!scoped) return undefined;
  return { location: { code: scoped } };
}
