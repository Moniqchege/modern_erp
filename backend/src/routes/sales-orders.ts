import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuth } from "../middleware/auth";
import {
  cancelSalesOrderController,
  createSalesOrderController,
  getSalesOrderController,
  listSalesOrdersController,
  updateSalesOrderController,
} from "../controllers/sales/sales-order.controller";

export const salesOrdersRouter = Router();

salesOrdersRouter.use(requireAuth);
salesOrdersRouter.get("/", asyncHandler(listSalesOrdersController));
salesOrdersRouter.post("/", asyncHandler(createSalesOrderController));
salesOrdersRouter.get("/:id", asyncHandler(getSalesOrderController));
salesOrdersRouter.patch("/:id", asyncHandler(updateSalesOrderController));
salesOrdersRouter.post("/:id/cancel", asyncHandler(cancelSalesOrderController));
