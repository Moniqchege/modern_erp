"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListCustomersQuerySchema = exports.CreateCustomerSchema = exports.CustomerAccountStatusSchema = exports.CustomerTypeSchema = void 0;
const zod_1 = require("zod");
exports.CustomerTypeSchema = zod_1.z.enum([
    "DISTRIBUTOR",
    "WHOLESALER",
    "RETAILER",
    "WALK_IN",
]);
exports.CustomerAccountStatusSchema = zod_1.z.enum([
    "ACTIVE",
    "INACTIVE",
    "SUSPENDED",
]);
exports.CreateCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    email: zod_1.z.string().email("Invalid email format").optional().nullable(),
    phone: zod_1.z.string().max(32).optional().nullable(),
    address: zod_1.z.string().max(500).optional().nullable(),
    type: exports.CustomerTypeSchema.optional().default("RETAILER"),
    creditLimit: zod_1.z.number().nonnegative().optional().default(0),
    creditDays: zod_1.z.number().int().positive().max(365).optional().default(30),
    taxPin: zod_1.z.string().max(32).optional().nullable(),
    status: exports.CustomerAccountStatusSchema.optional().default("ACTIVE"),
});
exports.ListCustomersQuerySchema = zod_1.z.object({
    type: exports.CustomerTypeSchema.optional(),
    creditStatus: zod_1.z.enum(["over_limit", "has_balance", "clear"]).optional(),
    status: exports.CustomerAccountStatusSchema.optional(),
});
