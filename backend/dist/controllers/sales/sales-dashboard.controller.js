"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalesDashboardController = getSalesDashboardController;
const sales_dashboard_service_1 = require("../../services/sales/sales-dashboard.service");
async function getSalesDashboardController(_req, res) {
    const dashboard = await (0, sales_dashboard_service_1.getSalesDashboard)();
    res.status(200).json({ dashboard });
}
