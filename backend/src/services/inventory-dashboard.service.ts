import { prisma } from "../server";

export async function getInventoryDashboardAnalytics() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    items,
    movementsRecent,
    movementsWeek,
    productionBatches,
    packagingRuns,
    belowReorderItems,
  ] = await Promise.all([
    prisma.inventoryItem.findMany({
      include: {
        priceHistory: { orderBy: { effectiveDate: "desc" }, take: 1 },
      },
      orderBy: { sku: "asc" },
    }),
    prisma.inventoryMovement.findMany({
      where: { movementAt: { gte: thirtyDaysAgo } },
      orderBy: { movementAt: "desc" },
      take: 12,
      include: { item: { select: { sku: true, name: true, unit: true } } },
    }),
    prisma.inventoryMovement.findMany({
      where: { movementAt: { gte: sevenDaysAgo } },
      select: { movementAt: true, movementType: true, quantityDelta: true },
    }),
    prisma.productionBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.packagingRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.inventoryItem.findMany({
      where: { reorderLevel: { not: null } },
    }),
  ]);

  const stockByType = {
    RAW_MATERIAL: 0,
    FINISHED_GOOD: 0,
    BY_PRODUCT: 0,
  };
  const qtyByType = {
    RAW_MATERIAL: 0,
    FINISHED_GOOD: 0,
    BY_PRODUCT: 0,
  };
  let totalValuation = 0;
  let totalSkus = items.length;
  let outOfStock = 0;

  const topStockByValue: Array<{
    sku: string;
    name: string;
    quantity: number;
    unit: string;
    value: number;
  }> = [];

  for (const item of items) {
    const qty = Number(item.quantity);
    stockByType[item.type] = (stockByType[item.type] ?? 0) + 1;
    qtyByType[item.type] = (qtyByType[item.type] ?? 0) + qty;
    if (qty <= 0) outOfStock += 1;

    const price = item.priceHistory[0] ? Number(item.priceHistory[0].unitPrice) : 0;
    const value = qty * price;
    totalValuation += value;
    topStockByValue.push({
      sku: item.sku,
      name: item.name,
      quantity: qty,
      unit: item.unit,
      value,
    });
  }

  topStockByValue.sort((a, b) => b.value - a.value);

  const belowReorder = belowReorderItems
    .filter((i) => i.reorderLevel != null && Number(i.quantity) <= Number(i.reorderLevel))
    .map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      quantity: Number(i.quantity),
      reorderLevel: Number(i.reorderLevel),
      unit: i.unit,
      shortfall: Math.max(0, Number(i.reorderLevel) - Number(i.quantity)),
    }));

  const movementByDay: Record<string, { receipts: number; issues: number }> = {};
  for (const m of movementsWeek) {
    const day = m.movementAt.toISOString().slice(0, 10);
    if (!movementByDay[day]) movementByDay[day] = { receipts: 0, issues: 0 };
    const delta = Number(m.quantityDelta);
    if (delta > 0) movementByDay[day].receipts += delta;
    else movementByDay[day].issues += Math.abs(delta);
  }

  const movementTrend = Object.entries(movementByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, receiptsKg: v.receipts, issuesKg: v.issues }));

  const productionYieldHistory = [...productionBatches]
    .reverse()
    .map((b) => ({
      label: b.batchNumber.slice(-8),
      efficiencyPct: Number(b.efficiency),
      consumedKg: Number(b.rawMaizeConsumed),
    }));

  const packagingYieldHistory = [...packagingRuns]
    .reverse()
    .map((r) => ({
      label: r.runNumber.slice(-8),
      yieldPct: Number(r.yieldPercent),
      packagedKg: Number(r.totalPackagedKg),
    }));

  const avgMillingEff =
    productionBatches.length > 0
      ? productionBatches.reduce((s, b) => s + Number(b.efficiency), 0) / productionBatches.length
      : 0;

  const avgPackagingYield =
    packagingRuns.length > 0
      ? packagingRuns.reduce((s, r) => s + Number(r.yieldPercent), 0) / packagingRuns.length
      : 0;

  const sku = (s: string) => items.find((i) => i.sku === s);

  return {
    kpis: {
      totalSkus,
      outOfStock,
      belowReorderCount: belowReorder.length,
      totalValuationKes: Math.round(totalValuation * 100) / 100,
      rawMaizeKg: sku("MZ-RAW-01")
        ? Number(sku("MZ-RAW-01")!.quantity)
        : qtyByType.RAW_MATERIAL,
      grade1BulkKg: sku("FL-GR1-01") ? Number(sku("FL-GR1-01")!.quantity) : 0,
      grade2BulkKg: sku("FL-GR2-02") ? Number(sku("FL-GR2-02")!.quantity) : 0,
      grade1Bales: sku("FL-GR1-BALE-24") ? Number(sku("FL-GR1-BALE-24")!.quantity) : 0,
      grade2Bales: sku("FL-GR2-BALE-24") ? Number(sku("FL-GR2-BALE-24")!.quantity) : 0,
      packagingMaterialKg: sku("PKG-MAT-01") ? Number(sku("PKG-MAT-01")!.quantity) : 0,
      avgMillingEfficiencyPct: Math.round(avgMillingEff * 100) / 100,
      avgPackagingYieldPct: Math.round(avgPackagingYield * 100) / 100,
      productionRuns30d: productionBatches.length,
      packagingRuns30d: packagingRuns.length,
    },
    stockByType: {
      counts: stockByType,
      quantitiesKg: qtyByType,
    },
    belowReorder,
    topStockByValue: topStockByValue.slice(0, 8),
    movementTrend,
    productionYieldHistory,
    packagingYieldHistory,
    recentMovements: movementsRecent.map((m) => ({
      id: m.id,
      sku: m.item.sku,
      name: m.item.name,
      unit: m.item.unit,
      movementType: m.movementType,
      quantityDelta: Number(m.quantityDelta),
      movementAt: m.movementAt,
      notes: m.notes,
    })),
    recentProduction: productionBatches.slice(0, 5).map((b) => ({
      batchNumber: b.batchNumber,
      rawMaizeConsumed: Number(b.rawMaizeConsumed),
      grade1Produced: Number(b.grade1Produced),
      grade2Produced: Number(b.grade2Produced),
      wasteLoss: Number(b.wasteLoss),
      efficiency: Number(b.efficiency),
      createdAt: b.createdAt,
    })),
    recentPackaging: packagingRuns.slice(0, 5).map((r) => ({
      runNumber: r.runNumber,
      operatorName: r.operatorName,
      totalPackagedKg: Number(r.totalPackagedKg),
      flourSpillage: Number(r.flourSpillage),
      yieldPercent: Number(r.yieldPercent),
      createdAt: r.createdAt,
    })),
  };
}
