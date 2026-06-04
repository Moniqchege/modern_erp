import type { Request, Response } from "express";
import {
  ListPaymentsQuerySchema,
  RecordPaymentSchema,
} from "../../validation/sales/payment.schemas";
import {
  listCustomerPayments,
  recordCustomerPayment,
} from "../../services/sales/payment.service";

export async function listPaymentsController(req: Request, res: Response) {
  const parse = ListPaymentsQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid query parameters",
      errors: parse.error.flatten(),
    });
  }
  const payments = await listCustomerPayments(parse.data);
  res.status(200).json({ payments });
}

export async function recordPaymentController(req: Request, res: Response) {
  const parse = RecordPaymentSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parse.error.flatten(),
    });
  }

  const result = await recordCustomerPayment(parse.data);
  res.status(201).json(result);
}
