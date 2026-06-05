"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSalesProducts = listSalesProducts;
const sales_product_repository_1 = require("../../repositories/sales-product.repository");
async function listSalesProducts() {
    const rows = await sales_product_repository_1.salesProductRepository.findManyActive();
    return rows.map((p) => ({
        ...p,
        basePrice: Number(p.basePrice),
    }));
}
