import type { DispatchStatus, SalesDispatchStatus } from "@prisma/client";
import { prisma } from "../../server";
import { invoiceRepository } from "../../repositories/invoice.repository";
import { salesOrderRepository } from "../../repositories/sales-order.repository";
import {
  createDispatch,
  getAllDispatches,
  getDispatchById,
  updateDispatchStatus,
} from "../dispatch.service";
import type {
  CreateDispatchInput,
  ListDispatchesQuery,
  UpdateDispatchStatusInput,
} from "../../validation/sales/dispatch.schemas";

function formatDispatch(
  dispatch: Awaited<ReturnType<typeof getDispatchById>>
) {
  return {
    ...dispatch,
    items: dispatch.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
    })),
  };
}

export function mapDispatchStatusToSales(
  status: DispatchStatus
): SalesDispatchStatus {
  switch (status) {
    case "PENDING":
      return "PENDING";
    case "LOADED":
      return "LOADING";
    case "IN_TRANSIT":
      return "DISPATCHED";
    case "DELIVERED":
      return "DELIVERED";
    case "CANCELLED":
      return "PENDING";
    default:
      return "PENDING";
  }
}

async function syncSalesOrderDispatch(
  salesOrderId: string,
  dispatchStatus: DispatchStatus
) {
  await salesOrderRepository.update(salesOrderId, {
    dispatchStatus: mapDispatchStatusToSales(dispatchStatus),
    ...(dispatchStatus === "DELIVERED"
      ? { orderStatus: "FULFILLED" }
      : {}),
  });
}

async function resolveSalesOrderId(
  salesOrderId?: string | null,
  invoiceId?: string | null
): Promise<string | null> {
  if (salesOrderId) return salesOrderId;
  if (!invoiceId) return null;
  const invoice = await invoiceRepository.findById(invoiceId);
  return invoice?.salesOrderId ?? null;
}

export async function listSalesDispatches(query: ListDispatchesQuery = {}) {
  const rows = await getAllDispatches(query.status);
  const filtered = query.customerId
    ? rows.filter((d) => d.customerId === query.customerId)
    : rows;
  return filtered.map((d) => ({
    ...d,
    items: d.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
    })),
  }));
}

export async function getSalesDispatchById(id: string) {
  return formatDispatch(await getDispatchById(id));
}

export async function createSalesDispatch(input: CreateDispatchInput) {
  const orderId = await resolveSalesOrderId(
    input.salesOrderId,
    input.invoiceId
  );

  let invoiceId = input.invoiceId ?? undefined;
  if (!invoiceId && orderId) {
    const inv = await invoiceRepository.findBySalesOrderId(orderId);
    invoiceId = inv?.id;
  }

  const dispatch = await createDispatch({
    customerId: input.customerId,
    truckRegistration: input.truckRegistration,
    driverName: input.driverName,
    driverPhone: input.driverPhone ?? undefined,
    deliveryAddress: input.deliveryAddress,
    remarks: input.remarks ?? undefined,
    items: input.items ?? [],
    invoiceId,
  });

  if (orderId) {
    await syncSalesOrderDispatch(orderId, dispatch.status);
  }

  return formatDispatch(dispatch);
}

export async function patchSalesDispatchStatus(
  id: string,
  input: UpdateDispatchStatusInput
) {
  const existing = await getDispatchById(id);
  const updated = await updateDispatchStatus(id, {
    status: input.status,
    loadedAt: input.loadedAt,
    deliveredAt: input.deliveredAt,
  });

  const orderId = await resolveSalesOrderId(
    null,
    existing.invoiceId ?? undefined
  );
  if (orderId) {
    await syncSalesOrderDispatch(orderId, input.status);
  }

  return formatDispatch(updated);
}

export async function listAvailablePallets(limit = 50) {
  const pallets = await prisma.pallet.findMany({
    where: {
      dispatchItems: { none: {} },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      finishedGoodsBatch: { select: { id: true, batchNumber: true } },
    },
  });
  return pallets.map((p) => ({
    id: p.id,
    palletBarcode: p.palletBarcode,
    batchNumber: p.finishedGoodsBatch?.batchNumber ?? null,
  }));
}
