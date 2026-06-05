"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSalesOrder = createSalesOrder;
exports.listSalesOrders = listSalesOrders;
exports.getSalesOrderById = getSalesOrderById;
exports.updateSalesOrder = updateSalesOrder;
exports.cancelSalesOrder = cancelSalesOrder;
const server_1 = require("../../server");
const http_error_1 = require("../../errors/http-error");
const customer_repository_1 = require("../../repositories/customer.repository");
const sales_order_repository_1 = require("../../repositories/sales-order.repository");
const credit_service_1 = require("./credit.service");
const pricing_service_1 = require("./pricing.service");
const sales_constants_1 = require("./sales.constants");
const inventory_reservation_service_1 = require("./inventory-reservation.service");
const eventBus_1 = require("../../events/eventBus");
const salesEventTypes_1 = require("../../events/salesEventTypes");
function formatOrder(order) {
    return {
        ...order,
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.taxAmount),
        totalAmount: Number(order.totalAmount),
        items: order.items.map((line) => ({
            ...line,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            discountPercent: Number(line.discountPercent),
            lineTotal: Number(line.lineTotal),
            salesProduct: line.salesProduct
                ? { ...line.salesProduct, basePrice: Number(line.salesProduct.basePrice) }
                : null,
        })),
        customer: order.customer
            ? {
                ...order.customer,
                creditLimit: Number(order.customer.creditLimit),
                currentBalance: Number(order.customer.currentBalance),
            }
            : order.customer,
    };
}
async function createSalesOrder(input) {
    const customer = await customer_repository_1.customerRepository.findById(input.customerId);
    if (!customer) {
        throw new http_error_1.NotFoundError(`Customer with ID ${input.customerId} not found`);
    }
    if (customer.status !== "ACTIVE") {
        throw new http_error_1.BadRequestError("Customer account is not active");
    }
    const pricedLines = [];
    for (const line of input.items) {
        pricedLines.push(await (0, pricing_service_1.calculateTieredPricing)(input.customerId, line.productSku, line.quantity));
    }
    const subtotal = (0, pricing_service_1.roundMoney)(pricedLines.reduce((sum, l) => sum + l.lineTotal, 0));
    const taxAmount = (0, pricing_service_1.roundMoney)(subtotal * sales_constants_1.VAT_RATE);
    const totalAmount = (0, pricing_service_1.roundMoney)(subtotal + taxAmount);
    await (0, credit_service_1.checkCreditAvailability)(input.customerId, totalAmount);
    const order = await server_1.prisma.$transaction(async (tx) => {
        const freshCustomer = await tx.customer.findUnique({
            where: { id: input.customerId },
        });
        if (!freshCustomer) {
            throw new http_error_1.NotFoundError(`Customer with ID ${input.customerId} not found`);
        }
        (0, credit_service_1.assertCreditAvailable)(freshCustomer, totalAmount);
        const orderNumber = await sales_order_repository_1.salesOrderRepository.nextOrderNumber(tx);
        const created = await tx.salesOrder.create({
            data: {
                orderNumber,
                customerId: input.customerId,
                orderDate: input.orderDate ?? new Date(),
                subtotal: subtotal.toFixed(2),
                taxAmount: taxAmount.toFixed(2),
                totalAmount: totalAmount.toFixed(2),
                paymentStatus: "PENDING",
                orderStatus: "CONFIRMED",
                dispatchStatus: "PENDING",
                items: {
                    create: pricedLines.map((line) => ({
                        productSku: line.productSku,
                        quantity: line.quantity.toFixed(3),
                        unitPrice: line.unitPrice.toFixed(2),
                        discountPercent: line.discountPercent.toFixed(2),
                        lineTotal: line.lineTotal.toFixed(2),
                    })),
                },
            },
            include: {
                customer: true,
                items: { include: { salesProduct: true } },
                invoice: true,
            },
        });
        if (freshCustomer.type !== "WALK_IN" && Number(freshCustomer.creditLimit) > 0) {
            const nextBalance = Number(freshCustomer.currentBalance) + totalAmount;
            await tx.customer.update({
                where: { id: freshCustomer.id },
                data: { currentBalance: nextBalance.toFixed(2) },
            });
        }
        return created;
    });
    await (0, inventory_reservation_service_1.updateInventoryReservation)(order.id, pricedLines.map((l) => ({ productSku: l.productSku, quantity: l.quantity })));
    await (0, eventBus_1.publishDomainEvent)({
        eventType: salesEventTypes_1.SALES_EVENTS.ORDER_CONFIRMED,
        aggregateType: "SalesOrder",
        aggregateId: order.id,
        payload: { orderNumber: order.orderNumber, totalAmount },
    });
    return formatOrder(order);
}
async function listSalesOrders(query) {
    const rows = await sales_order_repository_1.salesOrderRepository.findMany(query);
    return rows.map((o) => formatOrder(o));
}
async function getSalesOrderById(id) {
    const order = await sales_order_repository_1.salesOrderRepository.findById(id);
    if (!order) {
        throw new http_error_1.NotFoundError(`Sales order ${id} not found`);
    }
    return formatOrder(order);
}
async function updateSalesOrder(id, input) {
    const order = await sales_order_repository_1.salesOrderRepository.findById(id);
    if (!order) {
        throw new http_error_1.NotFoundError(`Sales order ${id} not found`);
    }
    if (order.orderStatus === "CANCELLED") {
        throw new http_error_1.BadRequestError("Cannot update a cancelled order");
    }
    const dispatchStatus = input.dispatchStatus ??
        (input.orderStatus === "FULFILLED" ? "DELIVERED" : undefined);
    const updated = await sales_order_repository_1.salesOrderRepository.update(id, {
        ...(input.orderStatus ? { orderStatus: input.orderStatus } : {}),
        ...(dispatchStatus ? { dispatchStatus } : {}),
    });
    return formatOrder(updated);
}
async function cancelSalesOrder(id) {
    const order = await sales_order_repository_1.salesOrderRepository.findById(id);
    if (!order) {
        throw new http_error_1.NotFoundError(`Sales order ${id} not found`);
    }
    if (order.orderStatus === "CANCELLED") {
        throw new http_error_1.BadRequestError("Order is already cancelled");
    }
    if (order.invoice) {
        throw new http_error_1.BadRequestError("Cannot cancel an order that already has an invoice");
    }
    await server_1.prisma.$transaction(async (tx) => {
        await tx.salesOrder.update({
            where: { id },
            data: { orderStatus: "CANCELLED", dispatchStatus: "PENDING" },
        });
        const customer = await tx.customer.findUnique({
            where: { id: order.customerId },
        });
        if (customer &&
            customer.type !== "WALK_IN" &&
            Number(customer.creditLimit) > 0) {
            const nextBalance = Math.max(0, Number(customer.currentBalance) - Number(order.totalAmount));
            await tx.customer.update({
                where: { id: customer.id },
                data: { currentBalance: nextBalance.toFixed(2) },
            });
        }
    });
    const refreshed = await sales_order_repository_1.salesOrderRepository.findById(id);
    return formatOrder(refreshed);
}
