import { z } from "zod";

export const CustomerTypeSchema = z.enum([
  "DISTRIBUTOR",
  "WHOLESALER",
  "RETAILER",
  "WALK_IN",
]);

export const CustomerAccountStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
]);

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email("Invalid email format").optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  type: CustomerTypeSchema.optional().default("RETAILER"),
  creditLimit: z.number().nonnegative().optional().default(0),
  creditDays: z.number().int().positive().max(365).optional().default(30),
  taxPin: z.string().max(32).optional().nullable(),
  status: CustomerAccountStatusSchema.optional().default("ACTIVE"),
});

export const ListCustomersQuerySchema = z.object({
  type: CustomerTypeSchema.optional(),
  creditStatus: z.enum(["over_limit", "has_balance", "clear"]).optional(),
  status: CustomerAccountStatusSchema.optional(),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof ListCustomersQuerySchema>;
