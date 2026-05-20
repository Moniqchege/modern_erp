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
    unitPrice: zod_1.z.number().nonnegative().optional().default(0.0),
});
// Helper to convert Prisma Decimal fields to numbers for simpler frontend consumption
const formatPrismaItem = (item) => ({
    ...item,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
});
// GET all items
exports.inventoryRouter.get("/", async (_req, res) => {
    try {
        const items = await server_1.prisma.inventoryItem.findMany({
            orderBy: { createdAt: "desc" },
        });
        const formatted = items.map(formatPrismaItem);
        res.status(200).json({ items: formatted });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch inventory items", error: String(error) });
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
        // Check if SKU exists
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
                unitPrice: input.unitPrice.toFixed(2),
            },
        });
        res.status(201).json({ item: formatPrismaItem(created) });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create inventory item", error: String(error) });
    }
});
