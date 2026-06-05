"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDispatchesController = listDispatchesController;
exports.getDispatchController = getDispatchController;
exports.createDispatchController = createDispatchController;
exports.updateDispatchStatusController = updateDispatchStatusController;
exports.listAvailablePalletsController = listAvailablePalletsController;
const dispatch_schemas_1 = require("../../validation/sales/dispatch.schemas");
const sales_dispatch_service_1 = require("../../services/sales/sales-dispatch.service");
async function listDispatchesController(req, res) {
    const parse = dispatch_schemas_1.ListDispatchesQuerySchema.safeParse(req.query);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid query parameters",
            errors: parse.error.flatten(),
        });
    }
    const dispatches = await (0, sales_dispatch_service_1.listSalesDispatches)(parse.data);
    res.status(200).json({ dispatches });
}
async function getDispatchController(req, res) {
    const dispatch = await (0, sales_dispatch_service_1.getSalesDispatchById)(req.params.id);
    res.status(200).json({ dispatch });
}
async function createDispatchController(req, res) {
    const parse = dispatch_schemas_1.CreateDispatchSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid request body",
            errors: parse.error.flatten(),
        });
    }
    const dispatch = await (0, sales_dispatch_service_1.createSalesDispatch)(parse.data);
    res.status(201).json({ dispatch });
}
async function updateDispatchStatusController(req, res) {
    const parse = dispatch_schemas_1.UpdateDispatchStatusSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid request body",
            errors: parse.error.flatten(),
        });
    }
    const dispatch = await (0, sales_dispatch_service_1.patchSalesDispatchStatus)(req.params.id, parse.data);
    res.status(200).json({ dispatch });
}
async function listAvailablePalletsController(_req, res) {
    const pallets = await (0, sales_dispatch_service_1.listAvailablePallets)();
    res.status(200).json({ pallets });
}
