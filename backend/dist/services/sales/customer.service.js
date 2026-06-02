"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCustomers = listCustomers;
exports.createCustomer = createCustomer;
const http_error_1 = require("../../errors/http-error");
const customer_repository_1 = require("../../repositories/customer.repository");
function formatCustomer(customer) {
    if (!customer)
        return customer;
    return {
        ...customer,
        creditLimit: Number(customer.creditLimit),
        currentBalance: Number(customer.currentBalance),
    };
}
async function listCustomers(query) {
    const rows = await customer_repository_1.customerRepository.findMany({
        type: query.type,
        status: query.status,
        creditStatus: query.creditStatus,
    });
    return rows.map((c) => formatCustomer(c));
}
async function createCustomer(input) {
    if (input.email) {
        const existing = await customer_repository_1.customerRepository.findByEmail(input.email);
        if (existing) {
            throw new http_error_1.ConflictError("A customer with this email already exists");
        }
    }
    const creditLimit = input.type === "WALK_IN" ? 0 : (input.creditLimit ?? 0);
    const customer = await customer_repository_1.customerRepository.create({
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        type: input.type,
        creditLimit: creditLimit.toFixed(2),
        currentBalance: "0.00",
        creditDays: input.creditDays,
        taxPin: input.taxPin,
        status: input.status,
    });
    return formatCustomer(customer);
}
