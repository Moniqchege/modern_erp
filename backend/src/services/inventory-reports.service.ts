import ExcelJS from "exceljs";
import { prisma } from "../server";

export type ReportType =
  | "stock-on-hand"
  | "movement-ledger"
  | "below-reorder"
  | "valuation"
  | "packaging-runs";

export const REPORT_TYPES: Array<{ id: ReportType; label: string; description: string }> = [
  { id: "stock-on-hand", label: "Stock on hand", description: "Current quantities and latest unit prices" },
  { id: "movement-ledger", label: "Movement ledger", description: "All inventory movements in a date range" },
  { id: "below-reorder", label: "Below reorder level", description: "Items at or under their reorder threshold" },
  { id: "valuation", label: "Stock valuation", description: "On-hand value using latest price history" },
  { id: "packaging-runs", label: "Packaging runs", description: "Packaging yield, spillage and material usage" },
];

function parseDateRange(from?: string, to?: string) {
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
  const toDate = to ? new Date(to) : new Date();
  toDate.setHours(23, 59, 59, 999);
  return { fromDate, toDate };
}

async function buildWorkbook(reportType: ReportType, from?: string, to?: string, storeCode?: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Modern ERP";
  const { fromDate, toDate } = parseDateRange(from, to);

  // Resolve location filter when storeCode is provided
  let locationId: string | undefined;
  if (storeCode) {
    const loc = await prisma.inventoryLocation.findUnique({ where: { code: storeCode } });
    locationId = loc?.id;
  }

  if (reportType === "stock-on-hand") {
    const sheet = wb.addWorksheet(storeCode ? `Stock on hand – ${storeCode}` : "Stock on hand");
    sheet.columns = [
      { header: "SKU", key: "sku", width: 14 },
      { header: "Name", key: "name", width: 28 },
      { header: "Type", key: "type", width: 16 },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Quantity", key: "quantity", width: 12 },
      { header: "Reorder level", key: "reorderLevel", width: 14 },
      { header: "Unit price", key: "unitPrice", width: 12 },
      ...(storeCode ? [{ header: "Store", key: "store", width: 20 }] : []),
    ];
    sheet.getRow(1).font = { bold: true };

    if (locationId) {
      // Scoped: pull from StoreInventoryBalance
      const balances = await prisma.storeInventoryBalance.findMany({
        where: { locationId },
        include: {
          item: { include: { priceHistory: { orderBy: { effectiveDate: "desc" }, take: 1 } } },
          location: { select: { name: true } },
        },
        orderBy: { item: { sku: "asc" } },
      });
      for (const bal of balances) {
        const item = bal.item;
        sheet.addRow({
          sku: item.sku, name: item.name, type: item.type, unit: item.unit,
          quantity: Number(bal.physicalQty),
          reorderLevel: item.reorderLevel != null ? Number(item.reorderLevel) : "",
          unitPrice: item.priceHistory[0] ? Number(item.priceHistory[0].unitPrice) : "",
          store: bal.location.name,
        });
      }
    } else {
      const items = await prisma.inventoryItem.findMany({
        orderBy: { sku: "asc" },
        include: { priceHistory: { orderBy: { effectiveDate: "desc" }, take: 1 } },
      });
      for (const item of items) {
        sheet.addRow({
          sku: item.sku, name: item.name, type: item.type, unit: item.unit,
          quantity: Number(item.quantity),
          reorderLevel: item.reorderLevel != null ? Number(item.reorderLevel) : "",
          unitPrice: item.priceHistory[0] ? Number(item.priceHistory[0].unitPrice) : "",
        });
      }
    }
    return wb;
  }

  if (reportType === "below-reorder") {
    const sheet = wb.addWorksheet("Below reorder");
    sheet.columns = [
      { header: "SKU", key: "sku", width: 14 },
      { header: "Name", key: "name", width: 28 },
      { header: "Quantity", key: "quantity", width: 12 },
      { header: "Reorder level", key: "reorderLevel", width: 14 },
      { header: "Reorder qty", key: "reorderQuantity", width: 14 },
      { header: "Shortfall", key: "shortfall", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };

    if (locationId) {
      const balances = await prisma.storeInventoryBalance.findMany({
        where: { locationId },
        include: { item: true },
      });
      for (const bal of balances) {
        const item = bal.item;
        if (item.reorderLevel == null) continue;
        const qty = Number(bal.physicalQty);
        const level = Number(item.reorderLevel);
        if (qty > level) continue;
        sheet.addRow({
          sku: item.sku, name: item.name, quantity: qty, reorderLevel: level,
          reorderQuantity: item.reorderQuantity != null ? Number(item.reorderQuantity) : "",
          shortfall: Math.max(0, level - qty)
        });
      }
    } else {
      const items = await prisma.inventoryItem.findMany({ where: { reorderLevel: { not: null } }, orderBy: { sku: "asc" } });
      for (const item of items) {
        const qty = Number(item.quantity);
        const level = Number(item.reorderLevel);
        if (qty > level) continue;
        sheet.addRow({
          sku: item.sku, name: item.name, quantity: qty, reorderLevel: level,
          reorderQuantity: item.reorderQuantity != null ? Number(item.reorderQuantity) : "",
          shortfall: Math.max(0, level - qty)
        });
      }
    }
    return wb;
  }

  if (reportType === "movement-ledger") {
    const sheet = wb.addWorksheet("Movements");
    sheet.columns = [
      { header: "Date", key: "movementAt", width: 20 },
      { header: "SKU", key: "sku", width: 14 },
      { header: "Item", key: "name", width: 24 },
      { header: "Type", key: "movementType", width: 20 },
      { header: "Delta", key: "quantityDelta", width: 12 },
      { header: "Unit price", key: "unitPriceApplied", width: 12 },
      { header: "Notes", key: "notes", width: 40 },
    ];
    sheet.getRow(1).font = { bold: true };

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        movementAt: { gte: fromDate, lte: toDate },
        ...(locationId ? { locationId } : {}),
      },
      orderBy: { movementAt: "desc" },
      include: { item: true },
    });

    for (const m of movements) {
      sheet.addRow({
        movementAt: m.movementAt.toISOString(), sku: m.item.sku, name: m.item.name,
        movementType: m.movementType, quantityDelta: Number(m.quantityDelta),
        unitPriceApplied: Number(m.unitPriceApplied), notes: m.notes ?? "",
      });
    }
    return wb;
  }

  if (reportType === "valuation") {
    const sheet = wb.addWorksheet("Valuation");
    sheet.columns = [
      { header: "SKU", key: "sku", width: 14 },
      { header: "Name", key: "name", width: 28 },
      { header: "Quantity", key: "quantity", width: 12 },
      { header: "Unit price", key: "unitPrice", width: 12 },
      { header: "Value", key: "value", width: 14 },
    ];
    sheet.getRow(1).font = { bold: true };

    let total = 0;
    if (locationId) {
      const balances = await prisma.storeInventoryBalance.findMany({
        where: { locationId },
        include: { item: { include: { priceHistory: { orderBy: { effectiveDate: "desc" }, take: 1 } } } },
        orderBy: { item: { sku: "asc" } },
      });
      for (const bal of balances) {
        const qty = Number(bal.physicalQty);
        const price = bal.item.priceHistory[0] ? Number(bal.item.priceHistory[0].unitPrice) : 0;
        const value = qty * price;
        total += value;
        sheet.addRow({ sku: bal.item.sku, name: bal.item.name, quantity: qty, unitPrice: price, value });
      }
    } else {
      const items = await prisma.inventoryItem.findMany({
        orderBy: { sku: "asc" },
        include: { priceHistory: { orderBy: { effectiveDate: "desc" }, take: 1 } },
      });
      for (const item of items) {
        const qty = Number(item.quantity);
        const price = item.priceHistory[0] ? Number(item.priceHistory[0].unitPrice) : 0;
        const value = qty * price;
        total += value;
        sheet.addRow({ sku: item.sku, name: item.name, quantity: qty, unitPrice: price, value });
      }
    }
    sheet.addRow({});
    sheet.addRow({ sku: "", name: "TOTAL", quantity: "", unitPrice: "", value: total });
    return wb;
  }

  if (reportType === "packaging-runs") {
    const sheet = wb.addWorksheet("Packaging runs");
    sheet.columns = [
      { header: "Run #", key: "runNumber", width: 16 },
      { header: "Operator", key: "operatorName", width: 18 },
      { header: "Flour consumed", key: "flourIn", width: 16 },
      { header: "Spillage (kg)", key: "spill", width: 12 },
      { header: "Pkg received", key: "pkgRec", width: 12 },
      { header: "Pkg consumed", key: "pkgCon", width: 12 },
      { header: "Pkg destroyed", key: "pkgDest", width: 12 },
      { header: "Bales produced", key: "bales", width: 14 },
      { header: "Packaged kg", key: "pkgKg", width: 12 },
      { header: "Yield %", key: "yield", width: 10 },
      { header: "Created", key: "createdAt", width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };

    const runs = await prisma.packagingRun.findMany({
      where: { createdAt: { gte: fromDate, lte: toDate } },
      orderBy: { createdAt: "desc" },
      include: { finishedProductInputs: true, finishedProductOutputs: true },
    });

    for (const r of runs) {
      const flourIn = r.finishedProductInputs.reduce((sum, i) => sum + Number(i.flourConsumedKg), 0);
      const bales = r.finishedProductOutputs.reduce((sum, o) => sum + o.balesProduced, 0);
      sheet.addRow({
        runNumber: r.runNumber, operatorName: r.operatorName, flourIn,
        spill: Number(r.flourSpillage), pkgRec: Number(r.packagingMaterialReceived),
        pkgCon: Number(r.packagingMaterialConsumed), pkgDest: Number(r.packagingMaterialDestroyed),
        bales, pkgKg: Number(r.totalPackagedKg), yield: Number(r.yieldPercent),
        createdAt: r.createdAt.toISOString(),
      });
    }
    return wb;
  }

  throw new Error(`Unknown report type: ${reportType}`);
}

export async function generateInventoryReportBuffer(
  reportType: ReportType,
  from?: string,
  to?: string,
  storeCode?: string
): Promise<Buffer> {
  const wb = await buildWorkbook(reportType, from, to, storeCode);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}