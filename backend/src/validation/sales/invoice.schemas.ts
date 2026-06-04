import { z } from "zod";

export const GenerateInvoiceSchema = z.object({
  salesOrderId: z.string().min(1),
  createdById: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional(),
});

export const ListInvoicesQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  status: z
    .enum(["DRAFT", "ISSUED", "PARTIAL", "PAID", "VOID", "OVERDUE"])
    .optional(),
});

export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof ListInvoicesQuerySchema>;
