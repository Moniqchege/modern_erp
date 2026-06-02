"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPaymentController = recordPaymentController;
const payment_schemas_1 = require("../../validation/sales/payment.schemas");
const payment_service_1 = require("../../services/sales/payment.service");
async function recordPaymentController(req, res) {
    const parse = payment_schemas_1.RecordPaymentSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid request body",
            errors: parse.error.flatten(),
        });
    }
    const result = await (0, payment_service_1.recordCustomerPayment)(parse.data);
    res.status(201).json(result);
}
