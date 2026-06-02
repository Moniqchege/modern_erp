"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = require("express");
const async_handler_1 = require("../middleware/async-handler");
const payment_controller_1 = require("../controllers/sales/payment.controller");
exports.paymentsRouter = (0, express_1.Router)();
exports.paymentsRouter.post("/", (0, async_handler_1.asyncHandler)(payment_controller_1.recordPaymentController));
