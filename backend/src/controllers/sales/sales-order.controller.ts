import type { Request, Response } from "express";
import {
  CreateSalesOrderSchema,
  ListSalesOrdersQuerySchema,
  UpdateSalesOrderSchema,
} from "../../validation/sales/sales-order.schemas";
import {
  cancelSalesOrder,
  createSalesOrder,
  getSalesOrderById,
  listSalesOrders,
  updateSalesOrder,
} from "../../services/sales/sales-order.service";

export async function listSalesOrdersController(req: Request, res: Response) {
  const parse = ListSalesOrdersQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid query parameters",
      errors: parse.error.flatten(),
    });
  }
  const orders = await listSalesOrders(parse.data);
  res.status(200).json({ orders });
}

export async function createSalesOrderController(req: Request, res: Response) {
  const parse = CreateSalesOrderSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parse.error.flatten(),
    });
  }

  const order = await createSalesOrder(parse.data);
  res.status(201).json({ order });
}

export async function getSalesOrderController(req: Request, res: Response) {
  const order = await getSalesOrderById(req.params.id);
  res.status(200).json({ order });
}

export async function updateSalesOrderController(req: Request, res: Response) {
  const parse = UpdateSalesOrderSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parse.error.flatten(),
    });
  }
  const order = await updateSalesOrder(req.params.id, parse.data);
  res.status(200).json({ order });
}

export async function cancelSalesOrderController(req: Request, res: Response) {
  const order = await cancelSalesOrder(req.params.id);
  res.status(200).json({ order });
}
