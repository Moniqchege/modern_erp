import { InvoiceStatus } from "@prisma/client";
import { prisma } from "../../server";
import { BadRequestError, NotFoundError } from "../../errors/http-error";
import { customerRepository } from "../../repositories/customer.repository";
import { invoiceRepository } from "../../repositories/invoice.repository";
import { paymentRepository } from "../../repositories/payment.repository";
import type {
  ListPaymentsQuery,
  RecordPaymentInput,
} from "../../validation/sales/payment.schemas";
import { publishDomainEvent } from "../../events/eventBus";
import { SALES_EVENTS } from "../../events/salesEventTypes";

function deriveInvoiceStatus(amountDue: number, totalPaid: number): InvoiceStatus {
  if (totalPaid <= 0) return "ISSUED";
  if (totalPaid >= amountDue) return "PAID";
  return "PARTIAL";
}

export async function listCustomerPayments(query: ListPaymentsQuery = {}) {
  const rows = await paymentRepository.findMany(query);
  return rows.map((p) => ({
    ...p,
    amountPaid: Number(p.amountPaid),
    invoice: p.invoice
      ? {
          ...p.invoice,
          total: Number(p.invoice.total),
          amountDue: Number(p.invoice.amountDue),
        }
      : p.invoice,
  }));
}

export async function recordCustomerPayment(input: RecordPaymentInput) {
  const customer = await customerRepository.findById(input.customerId);
  if (!customer) {
    throw new NotFoundError(`Customer with ID ${input.customerId} not found`);
  }

  const invoice = await invoiceRepository.findById(input.invoiceId);
  if (!invoice) {
    throw new NotFoundError(`Invoice ${input.invoiceId} not found`);
  }
  if (invoice.customerId !== input.customerId) {
    throw new BadRequestError("Invoice does not belong to this customer");
  }
  if (invoice.status === "VOID") {
    throw new BadRequestError("Cannot record payment against a void invoice");
  }

  const amountDue = Number(invoice.amountDue);
  const priorPaid = await paymentRepository.sumForInvoice(invoice.id);
  if (priorPaid + input.amountPaid > amountDue + 0.01) {
    throw new BadRequestError(
      `Payment exceeds amount due. Remaining: ${Math.max(0, amountDue - priorPaid).toFixed(2)}`
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const payment = await paymentRepository.create(
      {
        customer: { connect: { id: input.customerId } },
        invoice: { connect: { id: input.invoiceId } },
        amountPaid: input.amountPaid.toFixed(2),
        paymentMethod: input.paymentMethod,
        transactionReference: input.transactionReference,
        paidAt: input.paidAt ?? new Date(),
      },
      tx
    );

    const totalPaid = priorPaid + input.amountPaid;
    const newStatus = deriveInvoiceStatus(amountDue, totalPaid);

    const updatedInvoice = await invoiceRepository.update(
      invoice.id,
      { status: newStatus },
      tx
    );

    const nextBalance = Math.max(
      0,
      Number(customer.currentBalance) - input.amountPaid
    );
    await tx.customer.update({
      where: { id: customer.id },
      data: { currentBalance: nextBalance.toFixed(2) },
    });

    if (invoice.salesOrderId) {
      const orderPaymentStatus =
        newStatus === "PAID" ? "PAID" : totalPaid > 0 ? "PARTIAL" : "PENDING";
      await tx.salesOrder.update({
        where: { id: invoice.salesOrderId },
        data: { paymentStatus: orderPaymentStatus },
      });
    }

    return { payment, invoice: updatedInvoice, totalPaid };
  });

  await publishDomainEvent({
    eventType: SALES_EVENTS.PAYMENT_RECORDED,
    aggregateType: "CustomerPayment",
    aggregateId: result.payment.id,
    payload: {
      customerId: input.customerId,
      invoiceId: input.invoiceId,
      amountPaid: input.amountPaid,
    },
  });

  return {
    payment: {
      ...result.payment,
      amountPaid: Number(result.payment.amountPaid),
    },
    invoice: {
      ...result.invoice,
      subtotal: Number(result.invoice.subtotal),
      tax: Number(result.invoice.tax),
      total: Number(result.invoice.total),
      amountDue: Number(result.invoice.amountDue),
    },
    totalPaid: result.totalPaid,
  };
}
