"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSalesOrderSchema = exports.ListSalesOrdersQuerySchema = exports.SalesDispatchStatusSchema = exports.SalesOrderStatusSchema = exports.CreateSalesOrderSchema = exports.SalesOrderLineSchema = void 0;
const zod_1 = require("zod");
exports.SalesOrderLineSchema = zod_1.z.object({
    productSku: zod_1.z.string().min(1).max(64),
    quantity: zod_1.z.number().positive(),
});
exports.CreateSalesOrderSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1),
    items: zod_1.z.array(exports.SalesOrderLineSchema).min(1),
    orderDate: zod_1.z.coerce.date().optional(),
});
exports.SalesOrderStatusSchema = zod_1.z.enum([
    "DRAFT",
    "CONFIRMED",
    "CANCELLED",
    "FULFILLED",
]);
exports.SalesDispatchStatusSchema = zod_1.z.enum([
    "PENDING",
    "LOADING",
    "DISPATCHED",
    "DELIVERED",
]);
exports.ListSalesOrdersQuerySchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1).optional(),
    orderStatus: exports.SalesOrderStatusSchema.optional(),
    dispatchStatus: exports.SalesDispatchStatusSchema.optional(),
    paymentStatus: zod_1.z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
});
exports.UpdateSalesOrderSchema = zod_1.z.object({
    orderStatus: exports.SalesOrderStatusSchema.optional(),
    dispatchStatus: exports.SalesDispatchStatusSchema.optional(),
});
