"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateInvoiceSchema = void 0;
const zod_1 = require("zod");
exports.GenerateInvoiceSchema = zod_1.z.object({
    salesOrderId: zod_1.z.string().min(1),
    createdById: zod_1.z.string().min(1).optional(),
    dueDate: zod_1.z.coerce.date().optional(),
});
