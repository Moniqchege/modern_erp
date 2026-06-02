import type { CustomerType, CustomerAccountStatus, Prisma } from "@prisma/client";
import { prisma } from "../server";

export type CustomerFilters = {
  type?: CustomerType;
  status?: CustomerAccountStatus;
  creditStatus?: "over_limit" | "has_balance" | "clear";
};

export const customerRepository = {
  async findMany(filters: CustomerFilters = {}) {
    const customers = await prisma.customer.findMany({
      where: {
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    if (!filters.creditStatus) return customers;

    return customers.filter((c) => {
      const balance = Number(c.currentBalance);
      const limit = Number(c.creditLimit);
      if (filters.creditStatus === "over_limit") return balance > limit;
      if (filters.creditStatus === "has_balance") return balance > 0;
      if (filters.creditStatus === "clear") return balance === 0;
      return true;
    });
  },

  async findById(id: string) {
    return prisma.customer.findUnique({ where: { id } });
  },

  async findByEmail(email: string) {
    return prisma.customer.findUnique({ where: { email } });
  },

  async create(data: Prisma.CustomerCreateInput) {
    return prisma.customer.create({ data });
  },

  async updateBalance(id: string, delta: number, tx: Prisma.TransactionClient = prisma) {
    const customer = await tx.customer.findUnique({ where: { id } });
    if (!customer) return null;
    const next = Number(customer.currentBalance) + delta;
    return tx.customer.update({
      where: { id },
      data: { currentBalance: next.toFixed(2) },
    });
  },
};
