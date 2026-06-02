import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { recordPaymentController } from "../controllers/sales/payment.controller";

export const paymentsRouter = Router();

paymentsRouter.post("/", asyncHandler(recordPaymentController));
