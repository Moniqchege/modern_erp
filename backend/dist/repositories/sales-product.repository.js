"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salesProductRepository = void 0;
const server_1 = require("../server");
exports.salesProductRepository = {
    async findBySku(sku) {
        return server_1.prisma.salesProduct.findUnique({ where: { sku } });
    },
    async findActiveBySku(sku) {
        return server_1.prisma.salesProduct.findFirst({
            where: { sku, isActive: true },
        });
    },
    async findManyActive() {
        return server_1.prisma.salesProduct.findMany({
            where: { isActive: true },
            orderBy: { sku: "asc" },
        });
    },
};
