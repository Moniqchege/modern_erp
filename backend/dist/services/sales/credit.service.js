"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCreditAvailability = checkCreditAvailability;
exports.assertCreditAvailable = assertCreditAvailable;
const http_error_1 = require("../../errors/http-error");
const customer_repository_1 = require("../../repositories/customer.repository");
/**
 * Prevents order creation when outstanding balance + new order would exceed credit limit.
 * Walk-in / cash customers (WALK_IN or zero credit limit) skip the check.
 */
async function checkCreditAvailability(customerId, orderTotal) {
    const customer = await customer_repository_1.customerRepository.findById(customerId);
    if (!customer) {
        throw new http_error_1.NotFoundError(`Customer with ID ${customerId} not found`);
    }
    assertCreditAvailable(customer, orderTotal);
}
function assertCreditAvailable(customer, orderTotal) {
    if (customer.type === "WALK_IN")
        return;
    if (Number(customer.creditLimit) <= 0)
        return;
    const projected = Number(customer.currentBalance) + orderTotal;
    const limit = Number(customer.creditLimit);
    if (projected > limit) {
        throw new http_error_1.BadRequestError(`Credit limit exceeded. Available credit: ${Math.max(0, limit - Number(customer.currentBalance)).toFixed(2)}, order total: ${orderTotal.toFixed(2)}`, "CREDIT_LIMIT_EXCEEDED");
    }
}
