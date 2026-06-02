"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRepository = void 0;
const server_1 = require("../server");
exports.paymentRepository = {
    async create(data, tx = server_1.prisma) {
        return tx.customerPayment.create({ data });
    },
    async sumForInvoice(invoiceId, tx = server_1.prisma) {
        const agg = await tx.customerPayment.aggregate({
            where: { invoiceId },
            _sum: { amountPaid: true },
        });
        return Number(agg._sum.amountPaid ?? 0);
    },
};
