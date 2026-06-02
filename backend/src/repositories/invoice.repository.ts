import type { Prisma } from "@prisma/client";
import { prisma } from "../server";

const invoiceInclude = {
  customer: true,
  salesOrder: { include: { items: true } },
  payments: true,
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.InvoiceInclude;

export const invoiceRepository = {
  async findById(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });
  },

  async findBySalesOrderId(salesOrderId: string) {
    return prisma.invoice.findUnique({
      where: { salesOrderId },
      include: invoiceInclude,
    });
  },

  async findByInvoiceNumber(invoiceNumber: string) {
    return prisma.invoice.findUnique({ where: { invoiceNumber } });
  },

  async create(data: Prisma.InvoiceCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.invoice.create({
      data,
      include: invoiceInclude,
    });
  },

  async nextInvoiceNumber(tx: Prisma.TransactionClient = prisma) {
    const prefix = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const count = await tx.invoice.count({
      where: { invoiceNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, "0")}`;
  },

  async update(
    id: string,
    data: Prisma.InvoiceUpdateInput,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.invoice.update({
      where: { id },
      data,
      include: invoiceInclude,
    });
  },
};
