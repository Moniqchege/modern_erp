"use strict";
/**
 * SUPPLIER SERVICE
 *
 * Manages supplier/vendor information for raw material traceability.
 * Tracks farm origins, certifications, and supplier performance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupplier = createSupplier;
exports.getAllSuppliers = getAllSuppliers;
exports.getSupplierById = getSupplierById;
exports.updateSupplier = updateSupplier;
exports.getSupplierPerformance = getSupplierPerformance;
const server_1 = require("../server");
/**
 * Create a new supplier
 */
async function createSupplier(data) {
    // Check if supplier code already exists
    const existing = await server_1.prisma.supplier.findUnique({
        where: { code: data.code },
    });
    if (existing) {
        throw new Error(`Supplier code already exists: ${data.code}`);
    }
    return server_1.prisma.supplier.create({
        data,
    });
}
/**
 * Get all suppliers
 */
async function getAllSuppliers(activeOnly = false) {
    return server_1.prisma.supplier.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        include: {
            _count: {
                select: { rawMaizeBatches: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });
}
/**
 * Get supplier by ID
 */
async function getSupplierById(id) {
    const supplier = await server_1.prisma.supplier.findUnique({
        where: { id },
        include: {
            rawMaizeBatches: {
                orderBy: { receivedAt: "desc" },
                take: 10, // Last 10 batches
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
async function updateSupplier(id, data) {
    return server_1.prisma.supplier.update({
        where: { id },
        data,
    });
}
/**
 * Get supplier performance metrics
 */
async function getSupplierPerformance(supplierId) {
    const batches = await server_1.prisma.rawMaizeBatch.findMany({
        where: { supplierId },
        include: {
            qualityControlLogs: true,
        },
    });
    const totalBatches = batches.length;
    const approvedBatches = batches.filter((b) => b.status === "APPROVED").length;
    const rejectedBatches = batches.filter((b) => b.status === "REJECTED").length;
    const totalWeight = batches.reduce((sum, b) => sum + parseFloat(b.netWeight.toString()), 0);
    // Calculate average quality metrics
    const qcLogs = batches.flatMap((b) => b.qualityControlLogs);
    const avgMoisture = qcLogs.reduce((sum, qc) => sum + parseFloat(qc.moistureContent.toString()), 0) /
        qcLogs.length;
    const avgAflatoxin = qcLogs.reduce((sum, qc) => sum + parseFloat(qc.aflatoxinLevel.toString()), 0) /
        qcLogs.length;
    const avgForeignMatter = qcLogs.reduce((sum, qc) => sum + parseFloat(qc.foreignMatter.toString()), 0) /
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
exports.default = {
    createSupplier,
    getAllSuppliers,
    getSupplierById,
    updateSupplier,
    getSupplierPerformance,
};
