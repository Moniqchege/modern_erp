import type { Request, Response } from "express";
import {
  CreateCustomerSchema,
  ListCustomersQuerySchema,
} from "../../validation/sales/customer.schemas";
import { createCustomer, listCustomers } from "../../services/sales/customer.service";

export async function listCustomersController(req: Request, res: Response) {
  const parse = ListCustomersQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid query parameters",
      errors: parse.error.flatten(),
    });
  }

  const customers = await listCustomers(parse.data);
  res.status(200).json({ customers });
}

export async function createCustomerController(req: Request, res: Response) {
  const parse = CreateCustomerSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parse.error.flatten(),
    });
  }

  const customer = await createCustomer(parse.data);
  res.status(201).json({ customer });
}
