"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCustomersController = listCustomersController;
exports.createCustomerController = createCustomerController;
exports.getCustomerController = getCustomerController;
exports.updateCustomerController = updateCustomerController;
const customer_schemas_1 = require("../../validation/sales/customer.schemas");
const customer_service_1 = require("../../services/sales/customer.service");
async function listCustomersController(req, res) {
    const parse = customer_schemas_1.ListCustomersQuerySchema.safeParse(req.query);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid query parameters",
            errors: parse.error.flatten(),
        });
    }
    const customers = await (0, customer_service_1.listCustomers)(parse.data);
    res.status(200).json({ customers });
}
async function createCustomerController(req, res) {
    const parse = customer_schemas_1.CreateCustomerSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid request body",
            errors: parse.error.flatten(),
        });
    }
    const customer = await (0, customer_service_1.createCustomer)(parse.data);
    res.status(201).json({ customer });
}
async function getCustomerController(req, res) {
    const customer = await (0, customer_service_1.getCustomerById)(req.params.id);
    res.status(200).json({ customer });
}
async function updateCustomerController(req, res) {
    const parse = customer_schemas_1.UpdateCustomerSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid request body",
            errors: parse.error.flatten(),
        });
    }
    const customer = await (0, customer_service_1.updateCustomer)(req.params.id, parse.data);
    res.status(200).json({ customer });
}
