/**
 * Customer delivery dispatch — truck loads with optional pallet traceability.
 */

import type { DispatchStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { BadRequestError, NotFoundError } from "../errors/http-error";
import { prisma } from "../server";

export interface CreateDispatchData {
  customerId: string;
  truckRegistration: string;
  driverName: string;
  driverPhone?: string;
  deliveryAddress: string;
  remarks?: string;
  invoiceId?: string;
  items: Array<{
    palletId: string;
    quantity: number;
  }>;
}

export interface UpdateDispatchStatusData {
  status: DispatchStatus;
  loadedAt?: Date;
  deliveredAt?: Date;
}

function dispatchInclude() {
  return {
    customer: true,
    invoice: true,
    items: {
      include: {
        pallet: {
          include: { finishedGoodsBatch: true },
        },
      },
    },
  } as const;
}

export async function createDispatch(data: CreateDispatchData) {
  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
  });
  if (!customer) {
    throw new NotFoundError(`Customer ${data.customerId} not found`);
  }

  if (data.invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
    });
    if (!invoice) {
      throw new NotFoundError(`Invoice ${data.invoiceId} not found`);
    }
    if (invoice.customerId !== data.customerId) {
      throw new BadRequestError("Invoice does not belong to this customer");
    }
  }

  const dispatchNumber = await generateDispatchNumber();

  for (const item of data.items) {
    const pallet = await prisma.pallet.findUnique({
      where: { id: item.palletId },
      include: { finishedGoodsBatch: true },
    });

    if (!pallet) {
      throw new NotFoundError(`Pallet not found: ${item.palletId}`);
    }

    const existingDispatch = await prisma.dispatchItem.findFirst({
      where: { palletId: item.palletId },
    });

    if (existingDispatch) {
      throw new BadRequestError(
        `Pallet ${pallet.palletBarcode} has already been dispatched`
      );
    }
  }

  const dispatch = await prisma.dispatchLog.create({
    data: {
      dispatchNumber,
      customerId: data.customerId,
      invoiceId: data.invoiceId,
      truckRegistration: data.truckRegistration,
      driverName: data.driverName,
      driverPhone: data.driverPhone,
      deliveryAddress: data.deliveryAddress,
      remarks: data.remarks,
      items: {
        create: data.items.map((item) => ({
          palletId: item.palletId,
          quantity: new Decimal(item.quantity),
        })),
      },
    },
    include: dispatchInclude(),
  });

  for (const item of data.items) {
    const pallet = await prisma.pallet.findUnique({
      where: { id: item.palletId },
      include: { finishedGoodsBatch: true },
    });

    if (pallet?.finishedGoodsBatchId) {
      await prisma.finishedGoodsBatch.update({
        where: { id: pallet.finishedGoodsBatchId },
        data: {
          currentQuantity: { decrement: item.quantity },
        },
      });
    }
  }

  return dispatch;
}

export async function getAllDispatches(status?: DispatchStatus) {
  return prisma.dispatchLog.findMany({
    where: status ? { status } : undefined,
    include: dispatchInclude(),
    orderBy: { createdAt: "desc" },
  });
}

export async function getDispatchById(id: string) {
  const dispatch = await prisma.dispatchLog.findUnique({
    where: { id },
    include: dispatchInclude(),
  });

  if (!dispatch) {
    throw new NotFoundError(`Dispatch not found: ${id}`);
  }

  return dispatch;
}

export async function updateDispatchStatus(
  id: string,
  data: UpdateDispatchStatusData
) {
  await getDispatchById(id);

  const loadedAt =
    data.loadedAt ??
    (data.status === "LOADED" || data.status === "IN_TRANSIT"
      ? new Date()
      : undefined);
  const deliveredAt =
    data.deliveredAt ?? (data.status === "DELIVERED" ? new Date() : undefined);

  return prisma.dispatchLog.update({
    where: { id },
    data: {
      status: data.status,
      loadedAt,
      deliveredAt,
    },
    include: dispatchInclude(),
  });
}

export async function getDispatchSummaryByCustomer(customerId: string) {
  const dispatches = await prisma.dispatchLog.findMany({
    where: { customerId },
    include: { items: true },
  });

  const totalDispatches = dispatches.length;
  const pendingDispatches = dispatches.filter(
    (d) => d.status === "PENDING"
  ).length;
  const deliveredDispatches = dispatches.filter(
    (d) => d.status === "DELIVERED"
  ).length;

  const totalQuantity = dispatches.reduce((sum, dispatch) => {
    return (
      sum +
      dispatch.items.reduce(
        (itemSum, item) => itemSum + Number(item.quantity),
        0
      )
    );
  }, 0);

  return {
    customerId,
    totalDispatches,
    pendingDispatches,
    deliveredDispatches,
    totalQuantity,
  };
}

async function generateDispatchNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.dispatchLog.count({
    where: {
      dispatchNumber: { startsWith: `DISP-${year}-` },
    },
  });
  return `DISP-${year}-${String(count + 1).padStart(4, "0")}`;
}

export default {
  createDispatch,
  getAllDispatches,
  getDispatchById,
  updateDispatchStatus,
  getDispatchSummaryByCustomer,
};
