"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerRepository = void 0;
const server_1 = require("../server");
exports.customerRepository = {
    async findMany(filters = {}) {
        const customers = await server_1.prisma.customer.findMany({
            where: {
                ...(filters.type ? { type: filters.type } : {}),
                ...(filters.status ? { status: filters.status } : {}),
            },
            orderBy: { createdAt: "desc" },
        });
        if (!filters.creditStatus)
            return customers;
        return customers.filter((c) => {
            const balance = Number(c.currentBalance);
            const limit = Number(c.creditLimit);
            if (filters.creditStatus === "over_limit")
                return balance > limit;
            if (filters.creditStatus === "has_balance")
                return balance > 0;
            if (filters.creditStatus === "clear")
                return balance === 0;
            return true;
        });
    },
    async findById(id) {
        return server_1.prisma.customer.findUnique({ where: { id } });
    },
    async findByEmail(email) {
        return server_1.prisma.customer.findUnique({ where: { email } });
    },
    async create(data) {
        return server_1.prisma.customer.create({ data });
    },
    async update(id, data) {
        return server_1.prisma.customer.update({ where: { id }, data });
    },
    async updateBalance(id, delta, tx = server_1.prisma) {
        const customer = await tx.customer.findUnique({ where: { id } });
        if (!customer)
            return null;
        const next = Number(customer.currentBalance) + delta;
        return tx.customer.update({
            where: { id },
            data: { currentBalance: next.toFixed(2) },
        });
    },
};
