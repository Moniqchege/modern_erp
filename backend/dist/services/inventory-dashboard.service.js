"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInventoryDashboardAnalytics = getInventoryDashboardAnalytics;
const server_1 = require("../server");
async function getInventoryDashboardAnalytics(storeCode) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    // When scoped to a store, resolve the location first
    let locationId;
    if (storeCode) {
        const loc = await server_1.prisma.inventoryLocation.findUnique({ where: { code: storeCode } });
        locationId = loc?.id;
    }
    // ─── Scoped path: use StoreInventoryBalance for a specific store ─────────────
    if (locationId) {
        const [balances, movementsRecent, movementsWeek, transfers,] = await Promise.all([
            server_1.prisma.storeInventoryBalance.findMany({
                where: { locationId },
                include: {
                    item: {
                        include: {
                            priceHistory: { orderBy: { effectiveDate: "desc" }, take: 1 },
                        },
                    },
                },
            }),
            server_1.prisma.inventoryMovement.findMany({
                where: { locationId, movementAt: { gte: thirtyDaysAgo } },
                orderBy: { movementAt: "desc" },
                take: 12,
                include: { item: { select: { sku: true, name: true, unit: true } } },
            }),
            server_1.prisma.inventoryMovement.findMany({
                where: { locationId, movementAt: { gte: sevenDaysAgo } },
                select: { movementAt: true, movementType: true, quantityDelta: true },
            }),
            server_1.prisma.stockTransferRequest.findMany({
                where: {
                    OR: [{ sourceLocationId: locationId }, { destinationLocationId: locationId }],
                    status: { in: ["PENDING", "APPROVED_IN_TRANSIT"] },
                },
                select: { id: true, status: true, requestNumber: true, createdAt: true },
                orderBy: { createdAt: "desc" },
                take: 5,
            }),
        ]);
        // KPIs from balances
        let totalSkus = balances.length;
        let outOfStock = 0;
        let belowReorderCount = 0;
        let totalValuation = 0;
        const topStockByValue = [];
        const belowReorder = [];
        for (const bal of balances) {
            const qty = Number(bal.physicalQty);
            const item = bal.item;
            const price = item.priceHistory[0] ? Number(item.priceHistory[0].unitPrice) : 0;
            const value = qty * price;
            totalValuation += value;
            if (qty <= 0)
                outOfStock++;
            if (item.reorderLevel != null && qty <= Number(item.reorderLevel)) {
                belowReorderCount++;
                belowReorder.push({
                    id: item.id,
                    sku: item.sku,
                    name: item.name,
                    quantity: qty,
                    reorderLevel: Number(item.reorderLevel),
                    unit: item.unit,
                    shortfall: Math.max(0, Number(item.reorderLevel) - qty),
                });
            }
            topStockByValue.push({ sku: item.sku, name: item.name, quantity: qty, unit: item.unit, value });
        }
        topStockByValue.sort((a, b) => b.value - a.value);
        // Movement trend (7 days)
        const movementByDay = {};
        for (const m of movementsWeek) {
            const day = m.movementAt.toISOString().slice(0, 10);
            if (!movementByDay[day])
                movementByDay[day] = { receipts: 0, issues: 0 };
            const delta = Number(m.quantityDelta);
            if (delta > 0)
                movementByDay[day].receipts += delta;
            else
                movementByDay[day].issues += Math.abs(delta);
        }
        const movementTrend = Object.entries(movementByDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, receiptsKg: v.receipts, issuesKg: v.issues }));
        return {
            storeCode,
            kpis: {
                totalSkus,
                outOfStock,
                belowReorderCount,
                totalValuationKes: Math.round(totalValuation * 100) / 100,
                // Non-applicable to scoped view
                rawMaizeKg: 0,
                grade1BulkKg: 0,
                grade2BulkKg: 0,
                grade1Bales: 0,
                grade2Bales: 0,
                packagingMaterialKg: 0,
                avgMillingEfficiencyPct: 0,
                avgPackagingYieldPct: 0,
                productionRuns30d: 0,
                packagingRuns30d: 0,
                // Scoped-specific
                inTransitIn: transfers.filter((t) => t.status === "APPROVED_IN_TRANSIT").length,
                pendingTransfers: transfers.filter((t) => t.status === "PENDING").length,
            },
            stockByType: { counts: {}, quantitiesKg: {} },
            belowReorder,
            topStockByValue: topStockByValue.slice(0, 8),
            movementTrend,
            productionYieldHistory: [],
            packagingYieldHistory: [],
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
            recentProduction: [],
            recentPackaging: [],
            recentTransfers: transfers,
        };
    }
    // ─── Global path (admin): unchanged behaviour ─────────────────────────────
    const [items, movementsRecent, movementsWeek, productionBatches, packagingRuns, belowReorderItems,] = await Promise.all([
        server_1.prisma.inventoryItem.findMany({
            include: {
                priceHistory: { orderBy: { effectiveDate: "desc" }, take: 1 },
            },
            orderBy: { sku: "asc" },
        }),
        server_1.prisma.inventoryMovement.findMany({
            where: { movementAt: { gte: thirtyDaysAgo } },
            orderBy: { movementAt: "desc" },
            take: 12,
            include: { item: { select: { sku: true, name: true, unit: true } } },
        }),
        server_1.prisma.inventoryMovement.findMany({
            where: { movementAt: { gte: sevenDaysAgo } },
            select: { movementAt: true, movementType: true, quantityDelta: true },
        }),
        server_1.prisma.productionBatch.findMany({
            include: { outputs: { include: { inventoryItem: true } } },
            orderBy: { createdAt: "desc" },
            take: 8,
        }),
        server_1.prisma.packagingRun.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
        }),
        server_1.prisma.inventoryItem.findMany({
            where: { reorderLevel: { not: null } },
        }),
    ]);
    const stockByType = {};
    const qtyByType = {};
    let totalValuation = 0;
    const totalSkus = items.length;
    let outOfStock = 0;
    const topStockByValue = [];
    for (const item of items) {
        const qty = Number(item.quantity);
        stockByType[item.type] = (stockByType[item.type] ?? 0) + 1;
        qtyByType[item.type] = (qtyByType[item.type] ?? 0) + qty;
        if (qty <= 0)
            outOfStock += 1;
        const price = item.priceHistory[0] ? Number(item.priceHistory[0].unitPrice) : 0;
        const value = qty * price;
        totalValuation += value;
        topStockByValue.push({ sku: item.sku, name: item.name, quantity: qty, unit: item.unit, value });
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
    const movementByDay = {};
    for (const m of movementsWeek) {
        const day = m.movementAt.toISOString().slice(0, 10);
        if (!movementByDay[day])
            movementByDay[day] = { receipts: 0, issues: 0 };
        const delta = Number(m.quantityDelta);
        if (delta > 0)
            movementByDay[day].receipts += delta;
        else
            movementByDay[day].issues += Math.abs(delta);
    }
    const movementTrend = Object.entries(movementByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, receiptsKg: v.receipts, issuesKg: v.issues }));
    const productionYieldHistory = [...productionBatches]
        .reverse()
        .map((b) => ({ label: b.batchNumber.slice(-8), efficiencyPct: Number(b.efficiency) }));
    const packagingYieldHistory = [...packagingRuns]
        .reverse()
        .map((r) => ({ label: r.runNumber.slice(-8), yieldPct: Number(r.yieldPercent) }));
    const avgMillingEff = productionBatches.length > 0
        ? productionBatches.reduce((s, b) => s + Number(b.efficiency), 0) / productionBatches.length
        : 0;
    const avgPackagingYield = packagingRuns.length > 0
        ? packagingRuns.reduce((s, r) => s + Number(r.yieldPercent), 0) / packagingRuns.length
        : 0;
    const sku = (s) => items.find((i) => i.sku === s);
    return {
        storeCode: null,
        kpis: {
            totalSkus,
            outOfStock,
            belowReorderCount: belowReorder.length,
            totalValuationKes: Math.round(totalValuation * 100) / 100,
            rawMaizeKg: sku("MZ-RAW-01") ? Number(sku("MZ-RAW-01").quantity) : qtyByType.RAW_MATERIAL ?? 0,
            grade1BulkKg: sku("FL-GR1-01") ? Number(sku("FL-GR1-01").quantity) : 0,
            grade2BulkKg: sku("FL-GR2-02") ? Number(sku("FL-GR2-02").quantity) : 0,
            grade1Bales: sku("FL-GR1-BALE-24") ? Number(sku("FL-GR1-BALE-24").quantity) : 0,
            grade2Bales: sku("FL-GR2-BALE-24") ? Number(sku("FL-GR2-BALE-24").quantity) : 0,
            packagingMaterialKg: sku("PKG-MAT-01") ? Number(sku("PKG-MAT-01").quantity) : 0,
            avgMillingEfficiencyPct: Math.round(avgMillingEff * 100) / 100,
            avgPackagingYieldPct: Math.round(avgPackagingYield * 100) / 100,
            productionRuns30d: productionBatches.length,
            packagingRuns30d: packagingRuns.length,
            inTransitIn: 0,
            pendingTransfers: 0,
        },
        stockByType: { counts: stockByType, quantitiesKg: qtyByType },
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
        recentProduction: productionBatches.slice(0, 5).map((b) => {
            const g1 = b.outputs.find((o) => o.inventoryItem.sku === "FL-GR1-01")?.quantityKg || 0;
            const g2 = b.outputs.find((o) => o.inventoryItem.sku === "FL-GR2-02")?.quantityKg || 0;
            return {
                batchNumber: b.batchNumber,
                rawMaizeConsumed: Number(b.rawMaizeConsumed),
                grade1Produced: Number(g1),
                grade2Produced: Number(g2),
                wasteLoss: Number(b.wasteLoss),
                efficiency: Number(b.efficiency),
                createdAt: b.createdAt,
            };
        }),
        recentPackaging: packagingRuns.slice(0, 5).map((r) => ({
            runNumber: r.runNumber,
            operatorName: r.operatorName,
            totalPackagedKg: Number(r.totalPackagedKg),
            flourSpillage: Number(r.flourSpillage),
            yieldPercent: Number(r.yieldPercent),
            createdAt: r.createdAt,
        })),
        recentTransfers: [],
    };
}
