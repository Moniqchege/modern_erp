"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSalesOrderSchema = exports.SalesOrderLineSchema = void 0;
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
