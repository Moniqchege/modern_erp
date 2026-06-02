import type { Request, Response } from "express";
import { CreateSalesOrderSchema } from "../../validation/sales/sales-order.schemas";
import {
  createSalesOrder,
  getSalesOrderById,
} from "../../services/sales/sales-order.service";

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
