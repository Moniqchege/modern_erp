import { prisma } from "../../server";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/http-error";
import { invoiceRepository } from "../../repositories/invoice.repository";
import { salesOrderRepository } from "../../repositories/sales-order.repository";
import type { GenerateInvoiceInput } from "../../validation/sales/invoice.schemas";
import { publishDomainEvent } from "../../events/eventBus";
import { SALES_EVENTS } from "../../events/salesEventTypes";

function formatInvoice(
  invoice: NonNullable<Awaited<ReturnType<typeof invoiceRepository.findById>>>
) {
  return {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    tax: Number(invoice.tax),
    total: Number(invoice.total),
    amountDue: Number(invoice.amountDue),
    payments: invoice.payments.map((p) => ({
      ...p,
      amountPaid: Number(p.amountPaid),
    })),
    salesOrder: invoice.salesOrder
      ? {
          ...invoice.salesOrder,
          subtotal: Number(invoice.salesOrder.subtotal),
          taxAmount: Number(invoice.salesOrder.taxAmount),
          totalAmount: Number(invoice.salesOrder.totalAmount),
        }
      : null,
  };
}

async function resolveCreatedById(createdById?: string): Promise<string> {
  if (createdById) {
    const user = await prisma.user.findUnique({ where: { id: createdById } });
    if (user) return user.id;
  }

  const fallback = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (fallback) return fallback.id;

  const created = await prisma.user.create({
    data: {
      email: "sales@erp.local",
      name: "Sales System",
      role: "ADMIN",
    },
  });
  return created.id;
}

export async function generateInvoiceFromOrder(input: GenerateInvoiceInput) {
  const order = await salesOrderRepository.findById(input.salesOrderId);
  if (!order) {
    throw new NotFoundError(`Sales order ${input.salesOrderId} not found`);
  }
  if (order.orderStatus !== "CONFIRMED" && order.orderStatus !== "FULFILLED") {
    throw new BadRequestError(
      "Only confirmed or fulfilled sales orders can be invoiced"
    );
  }

  const existing = await invoiceRepository.findBySalesOrderId(order.id);
  if (existing) {
    throw new ConflictError(
      `Invoice already exists for sales order ${order.orderNumber}`
    );
  }

  const createdById = await resolveCreatedById(input.createdById);
  const creditDays = order.customer.creditDays ?? 30;
  const dueDate =
    input.dueDate ??
    new Date(Date.now() + creditDays * 24 * 60 * 60 * 1000);

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await invoiceRepository.nextInvoiceNumber(tx);
    const subtotal = Number(order.subtotal);
    const tax = Number(order.taxAmount);
    const total = Number(order.totalAmount);

    return invoiceRepository.create(
      {
        invoiceNumber,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        amountDue: total.toFixed(2),
        status: "ISSUED",
        dueDate,
        issuedAt: new Date(),
        customer: { connect: { id: order.customerId } },
        salesOrder: { connect: { id: order.id } },
        createdBy: { connect: { id: createdById } },
      },
      tx
    );
  });

  await publishDomainEvent({
    eventType: SALES_EVENTS.INVOICE_ISSUED,
    aggregateType: "Invoice",
    aggregateId: invoice.id,
    payload: {
      invoiceNumber: invoice.invoiceNumber,
      salesOrderId: order.id,
      amountDue: Number(invoice.amountDue),
    },
  });

  return formatInvoice(invoice);
}

export async function listInvoices() {
  const rows = await prisma.invoice.findMany({
    include: {
      customer: true,
      createdBy: { select: { id: true, name: true, email: true } },
      salesOrder: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((inv) => formatInvoice(inv as Parameters<typeof formatInvoice>[0]));
}
