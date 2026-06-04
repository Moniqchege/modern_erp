import { z } from "zod";

export const PaymentMethodSchema = z.enum(["MPESA", "BANK", "CASH", "CHEQUE"]);

export const RecordPaymentSchema = z.object({
  customerId: z.string().min(1),
  invoiceId: z.string().min(1),
  amountPaid: z.number().positive(),
  paymentMethod: PaymentMethodSchema,
  transactionReference: z.string().max(128).optional().nullable(),
  paidAt: z.coerce.date().optional(),
});

export const ListPaymentsQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  invoiceId: z.string().min(1).optional(),
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof ListPaymentsQuerySchema>;
