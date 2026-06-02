"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salesOrdersRouter = void 0;
const express_1 = require("express");
const async_handler_1 = require("../middleware/async-handler");
const sales_order_controller_1 = require("../controllers/sales/sales-order.controller");
exports.salesOrdersRouter = (0, express_1.Router)();
exports.salesOrdersRouter.post("/", (0, async_handler_1.asyncHandler)(sales_order_controller_1.createSalesOrderController));
exports.salesOrdersRouter.get("/:id", (0, async_handler_1.asyncHandler)(sales_order_controller_1.getSalesOrderController));
