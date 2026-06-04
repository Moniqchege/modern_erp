import type { Request, Response } from "express";
import {
  CreateCustomerSchema,
  ListCustomersQuerySchema,
  UpdateCustomerSchema,
} from "../../validation/sales/customer.schemas";
import {
  createCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
} from "../../services/sales/customer.service";

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

export async function getCustomerController(req: Request, res: Response) {
  const customer = await getCustomerById(req.params.id);
  res.status(200).json({ customer });
}

export async function updateCustomerController(req: Request, res: Response) {
  const parse = UpdateCustomerSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parse.error.flatten(),
    });
  }
  const customer = await updateCustomer(req.params.id, parse.data);
  res.status(200).json({ customer });
}
