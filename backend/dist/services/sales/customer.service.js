"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCustomers = listCustomers;
exports.createCustomer = createCustomer;
exports.getCustomerById = getCustomerById;
exports.updateCustomer = updateCustomer;
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
async function getCustomerById(id) {
    const customer = await customer_repository_1.customerRepository.findById(id);
    if (!customer) {
        throw new http_error_1.NotFoundError(`Customer ${id} not found`);
    }
    return formatCustomer(customer);
}
async function updateCustomer(id, input) {
    const existing = await customer_repository_1.customerRepository.findById(id);
    if (!existing) {
        throw new http_error_1.NotFoundError(`Customer ${id} not found`);
    }
    if (input.email && input.email !== existing.email) {
        const dup = await customer_repository_1.customerRepository.findByEmail(input.email);
        if (dup) {
            throw new http_error_1.ConflictError("A customer with this email already exists");
        }
    }
    const creditLimit = input.type === "WALK_IN"
        ? "0.00"
        : input.creditLimit !== undefined
            ? input.creditLimit.toFixed(2)
            : undefined;
    const updated = await customer_repository_1.customerRepository.update(id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(creditLimit !== undefined ? { creditLimit } : {}),
        ...(input.creditDays !== undefined ? { creditDays: input.creditDays } : {}),
        ...(input.taxPin !== undefined ? { taxPin: input.taxPin } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
    });
    return formatCustomer(updated);
}
