import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuth } from "../middleware/auth";
import {
  createCustomerController,
  getCustomerController,
  listCustomersController,
  updateCustomerController,
} from "../controllers/sales/customer.controller";

export const customersRouter = Router();

customersRouter.use(requireAuth);
customersRouter.get("/", asyncHandler(listCustomersController));
customersRouter.post("/", asyncHandler(createCustomerController));
customersRouter.get("/:id", asyncHandler(getCustomerController));
customersRouter.patch("/:id", asyncHandler(updateCustomerController));
