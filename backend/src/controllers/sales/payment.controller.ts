import type { Request, Response } from "express";
import { RecordPaymentSchema } from "../../validation/sales/payment.schemas";
import { recordCustomerPayment } from "../../services/sales/payment.service";

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
