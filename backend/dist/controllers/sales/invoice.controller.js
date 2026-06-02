"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInvoicesController = listInvoicesController;
exports.generateInvoiceController = generateInvoiceController;
exports.createLegacyInvoiceController = createLegacyInvoiceController;
const zod_1 = require("zod");
const http_error_1 = require("../../errors/http-error");
const server_1 = require("../../server");
const invoice_schemas_1 = require("../../validation/sales/invoice.schemas");
const invoice_service_1 = require("../../services/sales/invoice.service");
const LegacyCreateInvoiceSchema = zod_1.z.object({
    invoiceNumber: zod_1.z.string().min(1).max(64),
    subtotal: zod_1.z.number().nonnegative(),
    tax: zod_1.z.number().nonnegative(),
    status: zod_1.z
        .enum(["DRAFT", "ISSUED", "PARTIAL", "PAID", "VOID", "OVERDUE"])
        .optional()
        .default("DRAFT"),
    customerId: zod_1.z.string().min(1),
    createdById: zod_1.z.string().min(1),
    dueDate: zod_1.z.coerce.date().optional(),
});
async function listInvoicesController(_req, res) {
    const invoices = await (0, invoice_service_1.listInvoices)();
    res.status(200).json({ invoices });
}
async function generateInvoiceController(req, res) {
    const parse = invoice_schemas_1.GenerateInvoiceSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid request body",
            errors: parse.error.flatten(),
        });
    }
    const invoice = await (0, invoice_service_1.generateInvoiceFromOrder)(parse.data);
    res.status(201).json({ invoice });
}
/** Legacy manual invoice creation (kept for existing UI) */
async function createLegacyInvoiceController(req, res) {
    const parse = LegacyCreateInvoiceSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            message: "Invalid request body",
            errors: parse.error.flatten(),
        });
    }
    const input = parse.data;
    const existingInvoice = await server_1.prisma.invoice.findUnique({
        where: { invoiceNumber: input.invoiceNumber },
    });
    if (existingInvoice) {
        throw new http_error_1.ConflictError(`Invoice number ${input.invoiceNumber} already exists`);
    }
    const customer = await server_1.prisma.customer.findUnique({
        where: { id: input.customerId },
    });
    if (!customer) {
        throw new http_error_1.NotFoundError(`Customer with ID ${input.customerId} not found`);
    }
    let user = await server_1.prisma.user.findUnique({ where: { id: input.createdById } });
    if (!user) {
        user = await server_1.prisma.user.create({
            data: {
                id: input.createdById,
                email: "admin@erp.local",
                name: "System Admin",
                role: "ADMIN",
            },
        });
    }
    const total = input.subtotal + input.tax;
    const invoice = await server_1.prisma.invoice.create({
        data: {
            invoiceNumber: input.invoiceNumber,
            subtotal: input.subtotal.toFixed(2),
            tax: input.tax.toFixed(2),
            total: total.toFixed(2),
            amountDue: total.toFixed(2),
            status: input.status,
            customerId: input.customerId,
            createdById: input.createdById,
            dueDate: input.dueDate,
            issuedAt: input.status !== "DRAFT" ? new Date() : null,
        },
        include: {
            customer: true,
            createdBy: true,
        },
    });
    res.status(201).json({ invoice });
}
