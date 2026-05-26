import { Prisma, StoreCode, UserRole } from "@prisma/client";
import type { AccessTokenPayload } from "../auth/jwt";

export const STORE_CODES: StoreCode[] = [
  "MAIN_STORE",
  "PACKAGING_STORE",
  "MAIZE_STORE",
  "DISPATCH_STORE",
];

const ROLE_TO_STORE: Partial<Record<UserRole, StoreCode>> = {
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

export function getScopedStoreCode(role: string): StoreCode | null {
  if (isGlobalInventoryAdmin(role)) return null;
  return ROLE_TO_STORE[role as UserRole] ?? null;
}

export function assertCanCreateRequest(
  role: string,
  destinationStoreCode: StoreCode
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
  destinationStoreCode: StoreCode
) {
  if (isGlobalInventoryAdmin(role)) return;

  const scoped = getScopedStoreCode(role);
  if (!scoped || scoped !== destinationStoreCode) {
    throw new Error(
      "You may only acknowledge receipts for your assigned destination store"
    );
  }
}

export function assertCanReject(role: string) {
  assertCanApproveIssue(role);
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
