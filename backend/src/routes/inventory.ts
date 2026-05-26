import { Router } from "express";
import { z } from "zod";
import { prisma } from "../server";
import { checkReorderAlert } from "../services/inventory-alert.service";
import {
  generateInventoryReportBuffer,
  REPORT_TYPES,
  ReportType,
} from "../services/inventory-reports.service";
import { getInventoryDashboardAnalytics } from "../services/inventory-dashboard.service";
import { getLocationIdByCode, ensureDefaultStores } from "../services/store-seed.service";
import { adjustStoreBalance, recordTransferMovement } from "../services/store-inventory.service";

export const inventoryRouter = Router();

const optionalDecimal = z.number().nonnegative().optional().nullable();

const CreateInventoryItemSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  type: z.enum([
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
  unit: z.enum(["KG", "BAG"]).optional().default("KG"),
  quantity: z.number().nonnegative().optional().default(0.0),
  unitPrice: z.number().nonnegative().optional(),
  // Where to apply physical balance for opening catalog quantities.
  // Defaults to MAIN_STORE to keep behavior backward-compatible.
  storeCode: z
    .enum(["MAIN_STORE", "PACKAGING_STORE", "MAIZE_STORE", "DISPATCH_STORE"])
    .optional()
    .default("MAIN_STORE"),
  reorderLevel: optionalDecimal,
  reorderQuantity: optionalDecimal,
});

const UpdateInventoryItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  quantity: z.number().nonnegative().optional(),
  unitPrice: z.number().nonnegative().optional(),
  adjustmentNote: z.string().max(500).optional().nullable(),
  // Where to apply physical balance changes for this catalog change.
  // Defaults to MAIN_STORE to keep behavior backward-compatible.
  storeCode: z
    .enum(["MAIN_STORE", "PACKAGING_STORE", "MAIZE_STORE", "DISPATCH_STORE"])
    .optional()
    .default("MAIN_STORE"),
  reorderLevel: optionalDecimal,
  reorderQuantity: optionalDecimal,
});

type CreateInventoryItemInput = z.infer<typeof CreateInventoryItemSchema>;
type UpdateInventoryItemInput = z.infer<typeof UpdateInventoryItemSchema>;

const formatPrismaItem = (item: {
  quantity: unknown;
  reorderLevel?: unknown;
  reorderQuantity?: unknown;
  unitPrice?: number | null;
  [key: string]: unknown;
}) => ({
  ...item,
  quantity: Number(item.quantity),
  reorderLevel: item.reorderLevel != null ? Number(item.reorderLevel) : null,
  reorderQuantity: item.reorderQuantity != null ? Number(item.reorderQuantity) : null,
  unitPrice: item.unitPrice != null ? Number(item.unitPrice) : undefined,
});

const formatMovement = (m: {
  quantityDelta: unknown;
  unitPriceApplied: unknown;
  [key: string]: unknown;
}) => ({
  ...m,
  quantityDelta: Number(m.quantityDelta),
  unitPriceApplied: Number(m.unitPriceApplied),
});

const formatPriceHistory = (p: { unitPrice: unknown; priceType: unknown;[key: string]: unknown }) => ({
  ...p,
  unitPrice: Number(p.unitPrice),
  priceType: p.priceType,
});


function decimalOrNull(value: number | null | undefined) {
  if (value == null) return null;
  return value.toFixed(3);
}

