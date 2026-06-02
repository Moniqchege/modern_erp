import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import {
  createLegacyInvoiceController,
  generateInvoiceController,
  listInvoicesController,
} from "../controllers/sales/invoice.controller";

export const invoicesRouter = Router();

invoicesRouter.get("/", asyncHandler(listInvoicesController));
invoicesRouter.post("/generate", asyncHandler(generateInvoiceController));
invoicesRouter.post("/", asyncHandler(createLegacyInvoiceController));
