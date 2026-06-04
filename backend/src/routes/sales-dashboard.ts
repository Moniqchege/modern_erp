import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuth } from "../middleware/auth";
import { getSalesDashboardController } from "../controllers/sales/sales-dashboard.controller";

export const salesDashboardRouter = Router();

salesDashboardRouter.use(requireAuth);
salesDashboardRouter.get("/", asyncHandler(getSalesDashboardController));
