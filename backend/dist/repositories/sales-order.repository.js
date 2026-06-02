"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salesOrderRepository = void 0;
const server_1 = require("../server");
const orderInclude = {
    customer: true,
    items: { include: { salesProduct: true } },
    invoice: true,
};
exports.salesOrderRepository = {
    async findById(id) {
        return server_1.prisma.salesOrder.findUnique({
            where: { id },
            include: orderInclude,
        });
    },
    async findByOrderNumber(orderNumber) {
        return server_1.prisma.salesOrder.findUnique({
            where: { orderNumber },
            include: orderInclude,
        });
    },
    async create(data, tx = server_1.prisma) {
        return tx.salesOrder.create({
            data,
            include: orderInclude,
        });
    },
    async nextOrderNumber(tx = server_1.prisma) {
        const prefix = `SO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
        const count = await tx.salesOrder.count({
            where: { orderNumber: { startsWith: prefix } },
        });
        return `${prefix}-${String(count + 1).padStart(4, "0")}`;
    },
};
