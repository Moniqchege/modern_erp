"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoiceFromOrder = generateInvoiceFromOrder;
exports.getInvoiceById = getInvoiceById;
exports.listInvoices = listInvoices;
const server_1 = require("../../server");
const http_error_1 = require("../../errors/http-error");
const invoice_repository_1 = require("../../repositories/invoice.repository");
const sales_order_repository_1 = require("../../repositories/sales-order.repository");
const eventBus_1 = require("../../events/eventBus");
const salesEventTypes_1 = require("../../events/salesEventTypes");
function formatInvoice(invoice) {
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
async function resolveCreatedById(createdById) {
    if (createdById) {
        const user = await server_1.prisma.user.findUnique({ where: { id: createdById } });
        if (user)
            return user.id;
    }
    const fallback = await server_1.prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (fallback)
        return fallback.id;
    const created = await server_1.prisma.user.create({
        data: {
            email: "sales@erp.local",
            name: "Sales System",
            role: "ADMIN",
        },
    });
    return created.id;
}
async function generateInvoiceFromOrder(input) {
    const order = await sales_order_repository_1.salesOrderRepository.findById(input.salesOrderId);
    if (!order) {
        throw new http_error_1.NotFoundError(`Sales order ${input.salesOrderId} not found`);
    }
    if (order.orderStatus !== "CONFIRMED" && order.orderStatus !== "FULFILLED") {
        throw new http_error_1.BadRequestError("Only confirmed or fulfilled sales orders can be invoiced");
    }
    const existing = await invoice_repository_1.invoiceRepository.findBySalesOrderId(order.id);
    if (existing) {
        throw new http_error_1.ConflictError(`Invoice already exists for sales order ${order.orderNumber}`);
    }
    const createdById = await resolveCreatedById(input.createdById);
    const creditDays = order.customer.creditDays ?? 30;
    const dueDate = input.dueDate ??
        new Date(Date.now() + creditDays * 24 * 60 * 60 * 1000);
    const invoice = await server_1.prisma.$transaction(async (tx) => {
        const invoiceNumber = await invoice_repository_1.invoiceRepository.nextInvoiceNumber(tx);
        const subtotal = Number(order.subtotal);
        const tax = Number(order.taxAmount);
        const total = Number(order.totalAmount);
        return invoice_repository_1.invoiceRepository.create({
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
        }, tx);
    });
    await (0, eventBus_1.publishDomainEvent)({
        eventType: salesEventTypes_1.SALES_EVENTS.INVOICE_ISSUED,
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
async function getInvoiceById(id) {
    const invoice = await invoice_repository_1.invoiceRepository.findById(id);
    if (!invoice) {
        throw new http_error_1.NotFoundError(`Invoice ${id} not found`);
    }
    return formatInvoice(invoice);
}
async function listInvoices(query = {}) {
    const rows = await invoice_repository_1.invoiceRepository.findMany({
        customerId: query.customerId,
        status: query.status,
    });
    return rows.map((inv) => formatInvoice(inv));
}
