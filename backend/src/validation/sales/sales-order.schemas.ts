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

export const SalesOrderStatusSchema = z.enum([
  "DRAFT",
  "CONFIRMED",
  "CANCELLED",
  "FULFILLED",
]);

export const SalesDispatchStatusSchema = z.enum([
  "PENDING",
  "LOADING",
  "DISPATCHED",
  "DELIVERED",
]);

export const ListSalesOrdersQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  orderStatus: SalesOrderStatusSchema.optional(),
  dispatchStatus: SalesDispatchStatusSchema.optional(),
  paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
});

export const UpdateSalesOrderSchema = z.object({
  orderStatus: SalesOrderStatusSchema.optional(),
  dispatchStatus: SalesDispatchStatusSchema.optional(),
});

export type CreateSalesOrderInput = z.infer<typeof CreateSalesOrderSchema>;
export type ListSalesOrdersQuery = z.infer<typeof ListSalesOrdersQuerySchema>;
export type UpdateSalesOrderInput = z.infer<typeof UpdateSalesOrderSchema>;
