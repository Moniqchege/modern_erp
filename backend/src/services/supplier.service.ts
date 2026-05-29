/**
 * SUPPLIER SERVICE
 * 
 * Manages supplier/vendor information for raw material traceability.
 * Tracks farm origins, certifications, and supplier performance.
 */

import { prisma } from "../server";

export interface CreateSupplierData {
    code: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    farmLocation?: string;
    certifications?: string;
    businessRegistrationNo?: string;
    taxPin?: string;
    vatNumber?: string;
    bankName?: string;
    bankAccountNo?: string;
    bankBranch?: string;
    bankSwiftCode?: string;
    suppliedItems?: Array<{
        itemProfileId: string;
        isPreferred?: boolean;
        leadTimeDays?: number | null;
        minOrderQty?: number | null;
        lastUnitPrice?: number | null;
        notes?: string | null;
    }>;
}

export interface UpdateSupplierData
    extends Omit<
        Partial<CreateSupplierData>,
        | "contactPerson"
        | "phone"
        | "email"
        | "address"
        | "farmLocation"
        | "certifications"
        | "businessRegistrationNo"
        | "taxPin"
        | "vatNumber"
        | "bankName"
        | "bankAccountNo"
        | "bankBranch"
        | "bankSwiftCode"
    > {

    // allow nulls from zod optional().nullable() parsing
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    farmLocation?: string | null;
    certifications?: string | null;
    businessRegistrationNo?: string | null;
    taxPin?: string | null;
    vatNumber?: string | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankBranch?: string | null;
    bankSwiftCode?: string | null;
    suppliedItems?: Array<{
        itemProfileId: string;
        isPreferred?: boolean;
        leadTimeDays?: number | null;
        minOrderQty?: number | null;
        lastUnitPrice?: number | null;
        notes?: string | null;
    }>;

    isActive?: boolean;
}


/**
 * Create a new supplier
 */
export async function createSupplier(data: CreateSupplierData) {
    // Check if supplier code already exists

    const existing = await prisma.supplier.findUnique({
        where: { code: data.code },
    });

    if (existing) {
        throw new Error(`Supplier code already exists: ${data.code}`);
    }

    return prisma.supplier.create({
        // Prisma expects nested create input types; our DTO shape is compatible at runtime.
        // Cast avoids a TS mismatch in this repo.
        data: data as any,
    });
}

/**
 * Get all suppliers
 */
export async function getAllSuppliers(activeOnly: boolean = false) {
    return prisma.supplier.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        include: {
            _count: {
                select: { rawMaizeBatches: true },
            },
            suppliedItems: {
                include: { itemProfile: true },
                orderBy: { createdAt: "desc" },
            },
        },
        orderBy: { createdAt: "desc" },
    });
}

/**
 * Get supplier by ID
 */
export async function getSupplierById(id: string) {
    const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: {
            rawMaizeBatches: {
                orderBy: { receivedAt: "desc" },
                take: 10, // Last 10 batches
            },
            suppliedItems: {
                include: { itemProfile: true },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!supplier) {
        throw new Error(`Supplier not found: ${id}`);
    }

    return supplier;
}

/**
 * Update supplier
 */
export async function updateSupplier(id: string, data: UpdateSupplierData) {
    const { suppliedItems, ...supplierData } = data;
    return prisma.$transaction(async (tx) => {
        if (suppliedItems) {
            await tx.supplierSuppliedItem.deleteMany({ where: { supplierId: id } });
        }

        return tx.supplier.update({
            where: { id },
            data: {
                ...supplierData,
                suppliedItems: suppliedItems
                    ? {
                        create: suppliedItems.map((item) => ({
                            itemProfileId: item.itemProfileId,
                            isPreferred: item.isPreferred ?? false,
                            leadTimeDays: item.leadTimeDays ?? null,
                            minOrderQty: item.minOrderQty ?? null,
                            lastUnitPrice: item.lastUnitPrice ?? null,
                            notes: item.notes ?? null,
                        })),
                    }
                    : undefined,
            },
            include: {
                suppliedItems: {
                    include: { itemProfile: true },
                    orderBy: { createdAt: "desc" },
                },
            },
        });
    });
}

/**
 * Get supplier performance metrics
 */
export async function getSupplierPerformance(supplierId: string) {
    const batches = await prisma.rawMaizeBatch.findMany({
        where: { supplierId },
        include: {
            qualityControlLogs: true,
        },
    });

    const totalBatches = batches.length;
    const approvedBatches = batches.filter((b) => b.status === "APPROVED").length;
    const rejectedBatches = batches.filter((b) => b.status === "REJECTED").length;

    const totalWeight = batches.reduce(
        (sum, b) => sum + parseFloat(b.netWeight.toString()),
        0
    );

    // Calculate average quality metrics
    const qcLogs = batches.flatMap((b) => b.qualityControlLogs);
    const avgMoisture =
        qcLogs.reduce((sum, qc) => sum + parseFloat(qc.moistureContent.toString()), 0) /
        qcLogs.length;
    const avgAflatoxin =
        qcLogs.reduce((sum, qc) => sum + parseFloat(qc.aflatoxinLevel.toString()), 0) /
        qcLogs.length;
    const avgForeignMatter =
        qcLogs.reduce((sum, qc) => sum + parseFloat(qc.foreignMatter.toString()), 0) /
        qcLogs.length;

    return {
        supplierId,
        totalBatches,
        approvedBatches,
        rejectedBatches,
        approvalRate: totalBatches > 0 ? (approvedBatches / totalBatches) * 100 : 0,
        totalWeight,
        averageQuality: {
            moistureContent: avgMoisture || 0,
            aflatoxinLevel: avgAflatoxin || 0,
            foreignMatter: avgForeignMatter || 0,
        },
    };
}

export default {
    createSupplier,
    getAllSuppliers,
    getSupplierById,
    updateSupplier,
    getSupplierPerformance,
};
