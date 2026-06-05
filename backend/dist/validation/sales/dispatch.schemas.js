"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListDispatchesQuerySchema = exports.UpdateDispatchStatusSchema = exports.CreateDispatchSchema = exports.DispatchItemSchema = exports.DispatchStatusSchema = void 0;
const zod_1 = require("zod");
exports.DispatchStatusSchema = zod_1.z.enum([
    "PENDING",
    "LOADED",
    "IN_TRANSIT",
    "DELIVERED",
    "CANCELLED",
]);
exports.DispatchItemSchema = zod_1.z.object({
    palletId: zod_1.z.string().min(1),
    quantity: zod_1.z.number().positive(),
});
exports.CreateDispatchSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1),
    invoiceId: zod_1.z.string().min(1).optional().nullable(),
    salesOrderId: zod_1.z.string().min(1).optional().nullable(),
    truckRegistration: zod_1.z.string().min(1).max(32),
    driverName: zod_1.z.string().min(1).max(128),
    driverPhone: zod_1.z.string().max(32).optional().nullable(),
    deliveryAddress: zod_1.z.string().min(1).max(2000),
    remarks: zod_1.z.string().max(2000).optional().nullable(),
    items: zod_1.z.array(exports.DispatchItemSchema).optional().default([]),
});
exports.UpdateDispatchStatusSchema = zod_1.z.object({
    status: exports.DispatchStatusSchema,
    loadedAt: zod_1.z.coerce.date().optional(),
    deliveredAt: zod_1.z.coerce.date().optional(),
});
exports.ListDispatchesQuerySchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1).optional(),
    status: exports.DispatchStatusSchema.optional(),
});
