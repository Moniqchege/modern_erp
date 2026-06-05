"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapDispatchStatusToSales = mapDispatchStatusToSales;
exports.listSalesDispatches = listSalesDispatches;
exports.getSalesDispatchById = getSalesDispatchById;
exports.createSalesDispatch = createSalesDispatch;
exports.patchSalesDispatchStatus = patchSalesDispatchStatus;
exports.listAvailablePallets = listAvailablePallets;
const server_1 = require("../../server");
const invoice_repository_1 = require("../../repositories/invoice.repository");
const sales_order_repository_1 = require("../../repositories/sales-order.repository");
const dispatch_service_1 = require("../dispatch.service");
function formatDispatch(dispatch) {
    return {
        ...dispatch,
        items: dispatch.items.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
        })),
    };
}
function mapDispatchStatusToSales(status) {
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
async function syncSalesOrderDispatch(salesOrderId, dispatchStatus) {
    await sales_order_repository_1.salesOrderRepository.update(salesOrderId, {
        dispatchStatus: mapDispatchStatusToSales(dispatchStatus),
        ...(dispatchStatus === "DELIVERED"
            ? { orderStatus: "FULFILLED" }
            : {}),
    });
}
async function resolveSalesOrderId(salesOrderId, invoiceId) {
    if (salesOrderId)
        return salesOrderId;
    if (!invoiceId)
        return null;
    const invoice = await invoice_repository_1.invoiceRepository.findById(invoiceId);
    return invoice?.salesOrderId ?? null;
}
async function listSalesDispatches(query = {}) {
    const rows = await (0, dispatch_service_1.getAllDispatches)(query.status);
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
async function getSalesDispatchById(id) {
    return formatDispatch(await (0, dispatch_service_1.getDispatchById)(id));
}
async function createSalesDispatch(input) {
    const orderId = await resolveSalesOrderId(input.salesOrderId, input.invoiceId);
    let invoiceId = input.invoiceId ?? undefined;
    if (!invoiceId && orderId) {
        const inv = await invoice_repository_1.invoiceRepository.findBySalesOrderId(orderId);
        invoiceId = inv?.id;
    }
    const dispatch = await (0, dispatch_service_1.createDispatch)({
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
async function patchSalesDispatchStatus(id, input) {
    const existing = await (0, dispatch_service_1.getDispatchById)(id);
    const updated = await (0, dispatch_service_1.updateDispatchStatus)(id, {
        status: input.status,
        loadedAt: input.loadedAt,
        deliveredAt: input.deliveredAt,
    });
    const orderId = await resolveSalesOrderId(null, existing.invoiceId ?? undefined);
    if (orderId) {
        await syncSalesOrderDispatch(orderId, input.status);
    }
    return formatDispatch(updated);
}
async function listAvailablePallets(limit = 50) {
    const pallets = await server_1.prisma.pallet.findMany({
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
