import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import {
  createCustomerController,
  listCustomersController,
} from "../controllers/sales/customer.controller";

export const customersRouter = Router();

customersRouter.get("/", asyncHandler(listCustomersController));
customersRouter.post("/", asyncHandler(createCustomerController));
