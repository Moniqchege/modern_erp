"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const server_1 = require("../server");
exports.dashboardRouter = (0, express_1.Router)();
// Dashboard summary + chart + activity feed
// All values are derived from Prisma models (no hardcoded UI data)
exports.dashboardRouter.get("/summary", async (_req, res) => {
    try {
        // Raw maize stock (only APPROVED batches should be available)
        const rawMaizeAgg = await server_1.prisma.rawMaizeBatch.aggregate({
            where: { status: "APPROVED" },
            _sum: { currentQuantity: true },
        });
        // Finished goods stock by grade
        const grade1 = await server_1.prisma.finishedGoodsBatch.aggregate({
            where: { productType: "GRADE_1_FLOUR" },
            _sum: { currentQuantity: true },
        });
        const grade2 = await server_1.prisma.finishedGoodsBatch.aggregate({
            where: { productType: "GRADE_2_FLOUR" },
            _sum: { currentQuantity: true },
        });
        // Production yield history: last 6 runs by startTime
        const yieldHistory = await server_1.prisma.productionRun.findMany({
            orderBy: { startTime: "desc" },
            take: 6,
            select: {
                runNumber: true,
                startTime: true,
                yieldEfficiency: true,
                variancePercent: true,
            },
        });
        // Average efficiency (all time, for now)
        const avg = await server_1.prisma.productionRun.aggregate({
            _avg: { yieldEfficiency: true },
        });
        const orderedHistory = [...yieldHistory].reverse();
        // Yield loss rate: interpret as average variancePercent (absolute)
        const avgYieldLossRate = await server_1.prisma.productionRun.aggregate({
            _avg: { variancePercent: true },
        });
        const payload = {
            stats: {
                rawMaizeStockKg: rawMaizeAgg._sum.currentQuantity ?? 0,
                grade1FlourStockKg: grade1._sum.currentQuantity ?? 0,
                grade2FlourStockKg: grade2._sum.currentQuantity ?? 0,
                avgMillingEfficiencyPct: avg._avg.yieldEfficiency ?? 0,
                avgYieldLossRatePct: avgYieldLossRate._avg.variancePercent
                    ? Math.abs(Number(avgYieldLossRate._avg.variancePercent))
                    : 0,
            },
            yieldHistory: orderedHistory.map((h) => ({
                label: h.runNumber,
                efficiencyPct: Number(h.yieldEfficiency),
            })),
            recentActivities: await server_1.prisma.productionRun.findMany({
                orderBy: { startTime: "desc" },
                take: 4,
                select: {
                    runNumber: true,
                    startTime: true,
                    yieldEfficiency: true,
                    variancePercent: true,
                },
            }),
        };
        res.status(200).json({ success: true, ...payload });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch dashboard summary", error: String(error) });
    }
});