function getPriceTypeForItemType(type: string): "BUYING" | "SELLING" {
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
inventoryRouter.get("/location-stock", async (req, res) => {
  try {
    const itemId = typeof req.query.itemId === "string" ? req.query.itemId : "";
    if (!itemId) {
      return res.status(400).json({ message: "itemId query parameter is required" });
    }

    await ensureDefaultStores();

    const balances = await prisma.storeInventoryBalance.findMany({
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

    const locations = await prisma.inventoryLocation.findMany();
    const movementAgg = await prisma.inventoryMovement.groupBy({
      by: ["locationId"],
      where: { itemId, locationId: { not: null } },
      _sum: { quantityDelta: true },
    });

    const byLocation = new Map(
      movementAgg.map((row) => [row.locationId!, Number(row._sum.quantityDelta ?? 0)])
    );

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
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch location stock",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET inventory module dashboard analytics
inventoryRouter.get("/dashboard", async (_req, res) => {
  try {
    const data = await getInventoryDashboardAnalytics();
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch inventory dashboard", error: String(error) });
  }
});

// GET report catalog
inventoryRouter.get("/reports", (_req, res) => {
  res.status(200).json({ reports: REPORT_TYPES });
});

// GET Excel export
inventoryRouter.get("/reports/:reportType", async (req, res) => {
  try {
    const reportType = req.params.reportType as ReportType;
    const valid = REPORT_TYPES.some((r) => r.id === reportType);
    if (!valid) {
      return res.status(400).json({ message: "Unknown report type", available: REPORT_TYPES.map((r) => r.id) });
    }

    const { from, to } = req.query;
    const buffer = await generateInventoryReportBuffer(
      reportType,
      typeof from === "string" ? from : undefined,
      typeof to === "string" ? to : undefined
    );

    const filename = `inventory-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate report", error: String(error) });
  }
});

// GET all items
inventoryRouter.get("/", async (_req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
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
      const priceRow =
        item.priceHistory.length > 0 && item.priceHistory[0].priceType === priceType
          ? item.priceHistory[0]
          : null;

      return {
        ...formatPrismaItem(item),
        unitPrice: priceRow ? Number(priceRow.unitPrice) : null,
        priceHistory: undefined,
      };
    });


    res.status(200).json({ items: formatted });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch inventory items", error: String(error) });
  }
});

// GET single item with full history
inventoryRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.inventoryItem.findUnique({
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
    const priceRow =
      item.priceHistory.length > 0 && item.priceHistory[0].priceType === priceType
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
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch inventory item", error: String(error) });
  }
});

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

    const existing = await prisma.inventoryItem.findUnique({
      where: { sku: input.sku },
    });
    if (existing) {
      return res.status(400).json({
        message: `Inventory item with SKU ${input.sku} already exists`,
      });
    }

    await ensureDefaultStores();

    const storeLocationId = await getLocationIdByCode(input.storeCode);

    const created = await prisma.inventoryItem.create({
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
      await adjustStoreBalance(prisma, {
        itemId: created.id,
        locationId: storeLocationId,
        physicalDelta: movementDelta,
      });

      await prisma.inventoryMovement.create({
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

      await prisma.inventoryPriceHistory.create({
        data: {
          itemId: created.id,
          priceType,
          unitPrice: input.unitPrice.toFixed(2),
          effectiveDate: new Date(),
        },
      });

    }

    await checkReorderAlert(created.id, input.quantity);

    res.status(201).json({
      item: formatPrismaItem({ ...created, unitPrice: input.unitPrice ?? null }),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create inventory item", error: String(error) });
  }
});

inventoryRouter.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const parse = UpdateInventoryItemSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        message: "Invalid request body",
        errors: parse.error.flatten(),
      });
    }

    const input: UpdateInventoryItemInput = parse.data;

    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    const previousQty = Number(existing.quantity);
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
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
        const latestPrice = await prisma.inventoryPriceHistory.findFirst({
          where: { itemId: id },
          orderBy: { effectiveDate: "desc" },
        });

        await prisma.inventoryMovement.create({
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

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: updateData,
    });

    let newUnitPrice: number | null = null;
    const priceType = getPriceTypeForItemType(existing.type);

    if (input.unitPrice !== undefined) {
      const latestPrice = await prisma.inventoryPriceHistory.findFirst({
        where: { itemId: id, priceType },
        orderBy: { effectiveDate: "desc" },
      });

      const latestPriceValue = latestPrice ? Number(latestPrice.unitPrice) : null;

      if (latestPriceValue === null || Math.abs(latestPriceValue - input.unitPrice) > 0.001) {
        await prisma.inventoryPriceHistory.create({
          data: {
            itemId: id,
            priceType,
            unitPrice: input.unitPrice.toFixed(2),
            effectiveDate: new Date(),
          },
        });
      }

      newUnitPrice = input.unitPrice;
    } else {
      const latestPrice = await prisma.inventoryPriceHistory.findFirst({
        where: { itemId: id, priceType },
        orderBy: { effectiveDate: "desc" },
      });
      newUnitPrice = latestPrice ? Number(latestPrice.unitPrice) : null;
    }


    await checkReorderAlert(id, previousQty);

    res.status(200).json({
      item: formatPrismaItem({ ...updated, unitPrice: newUnitPrice }),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update inventory item", error: String(error) });
  }
});
