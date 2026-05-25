"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const server_1 = require("../server");
exports.dashboardRouter = (0, express_1.Router)();
// Dashboard summary + chart + activity feed
// Analytics are derived from the same datasets that power:
// - GET /api/inventory
// - GET /api/production
// This keeps the dashboard aligned with the inventory/production tables shown in the task.
exports.dashboardRouter.get("/summary", async (_req, res) => {
    try {
        // Inventory-derived stats
        const inventoryItems = await server_1.prisma.inventoryItem.findMany({
            select: {
                sku: true,
                type: true,
                quantity: true,
            },
        });
        const rawMaizeStockKg = inventoryItems
            .filter((i) => i.sku === "MZ-RAW-01" || i.type === "RAW_MATERIAL")
            .reduce((sum, i) => sum + Number(i.quantity), 0);
        const finishedGoodsStockKg = inventoryItems
            .filter((i) => i.type === "FINISHED_GOOD")
            .reduce((sum, i) => sum + Number(i.quantity), 0);
        const byProductsStockKg = inventoryItems
            .filter((i) => i.type === "BY_PRODUCT")
            .reduce((sum, i) => sum + Number(i.quantity), 0);
        // Production-derived stats (legacy MVP model)
        const productionBatches = await server_1.prisma.productionBatch.findMany({
            orderBy: { createdAt: "desc" },
            take: 6,
        });
        const orderedHistory = [...productionBatches].reverse();
        const yieldHistory = orderedHistory.map((b) => ({
            label: b.batchNumber,
            efficiencyPct: Number(b.efficiency),
        }));
        // Recent activities (last 4)
        const recent = await server_1.prisma.productionBatch.findMany({
            orderBy: { createdAt: "desc" },
            take: 4,
            select: {
                batchNumber: true,
                createdAt: true,
                efficiency: true,
                rawMaizeConsumed: true,
                wasteLoss: true,
            },
        });
        // Interpret waste loss rate as (wasteLoss / rawMaizeConsumed) * 100, matching task semantics.
        const recentActivities = recent.map((b) => {
            const consumed = Number(b.rawMaizeConsumed);
            const loss = Number(b.wasteLoss);
            const variancePercent = consumed > 0 ? (loss / consumed) * 100 : 0;
            return {
                runNumber: b.batchNumber,
                startTime: b.createdAt,
                yieldEfficiency: Number(b.efficiency),
                variancePercent,
            };
        });
        const avgAgg = await server_1.prisma.productionBatch.aggregate({
            _avg: { efficiency: true },
        });
        const avgEff = avgAgg._avg.efficiency ? Number(avgAgg._avg.efficiency) : 0;
        // Average yield loss rate across last 6 batches if available; fallback to all time.
        const withLossRate = await server_1.prisma.productionBatch.findMany({
            orderBy: { createdAt: "desc" },
            take: 6,
            select: { rawMaizeConsumed: true, wasteLoss: true },
        });
        const lossRates = withLossRate
            .map((b) => {
            const consumed = Number(b.rawMaizeConsumed);
            const loss = Number(b.wasteLoss);
            return consumed > 0 ? (loss / consumed) * 100 : 0;
        })
            .filter((n) => Number.isFinite(n));
        const avgYieldLossRatePct = lossRates.length
            ? lossRates.reduce((a, c) => a + c, 0) / lossRates.length
            : 0;
        const payload = {
            stats: {
                rawMaizeStockKg,
                finishedGoodsStockKg,
                byProductsStockKg,
                avgMillingEfficiencyPct: avgEff,
                avgYieldLossRatePct: Math.abs(avgYieldLossRatePct),
            },
            yieldHistory,
            recentActivities,
        };
        res.status(200).json({ success: true, ...payload });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch dashboard summary", error: String(error) });
    }
});
