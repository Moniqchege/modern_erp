"use strict";
/**
 * SILO SERVICE
 *
 * Manages physical storage silos for raw maize.
 * Tracks capacity, current levels, and cleaning schedules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSilo = createSilo;
exports.getAllSilos = getAllSilos;
exports.getSiloById = getSiloById;
exports.updateSilo = updateSilo;
exports.recordCleaning = recordCleaning;
exports.getSiloUtilization = getSiloUtilization;
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const prisma = new client_1.PrismaClient();
/**
 * Create a new silo
 */
async function createSilo(data) {
    // Check if silo number already exists
    const existing = await prisma.silo.findUnique({
        where: { siloNumber: data.siloNumber },
    });
    if (existing) {
        throw new Error(`Silo number already exists: ${data.siloNumber}`);
    }
    return prisma.silo.create({
        data: {
            siloNumber: data.siloNumber,
            location: data.location,
            maxCapacity: new library_1.Decimal(data.maxCapacity),
        },
    });
}
/**
 * Get all silos
 */
async function getAllSilos(activeOnly = false) {
    return prisma.silo.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        include: {
            _count: {
                select: { rawMaizeBatches: true },
            },
        },
        orderBy: { siloNumber: "asc" },
    });
}
/**
 * Get silo by ID with current inventory
 */
async function getSiloById(id) {
    const silo = await prisma.silo.findUnique({
        where: { id },
        include: {
            rawMaizeBatches: {
                where: {
                    currentQuantity: { gt: 0 },
                },
                orderBy: { receivedAt: "desc" },
            },
            cleaningLogs: {
                orderBy: { cleaningDate: "desc" },
                take: 5, // Last 5 cleaning records
            },
        },
    });
    if (!silo) {
        throw new Error(`Silo not found: ${id}`);
    }
    return silo;
}
/**
 * Update silo
 */
async function updateSilo(id, data) {
    return prisma.silo.update({
        where: { id },
        data: {
            ...data,
            maxCapacity: data.maxCapacity ? new library_1.Decimal(data.maxCapacity) : undefined,
        },
    });
}
/**
 * Record silo cleaning
 */
async function recordCleaning(data) {
    const cleaning = await prisma.siloCleaningLog.create({
        data: {
            siloId: data.siloId,
            cleanedBy: data.cleanedBy,
            remarks: data.remarks,
        },
    });
    // Update silo's lastCleanedAt timestamp
    await prisma.silo.update({
        where: { id: data.siloId },
        data: {
            lastCleanedAt: new Date(),
        },
    });
    return cleaning;
}
/**
 * Get silo utilization metrics
 */
async function getSiloUtilization() {
    const silos = await prisma.silo.findMany({
        where: { isActive: true },
    });
    return silos.map((silo) => {
        const maxCapacity = parseFloat(silo.maxCapacity.toString());
        const currentLevel = parseFloat(silo.currentLevel.toString());
        const utilizationPercent = (currentLevel / maxCapacity) * 100;
        const availableCapacity = maxCapacity - currentLevel;
        return {
            siloId: silo.id,
            siloNumber: silo.siloNumber,
            location: silo.location,
            maxCapacity,
            currentLevel,
            availableCapacity,
            utilizationPercent: parseFloat(utilizationPercent.toFixed(2)),
            status: utilizationPercent >= 90
                ? "FULL"
                : utilizationPercent >= 70
                    ? "HIGH"
                    : utilizationPercent >= 30
                        ? "MEDIUM"
                        : "LOW",
            lastCleanedAt: silo.lastCleanedAt,
        };
    });
}
exports.default = {
    createSilo,
    getAllSilos,
    getSiloById,
    updateSilo,
    recordCleaning,
    getSiloUtilization,
};
