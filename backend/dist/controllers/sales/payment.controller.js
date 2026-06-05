"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPaymentsController = listPaymentsController;
exports.recordPaymentController = recordPaymentController;
const payment_schemas_1 = require("../../validation/sales/payment.schemas");
const payment_service_1 = require("../../services/sales/payment.service");
async function listPaymentsController(req, res) {
    const parse = payment_schemas_1.ListPaymentsQuerySchema.safeParse(req.query);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid query parameters",
            errors: parse.error.flatten(),
        });
    }
    const payments = await (0, payment_service_1.listCustomerPayments)(parse.data);
    res.status(200).json({ payments });
}
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
