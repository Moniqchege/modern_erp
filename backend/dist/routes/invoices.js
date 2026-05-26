"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoicesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const server_1 = require("../server");
exports.invoicesRouter = (0, express_1.Router)();
const CreateInvoiceSchema = zod_1.z.object({
    invoiceNumber: zod_1.z.string().min(1).max(64),
    subtotal: zod_1.z.number().nonnegative(),
    tax: zod_1.z.number().nonnegative(),
    status: zod_1.z.enum(["DRAFT", "ISSUED", "PAID", "VOID"]).optional().default("DRAFT"),
    customerId: zod_1.z.string().min(1),
    createdById: zod_1.z.string().min(1),
});
// GET all invoices
exports.invoicesRouter.get("/", async (_req, res) => {
    try {
        const invoices = await server_1.prisma.invoice.findMany({
            include: {
                customer: true,
                createdBy: true,
            },
            orderBy: { createdAt: "desc" },
        });
        res.status(200).json({ invoices });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch invoices", error: String(error) });
    }
});
// POST a new invoice
exports.invoicesRouter.post("/", async (req, res) => {
    try {
        const parse = CreateInvoiceSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                message: "Invalid request body",
                errors: parse.error.flatten(),
            });
        }
        const input = parse.data;
        // Check if invoice number is unique
        const existingInvoice = await server_1.prisma.invoice.findUnique({
            where: { invoiceNumber: input.invoiceNumber },
        });
        if (existingInvoice) {
            return res.status(400).json({
                message: `Invoice number ${input.invoiceNumber} already exists`,
            });
        }
        // Verify Customer exists
        const customer = await server_1.prisma.customer.findUnique({
            where: { id: input.customerId },
        });
        if (!customer) {
            return res.status(400).json({
                message: `Customer with ID ${input.customerId} not found`,
            });
        }
        // Verify User exists, if not, create a default user for local convenience
        let user = await server_1.prisma.user.findUnique({
            where: { id: input.createdById },
        });
        if (!user) {
            // Check if any user exists or create a default one
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
                status: input.status,
                customerId: input.customerId,
                createdById: input.createdById,
                issuedAt: input.status !== "DRAFT" ? new Date() : null,
            },
            include: {
                customer: true,
                createdBy: true,
            },
        });
        res.status(201).json({ invoice });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create invoice", error: String(error) });
    }
});
