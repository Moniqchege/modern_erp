"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customersRouter = void 0;
const express_1 = require("express");
const async_handler_1 = require("../middleware/async-handler");
const customer_controller_1 = require("../controllers/sales/customer.controller");
exports.customersRouter = (0, express_1.Router)();
exports.customersRouter.get("/", (0, async_handler_1.asyncHandler)(customer_controller_1.listCustomersController));
exports.customersRouter.post("/", (0, async_handler_1.asyncHandler)(customer_controller_1.createCustomerController));
