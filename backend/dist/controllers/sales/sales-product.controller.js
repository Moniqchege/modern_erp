"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSalesProductsController = listSalesProductsController;
const sales_product_service_1 = require("../../services/sales/sales-product.service");
async function listSalesProductsController(_req, res) {
    const products = await (0, sales_product_service_1.listSalesProducts)();
    res.status(200).json({ products });
}
