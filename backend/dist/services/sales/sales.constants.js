"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_DISCOUNT_PERCENT = exports.VAT_RATE = void 0;
/** Kenya VAT (standard rate) applied to flour sales */
exports.VAT_RATE = 0.16;
/** Tier discount by customer type (applied to list/base price before VAT) */
exports.TIER_DISCOUNT_PERCENT = {
    DISTRIBUTOR: 15,
    WHOLESALER: 10,
    RETAILER: 5,
    WALK_IN: 0,
};
