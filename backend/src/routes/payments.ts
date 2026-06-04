import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuth } from "../middleware/auth";
import {
  listPaymentsController,
  recordPaymentController,
} from "../controllers/sales/payment.controller";

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);
paymentsRouter.get("/", asyncHandler(listPaymentsController));
paymentsRouter.post("/", asyncHandler(recordPaymentController));
