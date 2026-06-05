"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateTieredPricing = calculateTieredPricing;
exports.priceLineForCustomer = priceLineForCustomer;
exports.roundMoney = roundMoney;
const http_error_1 = require("../../errors/http-error");
const customer_repository_1 = require("../../repositories/customer.repository");
const sales_product_repository_1 = require("../../repositories/sales-product.repository");
const sales_constants_1 = require("./sales.constants");
/**
 * Applies tiered pricing: distributors receive the highest discount.
 */
async function calculateTieredPricing(customerId, productSku, quantity) {
    const customer = await customer_repository_1.customerRepository.findById(customerId);
    if (!customer) {
        throw new http_error_1.NotFoundError(`Customer with ID ${customerId} not found`);
    }
    const product = await sales_product_repository_1.salesProductRepository.findActiveBySku(productSku);
    if (!product) {
        throw new http_error_1.NotFoundError(`Product SKU ${productSku} not found or inactive`);
    }
    return priceLineForCustomer(customer.type, productSku, quantity, Number(product.basePrice));
}
function priceLineForCustomer(customerType, productSku, quantity, basePrice) {
    const discountPercent = sales_constants_1.TIER_DISCOUNT_PERCENT[customerType] ?? 0;
    const unitPrice = roundMoney(basePrice * (1 - discountPercent / 100));
    const lineTotal = roundMoney(unitPrice * quantity);
    return {
        productSku,
        quantity,
        unitPrice,
        discountPercent,
        lineTotal,
    };
}
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
