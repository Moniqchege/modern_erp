"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSalesOrderController = createSalesOrderController;
exports.getSalesOrderController = getSalesOrderController;
const sales_order_schemas_1 = require("../../validation/sales/sales-order.schemas");
const sales_order_service_1 = require("../../services/sales/sales-order.service");
async function createSalesOrderController(req, res) {
    const parse = sales_order_schemas_1.CreateSalesOrderSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid request body",
            errors: parse.error.flatten(),
        });
    }
    const order = await (0, sales_order_service_1.createSalesOrder)(parse.data);
    res.status(201).json({ order });
}
async function getSalesOrderController(req, res) {
    const order = await (0, sales_order_service_1.getSalesOrderById)(req.params.id);
    res.status(200).json({ order });
}
