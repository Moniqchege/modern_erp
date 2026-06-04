import { prisma } from "../../server";
import { BadRequestError, NotFoundError } from "../../errors/http-error";
import { customerRepository } from "../../repositories/customer.repository";
import { salesOrderRepository } from "../../repositories/sales-order.repository";
import type {
  CreateSalesOrderInput,
  ListSalesOrdersQuery,
  UpdateSalesOrderInput,
} from "../../validation/sales/sales-order.schemas";
import { checkCreditAvailability, assertCreditAvailable } from "./credit.service";
import { calculateTieredPricing, roundMoney, type PricedLine } from "./pricing.service";
import { VAT_RATE } from "./sales.constants";
import { updateInventoryReservation } from "./inventory-reservation.service";
import { publishDomainEvent } from "../../events/eventBus";
import { SALES_EVENTS } from "../../events/salesEventTypes";

function formatOrder(
  order: NonNullable<Awaited<ReturnType<typeof salesOrderRepository.findById>>>
) {
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

export async function createSalesOrder(input: CreateSalesOrderInput) {
  const customer = await customerRepository.findById(input.customerId);
  if (!customer) {
    throw new NotFoundError(`Customer with ID ${input.customerId} not found`);
  }
  if (customer.status !== "ACTIVE") {
    throw new BadRequestError("Customer account is not active");
  }

  const pricedLines: PricedLine[] = [];
  for (const line of input.items) {
    pricedLines.push(
      await calculateTieredPricing(
        input.customerId,
        line.productSku,
        line.quantity
      )
    );
  }

  const subtotal = roundMoney(
    pricedLines.reduce((sum, l) => sum + l.lineTotal, 0)
  );
  const taxAmount = roundMoney(subtotal * VAT_RATE);
  const totalAmount = roundMoney(subtotal + taxAmount);

  await checkCreditAvailability(input.customerId, totalAmount);

  const order = await prisma.$transaction(async (tx) => {
    const freshCustomer = await tx.customer.findUnique({
      where: { id: input.customerId },
    });
    if (!freshCustomer) {
      throw new NotFoundError(`Customer with ID ${input.customerId} not found`);
    }
    assertCreditAvailable(freshCustomer, totalAmount);

    const orderNumber = await salesOrderRepository.nextOrderNumber(tx);

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
      const nextBalance =
        Number(freshCustomer.currentBalance) + totalAmount;
      await tx.customer.update({
        where: { id: freshCustomer.id },
        data: { currentBalance: nextBalance.toFixed(2) },
      });
    }

    return created;
  });

  await updateInventoryReservation(
    order.id,
    pricedLines.map((l) => ({ productSku: l.productSku, quantity: l.quantity }))
  );

  await publishDomainEvent({
    eventType: SALES_EVENTS.ORDER_CONFIRMED,
    aggregateType: "SalesOrder",
    aggregateId: order.id,
    payload: { orderNumber: order.orderNumber, totalAmount },
  });

  return formatOrder(order);
}

export async function listSalesOrders(query: ListSalesOrdersQuery) {
  const rows = await salesOrderRepository.findMany(query);
  return rows.map((o) => formatOrder(o));
}

export async function getSalesOrderById(id: string) {
  const order = await salesOrderRepository.findById(id);
  if (!order) {
    throw new NotFoundError(`Sales order ${id} not found`);
  }
  return formatOrder(order);
}

export async function updateSalesOrder(id: string, input: UpdateSalesOrderInput) {
  const order = await salesOrderRepository.findById(id);
  if (!order) {
    throw new NotFoundError(`Sales order ${id} not found`);
  }
  if (order.orderStatus === "CANCELLED") {
    throw new BadRequestError("Cannot update a cancelled order");
  }

  const dispatchStatus =
    input.dispatchStatus ??
    (input.orderStatus === "FULFILLED" ? ("DELIVERED" as const) : undefined);

  const updated = await salesOrderRepository.update(id, {
    ...(input.orderStatus ? { orderStatus: input.orderStatus } : {}),
    ...(dispatchStatus ? { dispatchStatus } : {}),
  });

  return formatOrder(updated);
}

export async function cancelSalesOrder(id: string) {
  const order = await salesOrderRepository.findById(id);
  if (!order) {
    throw new NotFoundError(`Sales order ${id} not found`);
  }
  if (order.orderStatus === "CANCELLED") {
    throw new BadRequestError("Order is already cancelled");
  }
  if (order.invoice) {
    throw new BadRequestError("Cannot cancel an order that already has an invoice");
  }

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id },
      data: { orderStatus: "CANCELLED", dispatchStatus: "PENDING" },
    });

    const customer = await tx.customer.findUnique({
      where: { id: order.customerId },
    });
    if (
      customer &&
      customer.type !== "WALK_IN" &&
      Number(customer.creditLimit) > 0
    ) {
      const nextBalance = Math.max(
        0,
        Number(customer.currentBalance) - Number(order.totalAmount)
      );
      await tx.customer.update({
        where: { id: customer.id },
        data: { currentBalance: nextBalance.toFixed(2) },
      });
    }
  });

  const refreshed = await salesOrderRepository.findById(id);
  return formatOrder(refreshed!);
}
