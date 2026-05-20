import { Router } from "express";
import { z } from "zod";
import { prisma } from "../server";

export const inventoryRouter = Router();

const CreateInventoryItemSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  type: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "BY_PRODUCT"]).optional().default("FINISHED_GOOD"),
  unit: z.enum(["KG", "BAG"]).optional().default("KG"),
  quantity: z.number().nonnegative().optional().default(0.0),
  unitPrice: z.number().nonnegative().optional().default(0.0),
});

type CreateInventoryItemInput = z.infer<typeof CreateInventoryItemSchema>;

// Helper to convert Prisma Decimal fields to numbers for simpler frontend consumption
const formatPrismaItem = (item: any) => ({
  ...item,
  quantity: Number(item.quantity),
  unitPrice: Number(item.unitPrice),
});

// GET all items
inventoryRouter.get("/", async (_req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { createdAt: "desc" },
    });

    const formatted = items.map(formatPrismaItem);
    res.status(200).json({ items: formatted });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch inventory items", error: String(error) });
  }
});

// POST a new item
inventoryRouter.post("/", async (req, res) => {
  try {
    const parse = CreateInventoryItemSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        message: "Invalid request body",
        errors: parse.error.flatten(),
      });
    }

    const input: CreateInventoryItemInput = parse.data;

    // Check if SKU exists
    const existing = await prisma.inventoryItem.findUnique({
      where: { sku: input.sku },
    });
    if (existing) {
      return res.status(400).json({
        message: `Inventory item with SKU ${input.sku} already exists`,
      });
    }

    const created = await prisma.inventoryItem.create({
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
  } catch (error) {
    res.status(500).json({ message: "Failed to create inventory item", error: String(error) });
  }
});
