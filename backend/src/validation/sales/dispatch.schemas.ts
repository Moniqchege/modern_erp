import { z } from "zod";

export const DispatchStatusSchema = z.enum([
  "PENDING",
  "LOADED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
]);

export const DispatchItemSchema = z.object({
  palletId: z.string().min(1),
  quantity: z.number().positive(),
});

export const CreateDispatchSchema = z.object({
  customerId: z.string().min(1),
  invoiceId: z.string().min(1).optional().nullable(),
  salesOrderId: z.string().min(1).optional().nullable(),
  truckRegistration: z.string().min(1).max(32),
  driverName: z.string().min(1).max(128),
  driverPhone: z.string().max(32).optional().nullable(),
  deliveryAddress: z.string().min(1).max(2000),
  remarks: z.string().max(2000).optional().nullable(),
  items: z.array(DispatchItemSchema).optional().default([]),
});

export const UpdateDispatchStatusSchema = z.object({
  status: DispatchStatusSchema,
  loadedAt: z.coerce.date().optional(),
  deliveredAt: z.coerce.date().optional(),
});

export const ListDispatchesQuerySchema = z.object({
  customerId: z.string().min(1).optional(),
  status: DispatchStatusSchema.optional(),
});

export type CreateDispatchInput = z.infer<typeof CreateDispatchSchema>;
export type UpdateDispatchStatusInput = z.infer<typeof UpdateDispatchStatusSchema>;
export type ListDispatchesQuery = z.infer<typeof ListDispatchesQuerySchema>;
