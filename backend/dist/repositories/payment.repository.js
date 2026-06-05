"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRepository = void 0;
const server_1 = require("../server");
exports.paymentRepository = {
    async create(data, tx = server_1.prisma) {
        return tx.customerPayment.create({ data });
    },
    async findMany(filters = {}) {
        return server_1.prisma.customerPayment.findMany({
            where: {
                ...(filters.customerId ? { customerId: filters.customerId } : {}),
                ...(filters.invoiceId ? { invoiceId: filters.invoiceId } : {}),
            },
            include: {
                customer: { select: { id: true, name: true } },
                invoice: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        total: true,
                        amountDue: true,
                        status: true,
                    },
                },
            },
            orderBy: { paidAt: "desc" },
        });
    },
    async sumForInvoice(invoiceId, tx = server_1.prisma) {
        const agg = await tx.customerPayment.aggregate({
            where: { invoiceId },
            _sum: { amountPaid: true },
        });
        return Number(agg._sum.amountPaid ?? 0);
    },
};
