/**
 * DISPATCH SERVICE
 * 
 * Manages customer deliveries with full traceability.
 * Tracks exact pallet/bale barcodes loaded onto trucks.
 */

import { PrismaClient, DispatchStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

export interface CreateDispatchData {
    customerId: string;
    truckRegistration: string;
    driverName: string;
    driverPhone?: string;
    deliveryAddress: string;
    remarks?: string;
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

/**
 * Create a new dispatch log
 */
export async function createDispatch(data: CreateDispatchData) {
    // Generate dispatch number
    const dispatchNumber = await generateDispatchNumber();

    // Validate pallets exist and have sufficient quantity
    for (const item of data.items) {
        const pallet = await prisma.pallet.findUnique({
            where: { id: item.palletId },
            include: {
                finishedGoodsBatch: true,
            },
        });

        if (!pallet) {
            throw new Error(`Pallet not found: ${item.palletId}`);
        }

        // Check if pallet has already been dispatched
        const existingDispatch = await prisma.dispatchItem.findFirst({
            where: { palletId: item.palletId },
        });

        if (existingDispatch) {
            throw new Error(
                `Pallet ${pallet.palletBarcode} has already been dispatched`
            );
        }
    }

    // Create dispatch log with items
    const dispatch = await prisma.dispatchLog.create({
        data: {
            dispatchNumber,
            customerId: data.customerId,
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
        include: {
            customer: true,
            items: {
                include: {
                    pallet: {
                        include: {
                            finishedGoodsBatch: true,
                        },
                    },
                },
            },
        },
    });

    // Update finished goods batch quantities
    for (const item of data.items) {
        const pallet = await prisma.pallet.findUnique({
            where: { id: item.palletId },
            include: { finishedGoodsBatch: true },
        });

        if (pallet) {
            await prisma.finishedGoodsBatch.update({
                where: { id: pallet.finishedGoodsBatchId },
                data: {
                    currentQuantity: {
                        decrement: item.quantity,
                    },
                },
            });
        }
    }

    return dispatch;
}

/**
 * Get all dispatches
 */
export async function getAllDispatches(status?: DispatchStatus) {
    return prisma.dispatchLog.findMany({
        where: status ? { status } : undefined,
        include: {
            customer: true,
            items: {
                include: {
                    pallet: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
}

/**
 * Get dispatch by ID
 */
export async function getDispatchById(id: string) {
    const dispatch = await prisma.dispatchLog.findUnique({
        where: { id },
        include: {
            customer: true,
            items: {
                include: {
                    pallet: {
                        include: {
                            finishedGoodsBatch: {
                                include: {
                                    productionRun: true,
                                },
                            },
                            bales: {
                                include: {
                                    bags: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!dispatch) {
        throw new Error(`Dispatch not found: ${id}`);
    }

    return dispatch;
}

/**
 * Update dispatch status
 */
export async function updateDispatchStatus(
    id: string,
    data: UpdateDispatchStatusData
) {
    return prisma.dispatchLog.update({
        where: { id },
        data: {
            status: data.status,
            loadedAt: data.loadedAt,
            deliveredAt: data.deliveredAt,
        },
    });
}

/**
 * Get dispatch summary by customer
 */
export async function getDispatchSummaryByCustomer(customerId: string) {
    const dispatches = await prisma.dispatchLog.findMany({
        where: { customerId },
        include: {
            items: true,
        },
    });

    const totalDispatches = dispatches.length;
    const pendingDispatches = dispatches.filter(
        (d) => d.status === DispatchStatus.PENDING
    ).length;
    const deliveredDispatches = dispatches.filter(
        (d) => d.status === DispatchStatus.DELIVERED
    ).length;

    const totalQuantity = dispatches.reduce((sum, dispatch) => {
        return (
            sum +
            dispatch.items.reduce(
                (itemSum, item) => itemSum + parseFloat(item.quantity.toString()),
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

/**
 * Generate unique dispatch number
 */
async function generateDispatchNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.dispatchLog.count({
        where: {
            dispatchNumber: {
                startsWith: `DISP-${year}-`,
            },
        },
    });

    const sequence = count + 1;
    return `DISP-${year}-${sequence.toString().padStart(4, "0")}`;
}

export default {
    createDispatch,
    getAllDispatches,
    getDispatchById,
    updateDispatchStatus,
    getDispatchSummaryByCustomer,
};
