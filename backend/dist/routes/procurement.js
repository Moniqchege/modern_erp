"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.procurementRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const server_1 = require("../server");
const requisitionService = __importStar(require("../services/procurement/requisition.service"));
const poService = __importStar(require("../services/procurement/purchase-order.service"));
const receivingService = __importStar(require("../services/procurement/receiving.service"));
const financeService = __importStar(require("../services/procurement/finance-match.service"));
const itemProfileSyncService = __importStar(require("../services/procurement/item-profile-sync.service"));
const procurement_reports_service_1 = require("../services/procurement-reports.service");
const auth_1 = require("../middleware/auth");
exports.procurementRouter = (0, express_1.Router)();
// ─── Role helpers ────────────────────────────────────────────────────────────
/** Roles that can CREATE / SUBMIT requisitions (Maker role) */
const MAKER_ROLES = new Set([
    "PROCUREMENT_OFFICER",
    "MANAGER",
    "ADMIN",
    "SUPERADMIN",
    "EMPLOYEE",
    "WAREHOUSE_OPERATOR",
]);
/** Roles that can APPROVE / REJECT requisitions (Approver role) */
const APPROVER_ROLES = new Set([
    "MANAGER",
    "FINANCE_DIRECTOR",
    "ADMIN",
    "SUPERADMIN",
]);
function requireMaker(req, res, next) {
    const role = req.auth?.role;
    if (!role || !MAKER_ROLES.has(role)) {
        return res.status(403).json({ message: "Forbidden: Maker role required" });
    }
    next();
}
function requireApprover(req, res, next) {
    const role = req.auth?.role;
    if (!role || !APPROVER_ROLES.has(role)) {
        return res.status(403).json({ message: "Forbidden: Approver role required" });
    }
    next();
}
// ─── Validation schemas ──────────────────────────────────────────────────────
const RequisitionLineSchema = zod_1.z.object({
    itemProfileId: zod_1.z.string().min(1),
    quantity: zod_1.z.number().positive(),
    unitPriceEstimate: zod_1.z.number().nonnegative().optional(),
    notes: zod_1.z.string().max(500).optional(),
});
const CreateRequisitionSchema = zod_1.z.object({
    requestedBy: zod_1.z.string().min(1),
    department: zod_1.z.string().optional(),
    supplierId: zod_1.z.string().optional(),
    source: zod_1.z.enum(["LOW_STOCK_AUTO", "MANUAL_PLANT", "MANUAL_PROCUREMENT"]).optional(),
    justification: zod_1.z.string().max(2000).optional(),
    requiredByDate: zod_1.z.coerce.date().optional(),
    currency: zod_1.z.enum(["KES", "USD", "EUR", "UGX", "TZS"]).optional(),
    lines: zod_1.z.array(RequisitionLineSchema).min(1),
});
const MaizeQCSchema = zod_1.z.object({
    category: zod_1.z.literal("RAW_MATERIAL"),
    weighbridgeTicketId: zod_1.z.string().optional(),
    rawMaizeBatchId: zod_1.z.string().optional(),
    grnId: zod_1.z.string().optional(),
    testedBy: zod_1.z.string().min(1),
    moistureContentPct: zod_1.z.number().min(0).max(100),
    aflatoxinPpb: zod_1.z.number().nonnegative(),
    rottenBrokenPct: zod_1.z.number().min(0).max(100),
    foreignMatterPct: zod_1.z.number().min(0).max(100),
    liveInsectsCount: zod_1.z.number().int().nonnegative(),
    acceptedQuantity: zod_1.z.number().positive().optional(),
    remarks: zod_1.z.string().optional(),
});
const PackagingQCSchema = zod_1.z.object({
    category: zod_1.z.literal("PACKAGING"),
    grnId: zod_1.z.string().optional(),
    testedBy: zod_1.z.string().min(1),
    tensileStrengthN: zod_1.z.number().positive(),
    printAlignmentScore: zod_1.z.number().min(0).max(100),
    dimensionAccuracyMm: zod_1.z.number().nonnegative(),
    acceptedQuantity: zod_1.z.number().positive(),
    remarks: zod_1.z.string().optional(),
});
// ─── Item profiles ───────────────────────────────────────────────────────────
exports.procurementRouter.get("/item-profiles", async (_req, res) => {
    const profiles = await server_1.prisma.procurementItemProfile.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
    });
    res.json({ success: true, profiles });
});
exports.procurementRouter.post("/item-profiles", async (req, res) => {
    const schema = zod_1.z.object({
        sku: zod_1.z.string().min(1),
        name: zod_1.z.string().min(1),
        category: zod_1.z.enum(["RAW_MATERIAL", "PACKAGING", "MILLING_CONSUMABLE", "ENGINEERING_SPARE"]),
        unit: zod_1.z.enum(["KG", "BAG", "TONNE"]).optional(),
        inventoryItemId: zod_1.z.string().optional(),
        lowStockThreshold: zod_1.z.number().nonnegative().optional(),
        reorderQuantity: zod_1.z.number().nonnegative().optional(),
        packagingBagSize: zod_1.z.enum(["KG_1", "KG_2", "KG_5", "KG_10", "KG_24", "KG_50"]).optional(),
        moistureMaxPct: zod_1.z.number().optional(),
        aflatoxinMaxPpb: zod_1.z.number().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ errors: parse.error.flatten() });
    const profile = await server_1.prisma.procurementItemProfile.create({ data: parse.data });
    res.status(201).json({ success: true, profile });
});
exports.procurementRouter.post("/item-profiles/sync-from-inventory", async (_req, res) => {
    const result = await itemProfileSyncService.syncItemProfilesFromInventory();
    res.json({ success: true, ...result });
});
// ─── Reports ──────────────────────────────────────────────────────────────────
exports.procurementRouter.get("/reports", (_req, res) => {
    res.json({ success: true, reports: procurement_reports_service_1.PROCUREMENT_REPORT_TYPES });
});
exports.procurementRouter.get("/reports/:reportType", auth_1.requireAuth, async (req, res) => {
    try {
        const reportType = req.params.reportType;
        const valid = procurement_reports_service_1.PROCUREMENT_REPORT_TYPES.some((r) => r.id === reportType);
        if (!valid) {
            return res.status(400).json({
                message: "Unknown report type",
                available: procurement_reports_service_1.PROCUREMENT_REPORT_TYPES.map((r) => r.id),
            });
        }
        const { from, to } = req.query;
        const buffer = await (0, procurement_reports_service_1.generateProcurementReportBuffer)(reportType, typeof from === "string" ? from : undefined, typeof to === "string" ? to : undefined);
        const filename = `procurement-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(buffer);
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to generate report",
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
// ─── Reports dashboard ───────────────────────────────────────────────────────
exports.procurementRouter.get("/dashboard", auth_1.requireAuth, async (_req, res) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(now.getDate() - 90);
    const [totalSuppliers, activeSuppliers, totalRequisitions, reqByStatus, totalPOs, poByStatus, poSpend, openPOValue, totalGrns, grnPosted, matchData, recentPOs, topSuppliers, monthlySpend, vatBreakdown,] = await Promise.all([
        // supplier counts
        server_1.prisma.supplier.count(),
        server_1.prisma.supplier.count({ where: { status: "ACTIVE" } }),
        // requisition counts
        server_1.prisma.purchaseRequisition.count(),
        server_1.prisma.purchaseRequisition.groupBy({ by: ["status"], _count: { _all: true } }),
        // PO counts
        server_1.prisma.purchaseOrder.count(),
        server_1.prisma.purchaseOrder.groupBy({ by: ["status"], _count: { _all: true } }),
        // total spend on all POs (sum totalAmount)
        server_1.prisma.purchaseOrder.aggregate({ _sum: { totalAmount: true } }),
        // open PO value (DRAFT + ISSUED + PARTIALLY_RECEIVED)
        server_1.prisma.purchaseOrder.aggregate({
            where: { status: { in: ["DRAFT", "ISSUED", "PARTIALLY_RECEIVED"] } },
            _sum: { totalAmount: true },
        }),
        // GRN counts
        server_1.prisma.goodsReceivedNote.count(),
        server_1.prisma.goodsReceivedNote.count({ where: { status: "POSTED" } }),
        // 3-way match stats
        server_1.prisma.threeWayMatch.groupBy({ by: ["status"], _count: { _all: true } }),
        // recent POs (last 10)
        server_1.prisma.purchaseOrder.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                poNumber: true,
                status: true,
                currency: true,
                subtotal: true,
                taxRate: true,
                taxAmount: true,
                totalAmount: true,
                createdAt: true,
                supplier: { select: { name: true } },
            },
        }),
        // top suppliers by PO value (last 90 days)
        server_1.prisma.purchaseOrder.groupBy({
            by: ["supplierId"],
            where: { createdAt: { gte: ninetyDaysAgo } },
            _sum: { totalAmount: true },
            _count: { _all: true },
            orderBy: { _sum: { totalAmount: "desc" } },
            take: 8,
        }),
        // monthly PO spend (last 6 months) — raw aggregation via findMany + JS group
        server_1.prisma.purchaseOrder.findMany({
            where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
            select: { createdAt: true, totalAmount: true, taxAmount: true, subtotal: true },
        }),
        // VAT vs non-VAT breakdown
        server_1.prisma.purchaseOrder.groupBy({
            by: ["taxRate"],
            _count: { _all: true },
            _sum: { totalAmount: true, taxAmount: true },
        }),
    ]);
    // resolve supplier names for top suppliers
    const supplierIds = topSuppliers.map((s) => s.supplierId);
    const supplierNames = await server_1.prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, name: true },
    });
    const nameMap = Object.fromEntries(supplierNames.map((s) => [s.id, s.name]));
    // build monthly spend buckets
    const monthBuckets = {};
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString("en-KE", { month: "short", year: "2-digit" });
        monthBuckets[key] = { label, totalSpend: 0, vatAmount: 0, subtotal: 0, count: 0 };
    }
    for (const po of monthlySpend) {
        const d = new Date(po.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthBuckets[key]) {
            monthBuckets[key].totalSpend += Number(po.totalAmount) || 0;
            monthBuckets[key].vatAmount += Number(po.taxAmount) || 0;
            monthBuckets[key].subtotal += Number(po.subtotal) || 0;
            monthBuckets[key].count += 1;
        }
    }
    // build status maps
    const reqStatusMap = {};
    for (const r of reqByStatus)
        reqStatusMap[r.status] = r._count._all;
    const poStatusMap = {};
    for (const p of poByStatus)
        poStatusMap[p.status] = p._count._all;
    const matchStatusMap = {};
    for (const m of matchData)
        matchStatusMap[m.status] = m._count._all;
    res.json({
        success: true,
        kpis: {
            totalSuppliers,
            activeSuppliers,
            totalRequisitions,
            pendingApprovals: (reqStatusMap["PENDING_HEAD_PROCUREMENT"] ?? 0) +
                (reqStatusMap["PENDING_FINANCE"] ?? 0),
            convertedRequisitions: reqStatusMap["CONVERTED_TO_PO"] ?? 0,
            totalPOs,
            openPOs: (poStatusMap["DRAFT"] ?? 0) +
                (poStatusMap["ISSUED"] ?? 0) +
                (poStatusMap["PARTIALLY_RECEIVED"] ?? 0),
            fullyReceivedPOs: poStatusMap["FULLY_RECEIVED"] ?? 0,
            cancelledPOs: poStatusMap["CANCELLED"] ?? 0,
            totalSpendKes: Number(poSpend._sum.totalAmount) || 0,
            openPOValueKes: Number(openPOValue._sum.totalAmount) || 0,
            totalGrns,
            postedGrns: grnPosted,
            pendingQcGrns: totalGrns - grnPosted,
            matchedInvoices: matchStatusMap["MATCHED"] ?? 0,
            approvedForPayment: matchStatusMap["APPROVED_FOR_PAYMENT"] ?? 0,
            discrepancies: (matchStatusMap["PRICE_DISCREPANCY"] ?? 0) +
                (matchStatusMap["QUANTITY_DISCREPANCY"] ?? 0) +
                (matchStatusMap["BOTH_DISCREPANCY"] ?? 0),
        },
        reqByStatus: reqStatusMap,
        poByStatus: poStatusMap,
        matchByStatus: matchStatusMap,
        monthlySpend: Object.values(monthBuckets),
        topSuppliersBySpend: topSuppliers.map((s) => ({
            supplierId: s.supplierId,
            supplierName: nameMap[s.supplierId] ?? "Unknown",
            totalSpend: Number(s._sum.totalAmount) || 0,
            poCount: s._count._all,
        })),
        vatBreakdown: vatBreakdown.map((v) => ({
            taxRate: Number(v.taxRate),
            poCount: v._count._all,
            totalAmount: Number(v._sum.totalAmount) || 0,
            taxAmount: Number(v._sum.taxAmount) || 0,
        })),
        recentPOs: recentPOs.map((po) => ({
            id: po.id,
            poNumber: po.poNumber,
            status: po.status,
            currency: po.currency,
            subtotal: Number(po.subtotal),
            taxRate: Number(po.taxRate),
            taxAmount: Number(po.taxAmount),
            totalAmount: Number(po.totalAmount),
            supplierName: po.supplier?.name ?? "—",
            createdAt: po.createdAt,
        })),
    });
});
// ─── Requisitions ────────────────────────────────────────────────────────────
exports.procurementRouter.get("/requisitions", auth_1.requireAuth, async (req, res) => {
    const status = req.query.status;
    const requisitions = await server_1.prisma.purchaseRequisition.findMany({
        where: status ? { status: status } : undefined,
        include: {
            lines: { include: { itemProfile: true } },
            supplier: true,
            approvals: { orderBy: { decidedAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, requisitions });
});
exports.procurementRouter.get("/requisitions/:id", auth_1.requireAuth, async (req, res) => {
    const requisition = await server_1.prisma.purchaseRequisition.findUnique({
        where: { id: req.params.id },
        include: {
            lines: { include: { itemProfile: true } },
            supplier: true,
            approvals: { orderBy: { decidedAt: "asc" } },
            purchaseOrders: { include: { supplier: true } },
        },
    });
    if (!requisition)
        return res.status(404).json({ message: "Requisition not found" });
    // Fetch audit log for this requisition
    const auditLogs = await server_1.prisma.procurementAuditLog.findMany({
        where: { entityType: "PurchaseRequisition", entityId: req.params.id },
        orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, requisition, auditLogs });
});
// POST /requisitions — Maker creates a DRAFT requisition
exports.procurementRouter.post("/requisitions", auth_1.requireAuth, requireMaker, async (req, res) => {
    const parse = CreateRequisitionSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid body", errors: parse.error.flatten() });
    }
    const actor = req.auth;
    try {
        const requisition = await requisitionService.createRequisition({
            ...parse.data,
            requestedBy: parse.data.requestedBy || actor.email,
            requestedById: actor.userId,
        });
        res.status(201).json({ success: true, requisition });
    }
    catch (error) {
        res.status(500).json({ message: String(error) });
    }
});
// POST /requisitions/low-stock/generate — system auto-gen (no role gate)
exports.procurementRouter.post("/requisitions/low-stock/generate", async (_req, res) => {
    const created = await requisitionService.generateLowStockRequisitions();
    res.json({ success: true, count: created.length, requisitions: created });
});
// POST /requisitions/:id/submit — Maker submits DRAFT → PENDING
exports.procurementRouter.post("/requisitions/:id/submit", auth_1.requireAuth, requireMaker, async (req, res) => {
    const actor = req.auth;
    try {
        const requisition = await requisitionService.submitRequisition(req.params.id, actor.userId, actor.email);
        res.json({ success: true, requisition });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
// POST /requisitions/:id/approve — Approver approves PENDING → APPROVED (+ auto-PO)
exports.procurementRouter.post("/requisitions/:id/approve", auth_1.requireAuth, requireApprover, async (req, res) => {
    const actor = req.auth;
    const body = zod_1.z.object({ comments: zod_1.z.string().optional() }).safeParse(req.body);
    const comments = body.success ? body.data.comments : undefined;
    try {
        const requisition = await requisitionService.approveRequisition(req.params.id, actor.userId, actor.email, comments);
        res.json({ success: true, requisition });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
// POST /requisitions/:id/reject — Approver rejects PENDING → REJECTED
exports.procurementRouter.post("/requisitions/:id/reject", auth_1.requireAuth, requireApprover, async (req, res) => {
    const actor = req.auth;
    const body = zod_1.z.object({ reason: zod_1.z.string().min(1) }).safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ message: "reason is required" });
    try {
        const requisition = await requisitionService.rejectRequisition(req.params.id, actor.userId, actor.email, body.data.reason);
        res.json({ success: true, requisition });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
// ─── Purchase orders ─────────────────────────────────────────────────────────
exports.procurementRouter.get("/purchase-orders", auth_1.requireAuth, async (req, res) => {
    const orders = await server_1.prisma.purchaseOrder.findMany({
        where: req.query.status ? { status: req.query.status } : undefined,
        include: { supplier: true, lines: { include: { itemProfile: true } } },
        orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, purchaseOrders: orders });
});
exports.procurementRouter.get("/purchase-orders/:id", auth_1.requireAuth, async (req, res) => {
    const po = await server_1.prisma.purchaseOrder.findUnique({
        where: { id: req.params.id },
        include: {
            supplier: true,
            lines: { include: { itemProfile: true } },
            requisition: {
                include: { lines: { include: { itemProfile: true } } },
            },
            grns: {
                include: { lines: true, qcResults: true },
                orderBy: { receivedAt: "desc" },
            },
            approvals: { orderBy: { decidedAt: "asc" } },
        },
    });
    if (!po)
        return res.status(404).json({ message: "Purchase order not found" });
    res.json({ success: true, purchaseOrder: po });
});
// POST /purchase-orders/from-requisition/:id — Approver creates PO from APPROVED requisition
exports.procurementRouter.post("/purchase-orders/from-requisition/:requisitionId", auth_1.requireAuth, requireApprover, async (req, res) => {
    const actor = req.auth;
    const body = zod_1.z
        .object({ termsAndConditions: zod_1.z.string().optional(), applyVat: zod_1.z.boolean().optional() })
        .safeParse(req.body);
    try {
        const po = await poService.createPurchaseOrderFromRequisition(req.params.requisitionId, actor.email, body.success ? body.data.termsAndConditions : undefined, body.success ? (body.data.applyVat ?? true) : true);
        res.status(201).json({ success: true, purchaseOrder: po });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
exports.procurementRouter.post("/purchase-orders/:id/issue", auth_1.requireAuth, requireApprover, async (req, res) => {
    const actor = req.auth;
    try {
        const po = await poService.issuePurchaseOrder(req.params.id, actor.email);
        res.json({ success: true, purchaseOrder: po });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
exports.procurementRouter.post("/purchase-orders/:id/cancel", auth_1.requireAuth, requireApprover, async (req, res) => {
    const actor = req.auth;
    const body = zod_1.z.object({ reason: zod_1.z.string().optional() }).safeParse(req.body);
    try {
        const po = await poService.cancelPurchaseOrder(req.params.id, actor.email, body.success ? body.data.reason : undefined);
        res.json({ success: true, purchaseOrder: po });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
exports.procurementRouter.patch("/purchase-orders/:id/expected-delivery", auth_1.requireAuth, requireApprover, async (req, res) => {
    const body = zod_1.z.object({ expectedDelivery: zod_1.z.coerce.date() }).safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ message: "expectedDelivery date required" });
    try {
        const po = await poService.updateExpectedDelivery(req.params.id, body.data.expectedDelivery);
        res.json({ success: true, purchaseOrder: po });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
// ─── Weighbridge ─────────────────────────────────────────────────────────────
exports.procurementRouter.post("/weighbridge/tickets", async (req, res) => {
    const schema = zod_1.z.object({
        purchaseOrderId: zod_1.z.string().optional(),
        rawMaizeBatchId: zod_1.z.string().optional(),
        truckRegistration: zod_1.z.string().min(1),
        driverName: zod_1.z.string().optional(),
        grossWeightKg: zod_1.z.number().positive(),
        tareWeightKg: zod_1.z.number().nonnegative(),
        operatorName: zod_1.z.string().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ errors: parse.error.flatten() });
    try {
        const ticket = await receivingService.recordWeighbridgeTicket(parse.data);
        res.status(201).json({ success: true, ticket });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
// ─── QC ──────────────────────────────────────────────────────────────────────
exports.procurementRouter.post("/qc/maize", async (req, res) => {
    const parse = MaizeQCSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ errors: parse.error.flatten() });
    const qc = await receivingService.submitProcurementQC(parse.data);
    res.status(201).json({ success: true, qc });
});
exports.procurementRouter.post("/qc/packaging", async (req, res) => {
    const parse = PackagingQCSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ errors: parse.error.flatten() });
    const qc = await receivingService.submitProcurementQC(parse.data);
    res.status(201).json({ success: true, qc });
});
// ─── GRN ─────────────────────────────────────────────────────────────────────
exports.procurementRouter.get("/grns", async (_req, res) => {
    const grns = await server_1.prisma.goodsReceivedNote.findMany({
        include: { lines: true, purchaseOrder: { include: { supplier: true } }, qcResults: true },
        orderBy: { receivedAt: "desc" },
    });
    res.json({ success: true, grns });
});
exports.procurementRouter.post("/grns", async (req, res) => {
    const schema = zod_1.z.object({
        purchaseOrderId: zod_1.z.string().min(1),
        weighbridgeTicketId: zod_1.z.string().optional(),
        receivedBy: zod_1.z.string().min(1),
        deliverySequence: zod_1.z.number().int().positive().optional(),
        lines: zod_1.z
            .array(zod_1.z.object({
            purchaseOrderLineId: zod_1.z.string().min(1),
            quantityAccepted: zod_1.z.number().positive(),
            quantityRejected: zod_1.z.number().nonnegative().optional(),
            unitPriceApplied: zod_1.z.number().nonnegative(),
            lotNumber: zod_1.z.string().optional(),
        }))
            .min(1),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ errors: parse.error.flatten() });
    try {
        const grn = await receivingService.createGrnDraft(parse.data);
        res.status(201).json({ success: true, grn });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
exports.procurementRouter.post("/grns/:id/post", async (req, res) => {
    const body = zod_1.z.object({ postedBy: zod_1.z.string().min(1) }).safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ message: "postedBy required" });
    try {
        const grn = await receivingService.postGrn(req.params.id, body.data.postedBy);
        res.json({ success: true, grn });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
// ─── Finance: 3-way match ─────────────────────────────────────────────────────
exports.procurementRouter.get("/three-way-match", async (_req, res) => {
    const matches = await server_1.prisma.threeWayMatch.findMany({
        include: {
            grn: { include: { purchaseOrder: { include: { supplier: true } } } },
            supplierInvoice: true,
            paymentVouchers: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, matches });
});
exports.procurementRouter.get("/three-way-match/:id", async (req, res) => {
    const match = await server_1.prisma.threeWayMatch.findUnique({
        where: { id: req.params.id },
        include: {
            grn: {
                include: {
                    lines: { include: { purchaseOrderLine: { include: { itemProfile: true } } } },
                    purchaseOrder: { include: { supplier: true, lines: { include: { itemProfile: true } } } },
                    qcResults: true,
                },
            },
            supplierInvoice: true,
            paymentVouchers: { orderBy: { createdAt: "desc" } },
        },
    });
    if (!match)
        return res.status(404).json({ message: "Match not found" });
    res.json({ success: true, match });
});
/** Combined: register supplier invoice then immediately run 3-way match.
 *  Accepts the invoice fields plus grnId and matchedBy — single round-trip from the UI.
 */
exports.procurementRouter.post("/three-way-match/register-and-match", async (req, res) => {
    const schema = zod_1.z.object({
        // invoice fields
        invoiceNumber: zod_1.z.string().min(1),
        invoiceDate: zod_1.z.coerce.date(),
        dueDate: zod_1.z.coerce.date().optional(),
        currency: zod_1.z.enum(["KES", "USD", "EUR", "UGX", "TZS"]).optional(),
        subtotal: zod_1.z.number().nonnegative(),
        taxAmount: zod_1.z.number().nonnegative(),
        totalAmount: zod_1.z.number().nonnegative(),
        fileUrl: zod_1.z.string().url().optional(),
        // match fields
        grnId: zod_1.z.string().min(1),
        matchedBy: zod_1.z.string().min(1),
        tolerancePct: zod_1.z.number().min(0).max(100).optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ errors: parse.error.flatten() });
    try {
        // Resolve supplierId and purchaseOrderId from the GRN
        const grn = await server_1.prisma.goodsReceivedNote.findUnique({
            where: { id: parse.data.grnId },
            include: { purchaseOrder: { include: { supplier: true } } },
        });
        if (!grn)
            return res.status(404).json({ message: "GRN not found" });
        if (grn.status !== "POSTED")
            return res.status(400).json({ message: "GRN must be POSTED before running 3-way match" });
        const invoice = await financeService.registerSupplierInvoice({
            supplierId: grn.purchaseOrder.supplierId,
            purchaseOrderId: grn.purchaseOrderId,
            invoiceNumber: parse.data.invoiceNumber,
            invoiceDate: parse.data.invoiceDate,
            dueDate: parse.data.dueDate,
            currency: parse.data.currency,
            subtotal: parse.data.subtotal,
            taxAmount: parse.data.taxAmount,
            totalAmount: parse.data.totalAmount,
            fileUrl: parse.data.fileUrl,
        });
        const match = await financeService.runThreeWayMatch({
            grnId: parse.data.grnId,
            supplierInvoiceId: invoice.id,
            matchedBy: parse.data.matchedBy,
            tolerancePct: parse.data.tolerancePct,
        });
        res.status(201).json({ success: true, invoice, match });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
exports.procurementRouter.post("/supplier-invoices", async (req, res) => {
    const schema = zod_1.z.object({
        supplierId: zod_1.z.string().min(1),
        purchaseOrderId: zod_1.z.string().min(1),
        invoiceNumber: zod_1.z.string().min(1),
        invoiceDate: zod_1.z.coerce.date(),
        dueDate: zod_1.z.coerce.date().optional(),
        currency: zod_1.z.enum(["KES", "USD", "EUR", "UGX", "TZS"]).optional(),
        subtotal: zod_1.z.number().nonnegative(),
        taxAmount: zod_1.z.number().nonnegative(),
        totalAmount: zod_1.z.number().nonnegative(),
        fileUrl: zod_1.z.string().url().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ errors: parse.error.flatten() });
    const invoice = await financeService.registerSupplierInvoice(parse.data);
    res.status(201).json({ success: true, invoice });
});
exports.procurementRouter.post("/three-way-match", async (req, res) => {
    const schema = zod_1.z.object({
        grnId: zod_1.z.string().min(1),
        supplierInvoiceId: zod_1.z.string().min(1),
        matchedBy: zod_1.z.string().min(1),
        tolerancePct: zod_1.z.number().min(0).max(100).optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ errors: parse.error.flatten() });
    try {
        const match = await financeService.runThreeWayMatch(parse.data);
        res.status(201).json({ success: true, match });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
exports.procurementRouter.post("/three-way-match/:id/approve-payment", async (req, res) => {
    const body = zod_1.z.object({ approverName: zod_1.z.string().min(1) }).safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ message: "approverName required" });
    const result = await financeService.approveMatchForPayment(req.params.id, body.data.approverName);
    res.json({ success: true, ...result });
});
exports.procurementRouter.post("/payment-vouchers/:id/push-ap", async (req, res) => {
    const voucher = await financeService.pushToAccountsPayableQueue(req.params.id);
    res.json({ success: true, voucher });
});
// ─── Domain events (outbox poll) ─────────────────────────────────────────────
exports.procurementRouter.get("/events/pending", async (_req, res) => {
    const events = await server_1.prisma.domainEvent.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 100,
    });
    res.json({ success: true, events });
});
