import type { Prisma } from "@prisma/client";
import { prisma } from "../server";

export const paymentRepository = {
  async create(data: Prisma.CustomerPaymentCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.customerPayment.create({ data });
  },

  async sumForInvoice(invoiceId: string, tx: Prisma.TransactionClient = prisma) {
    const agg = await tx.customerPayment.aggregate({
      where: { invoiceId },
      _sum: { amountPaid: true },
    });
    return Number(agg._sum.amountPaid ?? 0);
  },
};
