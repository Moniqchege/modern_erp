import type { Prisma } from "@prisma/client";
import { prisma } from "../server";

const orderInclude = {
  customer: true,
  items: { include: { salesProduct: true } },
  invoice: true,
} satisfies Prisma.SalesOrderInclude;

export const salesOrderRepository = {
  async findById(id: string) {
    return prisma.salesOrder.findUnique({
      where: { id },
      include: orderInclude,
    });
  },

  async findByOrderNumber(orderNumber: string) {
    return prisma.salesOrder.findUnique({
      where: { orderNumber },
      include: orderInclude,
    });
  },

  async create(
    data: Prisma.SalesOrderCreateInput,
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.salesOrder.create({
      data,
      include: orderInclude,
    });
  },

  async nextOrderNumber(tx: Prisma.TransactionClient = prisma) {
    const prefix = `SO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const count = await tx.salesOrder.count({
      where: { orderNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, "0")}`;
  },
};
