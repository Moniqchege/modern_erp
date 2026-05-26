"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const server_1 = require("../server");
const inventory_alert_service_1 = require("../services/inventory-alert.service");
const inventory_reports_service_1 = require("../services/inventory-reports.service");
const inventory_dashboard_service_1 = require("../services/inventory-dashboard.service");
const store_seed_service_1 = require("../services/store-seed.service");
const store_inventory_service_1 = require("../services/store-inventory.service");
exports.inventoryRouter = (0, express_1.Router)();
const optionalDecimal = zod_1.z.number().nonnegative().optional().nullable();
const CreateInventoryItemSchema = zod_1.z.object({
    sku: zod_1.z.string().min(1).max(64),
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).optional().nullable(),
    type: zod_1.z.enum([
        "RAW_MATERIAL",
        "FINISHED_GOOD",
        "BY_PRODUCT",
        "PACKETS_2KG",
        "PACKETS_1KG",
        "KHAKI_BALER_2KG",
        "KHAKI_BALER_1KG",
        "NYLON_BALER_1KG",
        "NYLON_BALER_2KG",
        "BAG_5KG",
        "BAG_10KG",
        "LAMINATED_BALER",
        "BAG_50KG",
        "BAG_90KG",
        "CLEAR_TAPES",
        "GLUE",
    ]).optional().default("FINISHED_GOOD"),
    unit: zod_1.z.enum(["KG", "BAG", "PIECES", "BALE", "GRAMS", "MT", "L", "MT", "UNIT"]).optional().default("KG"),
    quantity: zod_1.z.number().nonnegative().optional().default(0.0),
    unitPrice: zod_1.z.number().nonnegative().optional(),
    storeCode: zod_1.z
        .enum(["MAIN_STORE", "PACKAGING_STORE", "MAIZE_STORE", "DISPATCH_STORE"])
        .optional()
        .default("MAIN_STORE"),
    reorderLevel: optionalDecimal,
    reorderQuantity: optionalDecimal,
});
const UpdateInventoryItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().max(1000).optional().nullable(),
    quantity: zod_1.z.number().nonnegative().optional(),
    unitPrice: zod_1.z.number().nonnegative().optional(),
    adjustmentNote: zod_1.z.string().max(500).optional().nullable(),
    storeCode: zod_1.z
        .enum(["MAIN_STORE", "PACKAGING_STORE", "MAIZE_STORE", "DISPATCH_STORE"])
        .optional()
        .default("MAIN_STORE"),
    reorderLevel: optionalDecimal,
    reorderQuantity: optionalDecimal,
});
const formatPrismaItem = (item) => ({
    ...item,
    quantity: Number(item.quantity),
    reorderLevel: item.reorderLevel != null ? Number(item.reorderLevel) : null,
    reorderQuantity: item.reorderQuantity != null ? Number(item.reorderQuantity) : null,
    unitPrice: item.unitPrice != null ? Number(item.unitPrice) : undefined,
});
const formatMovement = (m) => ({
    ...m,
    quantityDelta: Number(m.quantityDelta),
    unitPriceApplied: Number(m.unitPriceApplied),
});
const formatPriceHistory = (p) => ({
    ...p,
    unitPrice: Number(p.unitPrice),
    priceType: p.priceType,
});
function decimalOrNull(value) {
    if (value == null)
        return null;
    return value.toFixed(3);
}
function getPriceTypeForItemType(type) {
    const buying = [
        "RAW_MATERIAL",
        "PACKETS_2KG",
        "PACKETS_1KG",
        "KHAKI_BALER_2KG",
        "KHAKI_BALER_1KG",
        "NYLON_BALER_1KG",
        "NYLON_BALER_2KG",
        "BAG_5KG",
        "BAG_10KG",
        "LAMINATED_BALER",
        "BAG_50KG",
        "BAG_90KG",
        "CLEAR_TAPES",
        "GLUE",
    ];
    return buying.includes(type) ? "BUYING" : "SELLING";
}
// GET per-store balances for an item (physical + in-transit)
exports.inventoryRouter.get("/location-stock", async (req, res) => {
    try {
        const itemId = typeof req.query.itemId === "string" ? req.query.itemId : "";
        if (!itemId) {
            return res.status(400).json({ message: "itemId query parameter is required" });
        }
        await (0, store_seed_service_1.ensureDefaultStores)();
        const balances = await server_1.prisma.storeInventoryBalance.findMany({
            where: { itemId },
            include: { location: true },
        });
        if (balances.length > 0) {
            return res.json({
                locationStock: balances.map((b) => ({
                    location: b.location,
                    physicalQty: Number(b.physicalQty),
                    transitQty: Number(b.transitQty),
                    balance: Number(b.physicalQty),
                })),
            });
        }
        const locations = await server_1.prisma.inventoryLocation.findMany();
        const movementAgg = await server_1.prisma.inventoryMovement.groupBy({
            by: ["locationId"],
            where: { itemId, locationId: { not: null } },
            _sum: { quantityDelta: true },
        });
        const byLocation = new Map(movementAgg.map((row) => [row.locationId, Number(row._sum.quantityDelta ?? 0)]));
        res.json({
            locationStock: locations.map((location) => {
                const balance = byLocation.get(location.id) ?? 0;
                return {
                    location,
                    physicalQty: balance,
                    transitQty: 0,
                    balance,
                };
            }),
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to fetch location stock",
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
// GET inventory module dashboard analytics
exports.inventoryRouter.get("/dashboard", async (_req, res) => {
    try {
        const data = await (0, inventory_dashboard_service_1.getInventoryDashboardAnalytics)();
        res.status(200).json({ success: true, ...data });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch inventory dashboard", error: String(error) });
    }
});
// GET report catalog
exports.inventoryRouter.get("/reports", (_req, res) => {
    res.status(200).json({ reports: inventory_reports_service_1.REPORT_TYPES });
});
// GET Excel export
exports.inventoryRouter.get("/reports/:reportType", async (req, res) => {
    try {
        const reportType = req.params.reportType;
        const valid = inventory_reports_service_1.REPORT_TYPES.some((r) => r.id === reportType);
        if (!valid) {
            return res.status(400).json({ message: "Unknown report type", available: inventory_reports_service_1.REPORT_TYPES.map((r) => r.id) });
        }
        const { from, to } = req.query;
        const buffer = await (0, inventory_reports_service_1.generateInventoryReportBuffer)(reportType, typeof from === "string" ? from : undefined, typeof to === "string" ? to : undefined);
        const filename = `inventory-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(buffer);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to generate report", error: String(error) });
    }
});
// GET all items
exports.inventoryRouter.get("/", async (_req, res) => {
    try {
        const items = await server_1.prisma.inventoryItem.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                priceHistory: {
                    orderBy: { effectiveDate: "desc" },
                    take: 1,
                },
            },
        });
        const formatted = items.map((item) => {
            const priceType = getPriceTypeForItemType(item.type);
            const priceRow = item.priceHistory.length > 0 && item.priceHistory[0].priceType === priceType
                ? item.priceHistory[0]
                : null;
            return {
                ...formatPrismaItem(item),
                unitPrice: priceRow ? Number(priceRow.unitPrice) : null,
                priceHistory: undefined,
            };
        });
        res.status(200).json({ items: formatted });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch inventory items", error: String(error) });
    }
});
// GET single item with full history
exports.inventoryRouter.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const item = await server_1.prisma.inventoryItem.findUnique({
            where: { id },
            include: {
                priceHistory: {
                    orderBy: { effectiveDate: "desc" },
                    take: 50,
                },
                movements: {
                    orderBy: { movementAt: "desc" },
                    take: 50,
                },
            },
        });
        if (!item) {
            return res.status(404).json({ message: "Inventory item not found" });
        }
        const priceType = getPriceTypeForItemType(item.type);
        const priceRow = item.priceHistory.length > 0 && item.priceHistory[0].priceType === priceType
            ? item.priceHistory[0]
            : null;
        const latestPrice = priceRow ? Number(priceRow.unitPrice) : null;
        res.status(200).json({
            item: {
                ...formatPrismaItem(item),
                unitPrice: latestPrice,
                priceHistory: item.priceHistory.map(formatPriceHistory),
                movements: item.movements.map(formatMovement),
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch inventory item", error: String(error) });
    }
});
exports.inventoryRouter.post("/", async (req, res) => {
    try {
        const parse = CreateInventoryItemSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                message: "Invalid request body",
                errors: parse.error.flatten(),
            });
        }
        const input = parse.data;
        const existing = await server_1.prisma.inventoryItem.findUnique({
            where: { sku: input.sku },
        });
        if (existing) {
            return res.status(400).json({
                message: `Inventory item with SKU ${input.sku} already exists`,
            });
        }
        await (0, store_seed_service_1.ensureDefaultStores)();
        const storeLocationId = await (0, store_seed_service_1.getLocationIdByCode)(input.storeCode);
        const created = await server_1.prisma.inventoryItem.create({
            data: {
                sku: input.sku,
                name: input.name,
                description: input.description,
                type: input.type,
                unit: input.unit,
                quantity: input.quantity.toFixed(3),
                reorderLevel: decimalOrNull(input.reorderLevel ?? null),
                reorderQuantity: decimalOrNull(input.reorderQuantity ?? null),
            },
        });
        if (input.quantity > 0) {
            const movementDelta = input.quantity;
            await (0, store_inventory_service_1.adjustStoreBalance)(server_1.prisma, {
                itemId: created.id,
                locationId: storeLocationId,
                physicalDelta: movementDelta,
            });
            await server_1.prisma.inventoryMovement.create({
                data: {
                    itemId: created.id,
                    locationId: storeLocationId,
                    movementType: "RECEIPT",
                    quantityDelta: input.quantity.toFixed(3),
                    unitPriceApplied: (input.unitPrice ?? 0).toFixed(2),
                    notes: "Opening balance on catalog creation",
                },
            });
        }
        if (input.unitPrice != null && input.unitPrice > 0) {
            const priceType = getPriceTypeForItemType(input.type);
            await server_1.prisma.inventoryPriceHistory.create({
                data: {
                    itemId: created.id,
                    priceType,
                    unitPrice: input.unitPrice.toFixed(2),
                    effectiveDate: new Date(),
                },
            });
        }
        await (0, inventory_alert_service_1.checkReorderAlert)(created.id, input.quantity);
        res.status(201).json({
            item: formatPrismaItem({ ...created, unitPrice: input.unitPrice ?? null }),
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create inventory item", error: String(error) });
    }
});
exports.inventoryRouter.patch("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const parse = UpdateInventoryItemSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                message: "Invalid request body",
                errors: parse.error.flatten(),
            });
        }
        const input = parse.data;
        const existing = await server_1.prisma.inventoryItem.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: "Inventory item not found" });
        }
        const previousQty = Number(existing.quantity);
        const updateData = {};
        if (input.name !== undefined)
            updateData.name = input.name;
        if (input.description !== undefined)
            updateData.description = input.description;
        if (input.reorderLevel !== undefined) {
            updateData.reorderLevel = decimalOrNull(input.reorderLevel);
        }
        if (input.reorderQuantity !== undefined) {
            updateData.reorderQuantity = decimalOrNull(input.reorderQuantity);
        }
        if (input.quantity !== undefined) {
            const newQty = input.quantity;
            const delta = newQty - previousQty;
            updateData.quantity = newQty.toFixed(3);
            if (delta !== 0) {
                const latestPrice = await server_1.prisma.inventoryPriceHistory.findFirst({
                    where: { itemId: id },
                    orderBy: { effectiveDate: "desc" },
                });
                await server_1.prisma.inventoryMovement.create({
                    data: {
                        itemId: id,
                        movementType: "ADJUSTMENT",
                        quantityDelta: delta.toFixed(3),
                        unitPriceApplied: latestPrice ? latestPrice.unitPrice : "0.00",
                        notes: input.adjustmentNote ?? "Manual adjustment via inventory edit",
                    },
                });
            }
        }
        const updated = await server_1.prisma.inventoryItem.update({
            where: { id },
            data: updateData,
        });
        let newUnitPrice = null;
        const priceType = getPriceTypeForItemType(existing.type);
        if (input.unitPrice !== undefined) {
            const latestPrice = await server_1.prisma.inventoryPriceHistory.findFirst({
                where: { itemId: id, priceType },
                orderBy: { effectiveDate: "desc" },
            });
            const latestPriceValue = latestPrice ? Number(latestPrice.unitPrice) : null;
            if (latestPriceValue === null || Math.abs(latestPriceValue - input.unitPrice) > 0.001) {
                await server_1.prisma.inventoryPriceHistory.create({
                    data: {
                        itemId: id,
                        priceType,
                        unitPrice: input.unitPrice.toFixed(2),
                        effectiveDate: new Date(),
                    },
                });
            }
            newUnitPrice = input.unitPrice;
        }
        else {
            const latestPrice = await server_1.prisma.inventoryPriceHistory.findFirst({
                where: { itemId: id, priceType },
                orderBy: { effectiveDate: "desc" },
            });
            newUnitPrice = latestPrice ? Number(latestPrice.unitPrice) : null;
        }
        await (0, inventory_alert_service_1.checkReorderAlert)(id, previousQty);
        res.status(200).json({
            item: formatPrismaItem({ ...updated, unitPrice: newUnitPrice }),
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to update inventory item", error: String(error) });
    }
});
