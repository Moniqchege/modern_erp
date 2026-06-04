import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuth } from "../middleware/auth";
import { listSalesProductsController } from "../controllers/sales/sales-product.controller";

export const salesProductsRouter = Router();

salesProductsRouter.use(requireAuth);
salesProductsRouter.get("/", asyncHandler(listSalesProductsController));
