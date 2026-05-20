"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const server_1 = require("../server");
exports.inventoryRouter = (0, express_1.Router)();
const CreateInventoryItemSchema = zod_1.z.object({
    sku: zod_1.z.string().min(1).max(64),
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).optional().nullable(),
    type: zod_1.z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "BY_PRODUCT"]).optional().default("FINISHED_GOOD"),
    unit: zod_1.z.enum(["KG", "BAG"]).optional().default("KG"),
    quantity: zod_1.z.number().nonnegative().optional().default(0.0),
    unitPrice: zod_1.z.number().nonnegative().optional(),
});
const UpdateInventoryItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().max(1000).optional().nullable(),
    quantity: zod_1.z.number().nonnegative().optional(),
    unitPrice: zod_1.z.number().nonnegative().optional(),
    adjustmentNote: zod_1.z.string().max(500).optional().nullable(),
});
// Helper to convert Prisma Decimal fields to numbers for simpler frontend consumption
const formatPrismaItem = (item) => ({
    ...item,
    quantity: Number(item.quantity),
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
        const formatted = items.map((item) => ({
            ...formatPrismaItem(item),
            unitPrice: item.priceHistory.length > 0
                ? Number(item.priceHistory[0].unitPrice)
                : null,
            priceHistory: undefined,
        }));
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
        const latestPrice = item.priceHistory.length > 0 ? Number(item.priceHistory[0].unitPrice) : null;
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
// POST a new item
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
        const created = await server_1.prisma.inventoryItem.create({
            data: {
                sku: input.sku,
                name: input.name,
                description: input.description,
                type: input.type,
                unit: input.unit,
                quantity: input.quantity.toFixed(3),
            },
        });
        // Record opening stock movement if quantity > 0
        if (input.quantity > 0) {
            await server_1.prisma.inventoryMovement.create({
                data: {
                    itemId: created.id,
                    movementType: "RECEIPT",
                    quantityDelta: input.quantity.toFixed(3),
                    unitPriceApplied: (input.unitPrice ?? 0).toFixed(2),
                    notes: "Opening balance on catalog creation",
                },
            });
        }
        // Record initial price history
        if (input.unitPrice != null && input.unitPrice > 0) {
            await server_1.prisma.inventoryPriceHistory.create({
                data: {
                    itemId: created.id,
                    unitPrice: input.unitPrice.toFixed(2),
                    effectiveDate: new Date(),
                },
            });
        }
        res.status(201).json({
            item: formatPrismaItem({ ...created, unitPrice: input.unitPrice ?? null }),
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create inventory item", error: String(error) });
    }
});
// PATCH update item (name, description, quantity adjustment, price update)
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
        // Build scalar update payload
        const updateData = {};
        if (input.name !== undefined)
            updateData.name = input.name;
        if (input.description !== undefined)
            updateData.description = input.description;
        // Quantity adjustment — record a movement for the delta
        if (input.quantity !== undefined) {
            const currentQty = Number(existing.quantity);
            const newQty = input.quantity;
            const delta = newQty - currentQty;
            updateData.quantity = newQty.toFixed(3);
            if (delta !== 0) {
                // Fetch latest price for costing
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
        // Price history — only add a new entry if the price actually changed
        let newUnitPrice = null;
        if (input.unitPrice !== undefined) {
            const latestPrice = await server_1.prisma.inventoryPriceHistory.findFirst({
                where: { itemId: id },
                orderBy: { effectiveDate: "desc" },
            });
            const latestPriceValue = latestPrice ? Number(latestPrice.unitPrice) : null;
            if (latestPriceValue === null || Math.abs(latestPriceValue - input.unitPrice) > 0.001) {
                await server_1.prisma.inventoryPriceHistory.create({
                    data: {
                        itemId: id,
                        unitPrice: input.unitPrice.toFixed(2),
                        effectiveDate: new Date(),
                    },
                });
            }
            newUnitPrice = input.unitPrice;
        }
        else {
            const latestPrice = await server_1.prisma.inventoryPriceHistory.findFirst({
                where: { itemId: id },
                orderBy: { effectiveDate: "desc" },
            });
            newUnitPrice = latestPrice ? Number(latestPrice.unitPrice) : null;
        }
        res.status(200).json({
            item: formatPrismaItem({ ...updated, unitPrice: newUnitPrice }),
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to update inventory item", error: String(error) });
    }
});
