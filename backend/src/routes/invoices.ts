import { Router } from "express";
import { z } from "zod";
import { prisma } from "../server";

export const invoicesRouter = Router();

const CreateInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(64),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  status: z.enum(["DRAFT", "ISSUED", "PAID", "VOID"]).optional().default("DRAFT"),
  customerId: z.string().min(1),
  createdById: z.string().min(1),
});

type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

// GET all invoices
invoicesRouter.get("/", async (_req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        customer: true,
        createdBy: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ invoices });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch invoices", error: String(error) });
  }
});

// POST a new invoice
invoicesRouter.post("/", async (req, res) => {
  try {
    const parse = CreateInvoiceSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        message: "Invalid request body",
        errors: parse.error.flatten(),
      });
    }

    const input: CreateInvoiceInput = parse.data;

    // Check if invoice number is unique
    const existingInvoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: input.invoiceNumber },
    });
    if (existingInvoice) {
      return res.status(400).json({
        message: `Invoice number ${input.invoiceNumber} already exists`,
      });
    }

    // Verify Customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!customer) {
      return res.status(400).json({
        message: `Customer with ID ${input.customerId} not found`,
      });
    }

    // Verify User exists, if not, create a default user for local convenience
    let user = await prisma.user.findUnique({
      where: { id: input.createdById },
    });
    if (!user) {
      // Check if any user exists or create a default one
      user = await prisma.user.create({
        data: {
          id: input.createdById,
          email: "admin@erp.local",
          name: "System Admin",
          role: "ADMIN",
        },
      });
    }

    const total = input.subtotal + input.tax;

    const invoice = await prisma.invoice.create({
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
  } catch (error) {
    res.status(500).json({ message: "Failed to create invoice", error: String(error) });
  }
});
