import { z } from "zod";

export const GenerateInvoiceSchema = z.object({
  salesOrderId: z.string().min(1),
  createdById: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional(),
});

export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceSchema>;
