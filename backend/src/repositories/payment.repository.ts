import type { Prisma } from "@prisma/client";
import { prisma } from "../server";

export const paymentRepository = {
  async create(data: Prisma.CustomerPaymentCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.customerPayment.create({ data });
  },

  async findMany(filters: { customerId?: string; invoiceId?: string } = {}) {
    return prisma.customerPayment.findMany({
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

  async sumForInvoice(invoiceId: string, tx: Prisma.TransactionClient = prisma) {
    const agg = await tx.customerPayment.aggregate({
      where: { invoiceId },
      _sum: { amountPaid: true },
    });
    return Number(agg._sum.amountPaid ?? 0);
  },
};
