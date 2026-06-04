import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuth } from "../middleware/auth";
import {
  createDispatchController,
  getDispatchController,
  listAvailablePalletsController,
  listDispatchesController,
  updateDispatchStatusController,
} from "../controllers/sales/dispatch.controller";

export const dispatchesRouter = Router();

dispatchesRouter.use(requireAuth);
dispatchesRouter.get("/pallets/available", asyncHandler(listAvailablePalletsController));
dispatchesRouter.get("/", asyncHandler(listDispatchesController));
dispatchesRouter.post("/", asyncHandler(createDispatchController));
dispatchesRouter.get("/:id", asyncHandler(getDispatchController));
dispatchesRouter.patch("/:id/status", asyncHandler(updateDispatchStatusController));
