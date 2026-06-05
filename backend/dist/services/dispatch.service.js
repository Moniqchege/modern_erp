"use strict";
/**
 * Customer delivery dispatch — truck loads with optional pallet traceability.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDispatch = createDispatch;
exports.getAllDispatches = getAllDispatches;
exports.getDispatchById = getDispatchById;
exports.updateDispatchStatus = updateDispatchStatus;
exports.getDispatchSummaryByCustomer = getDispatchSummaryByCustomer;
const library_1 = require("@prisma/client/runtime/library");
const http_error_1 = require("../errors/http-error");
const server_1 = require("../server");
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
    };
}
async function createDispatch(data) {
    const customer = await server_1.prisma.customer.findUnique({
        where: { id: data.customerId },
    });
    if (!customer) {
        throw new http_error_1.NotFoundError(`Customer ${data.customerId} not found`);
    }
    if (data.invoiceId) {
        const invoice = await server_1.prisma.invoice.findUnique({
            where: { id: data.invoiceId },
        });
        if (!invoice) {
            throw new http_error_1.NotFoundError(`Invoice ${data.invoiceId} not found`);
        }
        if (invoice.customerId !== data.customerId) {
            throw new http_error_1.BadRequestError("Invoice does not belong to this customer");
        }
    }
    const dispatchNumber = await generateDispatchNumber();
    for (const item of data.items) {
        const pallet = await server_1.prisma.pallet.findUnique({
            where: { id: item.palletId },
            include: { finishedGoodsBatch: true },
        });
        if (!pallet) {
            throw new http_error_1.NotFoundError(`Pallet not found: ${item.palletId}`);
        }
        const existingDispatch = await server_1.prisma.dispatchItem.findFirst({
            where: { palletId: item.palletId },
        });
        if (existingDispatch) {
            throw new http_error_1.BadRequestError(`Pallet ${pallet.palletBarcode} has already been dispatched`);
        }
    }
    const dispatch = await server_1.prisma.dispatchLog.create({
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
                    quantity: new library_1.Decimal(item.quantity),
                })),
            },
        },
        include: dispatchInclude(),
    });
    for (const item of data.items) {
        const pallet = await server_1.prisma.pallet.findUnique({
            where: { id: item.palletId },
            include: { finishedGoodsBatch: true },
        });
        if (pallet?.finishedGoodsBatchId) {
            await server_1.prisma.finishedGoodsBatch.update({
                where: { id: pallet.finishedGoodsBatchId },
                data: {
                    currentQuantity: { decrement: item.quantity },
                },
            });
        }
    }
    return dispatch;
}
async function getAllDispatches(status) {
    return server_1.prisma.dispatchLog.findMany({
        where: status ? { status } : undefined,
        include: dispatchInclude(),
        orderBy: { createdAt: "desc" },
    });
}
async function getDispatchById(id) {
    const dispatch = await server_1.prisma.dispatchLog.findUnique({
        where: { id },
        include: dispatchInclude(),
    });
    if (!dispatch) {
        throw new http_error_1.NotFoundError(`Dispatch not found: ${id}`);
    }
    return dispatch;
}
async function updateDispatchStatus(id, data) {
    await getDispatchById(id);
    const loadedAt = data.loadedAt ??
        (data.status === "LOADED" || data.status === "IN_TRANSIT"
            ? new Date()
            : undefined);
    const deliveredAt = data.deliveredAt ?? (data.status === "DELIVERED" ? new Date() : undefined);
    return server_1.prisma.dispatchLog.update({
        where: { id },
        data: {
            status: data.status,
            loadedAt,
            deliveredAt,
        },
        include: dispatchInclude(),
    });
}
async function getDispatchSummaryByCustomer(customerId) {
    const dispatches = await server_1.prisma.dispatchLog.findMany({
        where: { customerId },
        include: { items: true },
    });
    const totalDispatches = dispatches.length;
    const pendingDispatches = dispatches.filter((d) => d.status === "PENDING").length;
    const deliveredDispatches = dispatches.filter((d) => d.status === "DELIVERED").length;
    const totalQuantity = dispatches.reduce((sum, dispatch) => {
        return (sum +
            dispatch.items.reduce((itemSum, item) => itemSum + Number(item.quantity), 0));
    }, 0);
    return {
        customerId,
        totalDispatches,
        pendingDispatches,
        deliveredDispatches,
        totalQuantity,
    };
}
async function generateDispatchNumber() {
    const year = new Date().getFullYear();
    const count = await server_1.prisma.dispatchLog.count({
        where: {
            dispatchNumber: { startsWith: `DISP-${year}-` },
        },
    });
    return `DISP-${year}-${String(count + 1).padStart(4, "0")}`;
}
exports.default = {
    createDispatch,
    getAllDispatches,
    getDispatchById,
    updateDispatchStatus,
    getDispatchSummaryByCustomer,
};
