import type { Request, Response } from "express";
import { z } from "zod";
import { ConflictError, NotFoundError } from "../../errors/http-error";
import { prisma } from "../../server";
import { GenerateInvoiceSchema } from "../../validation/sales/invoice.schemas";
import {
  generateInvoiceFromOrder,
  listInvoices,
} from "../../services/sales/invoice.service";

const LegacyCreateInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(64),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  status: z
    .enum(["DRAFT", "ISSUED", "PARTIAL", "PAID", "VOID", "OVERDUE"])
    .optional()
    .default("DRAFT"),
  customerId: z.string().min(1),
  createdById: z.string().min(1),
  dueDate: z.coerce.date().optional(),
});

export async function listInvoicesController(_req: Request, res: Response) {
  const invoices = await listInvoices();
  res.status(200).json({ invoices });
}

export async function generateInvoiceController(req: Request, res: Response) {
  const parse = GenerateInvoiceSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parse.error.flatten(),
    });
  }

  const invoice = await generateInvoiceFromOrder(parse.data);
  res.status(201).json({ invoice });
}

/** Legacy manual invoice creation (kept for existing UI) */
export async function createLegacyInvoiceController(req: Request, res: Response) {
  const parse = LegacyCreateInvoiceSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parse.error.flatten(),
    });
  }

  const input = parse.data;

  const existingInvoice = await prisma.invoice.findUnique({
    where: { invoiceNumber: input.invoiceNumber },
  });
  if (existingInvoice) {
    throw new ConflictError(
      `Invoice number ${input.invoiceNumber} already exists`
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
  });
  if (!customer) {
    throw new NotFoundError(`Customer with ID ${input.customerId} not found`);
  }

  let user = await prisma.user.findUnique({ where: { id: input.createdById } });
  if (!user) {
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
