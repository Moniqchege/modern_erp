import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import {
  createSalesOrderController,
  getSalesOrderController,
} from "../controllers/sales/sales-order.controller";

export const salesOrdersRouter = Router();

salesOrdersRouter.post("/", asyncHandler(createSalesOrderController));
salesOrdersRouter.get("/:id", asyncHandler(getSalesOrderController));
