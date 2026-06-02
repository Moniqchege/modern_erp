import { prisma } from "../server";

export const salesProductRepository = {
  async findBySku(sku: string) {
    return prisma.salesProduct.findUnique({ where: { sku } });
  },

  async findActiveBySku(sku: string) {
    return prisma.salesProduct.findFirst({
      where: { sku, isActive: true },
    });
  },

  async findManyActive() {
    return prisma.salesProduct.findMany({
      where: { isActive: true },
      orderBy: { sku: "asc" },
    });
  },
};
