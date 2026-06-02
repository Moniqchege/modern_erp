import { z } from "zod";

export const SalesOrderLineSchema = z.object({
  productSku: z.string().min(1).max(64),
  quantity: z.number().positive(),
});

export const CreateSalesOrderSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(SalesOrderLineSchema).min(1),
  orderDate: z.coerce.date().optional(),
});

export type CreateSalesOrderInput = z.infer<typeof CreateSalesOrderSchema>;
