import type { CustomerType } from "@prisma/client";

/** Kenya VAT (standard rate) applied to flour sales */
export const VAT_RATE = 0.16;

/** Tier discount by customer type (applied to list/base price before VAT) */
export const TIER_DISCOUNT_PERCENT: Record<CustomerType, number> = {
  DISTRIBUTOR: 15,
  WHOLESALER: 10,
  RETAILER: 5,
  WALK_IN: 0,
};
