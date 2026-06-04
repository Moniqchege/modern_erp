import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuth } from "../middleware/auth";
import {
  createLegacyInvoiceController,
  generateInvoiceController,
  getInvoiceController,
  listInvoicesController,
} from "../controllers/sales/invoice.controller";

export const invoicesRouter = Router();

invoicesRouter.use(requireAuth);
invoicesRouter.get("/", asyncHandler(listInvoicesController));
invoicesRouter.post("/generate", asyncHandler(generateInvoiceController));
invoicesRouter.get("/:id", asyncHandler(getInvoiceController));
invoicesRouter.post("/", asyncHandler(createLegacyInvoiceController));
