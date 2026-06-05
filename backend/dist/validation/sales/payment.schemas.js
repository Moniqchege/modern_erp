"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListPaymentsQuerySchema = exports.RecordPaymentSchema = exports.PaymentMethodSchema = void 0;
const zod_1 = require("zod");
exports.PaymentMethodSchema = zod_1.z.enum(["MPESA", "BANK", "CASH", "CHEQUE"]);
exports.RecordPaymentSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1),
    invoiceId: zod_1.z.string().min(1),
    amountPaid: zod_1.z.number().positive(),
    paymentMethod: exports.PaymentMethodSchema,
    transactionReference: zod_1.z.string().max(128).optional().nullable(),
    paidAt: zod_1.z.coerce.date().optional(),
});
exports.ListPaymentsQuerySchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1).optional(),
    invoiceId: zod_1.z.string().min(1).optional(),
});
