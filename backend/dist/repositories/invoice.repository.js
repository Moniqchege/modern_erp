"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceRepository = void 0;
const server_1 = require("../server");
const invoiceInclude = {
    customer: true,
    salesOrder: { include: { items: true } },
    payments: true,
    createdBy: { select: { id: true, name: true, email: true } },
};
exports.invoiceRepository = {
    async findById(id) {
        return server_1.prisma.invoice.findUnique({
            where: { id },
            include: invoiceInclude,
        });
    },
    async findBySalesOrderId(salesOrderId) {
        return server_1.prisma.invoice.findUnique({
            where: { salesOrderId },
            include: invoiceInclude,
        });
    },
    async findMany(filters = {}) {
        return server_1.prisma.invoice.findMany({
            where: {
                ...(filters.customerId ? { customerId: filters.customerId } : {}),
                ...(filters.status ? { status: filters.status } : {}),
            },
            include: invoiceInclude,
            orderBy: { createdAt: "desc" },
        });
    },
    async findByInvoiceNumber(invoiceNumber) {
        return server_1.prisma.invoice.findUnique({ where: { invoiceNumber } });
    },
    async create(data, tx = server_1.prisma) {
        return tx.invoice.create({
            data,
            include: invoiceInclude,
        });
    },
    async nextInvoiceNumber(tx = server_1.prisma) {
        const prefix = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
        const count = await tx.invoice.count({
            where: { invoiceNumber: { startsWith: prefix } },
        });
        return `${prefix}-${String(count + 1).padStart(4, "0")}`;
    },
    async update(id, data, tx = server_1.prisma) {
        return tx.invoice.update({
            where: { id },
            data,
            include: invoiceInclude,
        });
    },
};
