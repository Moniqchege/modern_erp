"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSalesOrdersController = listSalesOrdersController;
exports.createSalesOrderController = createSalesOrderController;
exports.getSalesOrderController = getSalesOrderController;
exports.updateSalesOrderController = updateSalesOrderController;
exports.cancelSalesOrderController = cancelSalesOrderController;
const sales_order_schemas_1 = require("../../validation/sales/sales-order.schemas");
const sales_order_service_1 = require("../../services/sales/sales-order.service");
async function listSalesOrdersController(req, res) {
    const parse = sales_order_schemas_1.ListSalesOrdersQuerySchema.safeParse(req.query);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid query parameters",
            errors: parse.error.flatten(),
        });
    }
    const orders = await (0, sales_order_service_1.listSalesOrders)(parse.data);
    res.status(200).json({ orders });
}
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
async function updateSalesOrderController(req, res) {
    const parse = sales_order_schemas_1.UpdateSalesOrderSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid request body",
            errors: parse.error.flatten(),
        });
    }
    const order = await (0, sales_order_service_1.updateSalesOrder)(req.params.id, parse.data);
    res.status(200).json({ order });
}
async function cancelSalesOrderController(req, res) {
    const order = await (0, sales_order_service_1.cancelSalesOrder)(req.params.id);
    res.status(200).json({ order });
}
