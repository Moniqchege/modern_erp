"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordCustomerPayment = recordCustomerPayment;
const server_1 = require("../../server");
const http_error_1 = require("../../errors/http-error");
const customer_repository_1 = require("../../repositories/customer.repository");
const invoice_repository_1 = require("../../repositories/invoice.repository");
const payment_repository_1 = require("../../repositories/payment.repository");
const eventBus_1 = require("../../events/eventBus");
const salesEventTypes_1 = require("../../events/salesEventTypes");
function deriveInvoiceStatus(amountDue, totalPaid) {
    if (totalPaid <= 0)
        return "ISSUED";
    if (totalPaid >= amountDue)
        return "PAID";
    return "PARTIAL";
}
async function recordCustomerPayment(input) {
    const customer = await customer_repository_1.customerRepository.findById(input.customerId);
    if (!customer) {
        throw new http_error_1.NotFoundError(`Customer with ID ${input.customerId} not found`);
    }
    const invoice = await invoice_repository_1.invoiceRepository.findById(input.invoiceId);
    if (!invoice) {
        throw new http_error_1.NotFoundError(`Invoice ${input.invoiceId} not found`);
    }
    if (invoice.customerId !== input.customerId) {
        throw new http_error_1.BadRequestError("Invoice does not belong to this customer");
    }
    if (invoice.status === "VOID") {
        throw new http_error_1.BadRequestError("Cannot record payment against a void invoice");
    }
    const amountDue = Number(invoice.amountDue);
    const priorPaid = await payment_repository_1.paymentRepository.sumForInvoice(invoice.id);
    if (priorPaid + input.amountPaid > amountDue + 0.01) {
        throw new http_error_1.BadRequestError(`Payment exceeds amount due. Remaining: ${Math.max(0, amountDue - priorPaid).toFixed(2)}`);
    }
    const result = await server_1.prisma.$transaction(async (tx) => {
        const payment = await payment_repository_1.paymentRepository.create({
            customer: { connect: { id: input.customerId } },
            invoice: { connect: { id: input.invoiceId } },
            amountPaid: input.amountPaid.toFixed(2),
            paymentMethod: input.paymentMethod,
            transactionReference: input.transactionReference,
            paidAt: input.paidAt ?? new Date(),
        }, tx);
        const totalPaid = priorPaid + input.amountPaid;
        const newStatus = deriveInvoiceStatus(amountDue, totalPaid);
        const updatedInvoice = await invoice_repository_1.invoiceRepository.update(invoice.id, { status: newStatus }, tx);
        const nextBalance = Math.max(0, Number(customer.currentBalance) - input.amountPaid);
        await tx.customer.update({
            where: { id: customer.id },
            data: { currentBalance: nextBalance.toFixed(2) },
        });
        if (invoice.salesOrderId) {
            const orderPaymentStatus = newStatus === "PAID" ? "PAID" : totalPaid > 0 ? "PARTIAL" : "PENDING";
            await tx.salesOrder.update({
                where: { id: invoice.salesOrderId },
                data: { paymentStatus: orderPaymentStatus },
            });
        }
        return { payment, invoice: updatedInvoice, totalPaid };
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: salesEventTypes_1.SALES_EVENTS.PAYMENT_RECORDED,
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
