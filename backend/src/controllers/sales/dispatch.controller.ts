import type { Request, Response } from "express";
import {
  CreateDispatchSchema,
  ListDispatchesQuerySchema,
  UpdateDispatchStatusSchema,
} from "../../validation/sales/dispatch.schemas";
import {
  createSalesDispatch,
  getSalesDispatchById,
  listAvailablePallets,
  listSalesDispatches,
  patchSalesDispatchStatus,
} from "../../services/sales/sales-dispatch.service";

export async function listDispatchesController(req: Request, res: Response) {
  const parse = ListDispatchesQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid query parameters",
      errors: parse.error.flatten(),
    });
  }
  const dispatches = await listSalesDispatches(parse.data);
  res.status(200).json({ dispatches });
}

export async function getDispatchController(req: Request, res: Response) {
  const dispatch = await getSalesDispatchById(req.params.id);
  res.status(200).json({ dispatch });
}

export async function createDispatchController(req: Request, res: Response) {
  const parse = CreateDispatchSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parse.error.flatten(),
    });
  }
  const dispatch = await createSalesDispatch(parse.data);
  res.status(201).json({ dispatch });
}

export async function updateDispatchStatusController(req: Request, res: Response) {
  const parse = UpdateDispatchStatusSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parse.error.flatten(),
    });
  }
  const dispatch = await patchSalesDispatchStatus(req.params.id, parse.data);
  res.status(200).json({ dispatch });
}

export async function listAvailablePalletsController(_req: Request, res: Response) {
  const pallets = await listAvailablePallets();
  res.status(200).json({ pallets });
}
