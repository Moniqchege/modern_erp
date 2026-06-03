import { Router } from "express";
import { z } from "zod";
import { prisma } from "../server";
import * as requisitionService from "../services/procurement/requisition.service";
import * as poService from "../services/procurement/purchase-order.service";
import * as receivingService from "../services/procurement/receiving.service";
import * as financeService from "../services/procurement/finance-match.service";
import * as itemProfileSyncService from "../services/procurement/item-profile-sync.service";
import {
  PROCUREMENT_REPORT_TYPES,
  ProcurementReportType,
  generateProcurementReportBuffer,
} from "../services/procurement-reports.service";
import { requireAuth } from "../middleware/auth";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { Request, Response, NextFunction } from "express";

export const procurementRouter = Router();

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

function requireMaker(req: Request, res: Response, next: NextFunction) {
  const role = (req as AuthenticatedRequest).auth?.role;
  if (!role || !MAKER_ROLES.has(role)) {
    return res.status(403).json({ message: "Forbidden: Maker role required" });
  }
  next();
}

function requireApprover(req: Request, res: Response, next: NextFunction) {
  const role = (req as AuthenticatedRequest).auth?.role;
  if (!role || !APPROVER_ROLES.has(role)) {
    return res.status(403).json({ message: "Forbidden: Approver role required" });
  }
  next();
}

// ─── Validation schemas ──────────────────────────────────────────────────────

const RequisitionLineSchema = z.object({
  itemProfileId: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceEstimate: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

const CreateRequisitionSchema = z.object({
  requestedBy: z.string().min(1),
  department: z.string().optional(),
  supplierId: z.string().optional(),
  source: z.enum(["LOW_STOCK_AUTO", "MANUAL_PLANT", "MANUAL_PROCUREMENT"]).optional(),
  justification: z.string().max(2000).optional(),
  requiredByDate: z.coerce.date().optional(),
  currency: z.enum(["KES", "USD", "EUR", "UGX", "TZS"]).optional(),
  lines: z.array(RequisitionLineSchema).min(1),
});

const MaizeQCSchema = z.object({
  category: z.literal("RAW_MATERIAL"),
  weighbridgeTicketId: z.string().optional(),
  rawMaizeBatchId: z.string().optional(),
  grnId: z.string().optional(),
  testedBy: z.string().min(1),
  moistureContentPct: z.number().min(0).max(100),
  aflatoxinPpb: z.number().nonnegative(),
  rottenBrokenPct: z.number().min(0).max(100),
  foreignMatterPct: z.number().min(0).max(100),
  liveInsectsCount: z.number().int().nonnegative(),
  acceptedQuantity: z.number().positive().optional(),
  remarks: z.string().optional(),
});

const PackagingQCSchema = z.object({
  category: z.literal("PACKAGING"),
  grnId: z.string().optional(),
  testedBy: z.string().min(1),
  tensileStrengthN: z.number().positive(),
  printAlignmentScore: z.number().min(0).max(100),
  dimensionAccuracyMm: z.number().nonnegative(),
  acceptedQuantity: z.number().positive(),
  remarks: z.string().optional(),
});

// ─── Item profiles ───────────────────────────────────────────────────────────

procurementRouter.get("/item-profiles", async (_req, res) => {
  const profiles = await prisma.procurementItemProfile.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  res.json({ success: true, profiles });
});

procurementRouter.post("/item-profiles", async (req, res) => {
  const schema = z.object({
    sku: z.string().min(1),
    name: z.string().min(1),
    category: z.enum(["RAW_MATERIAL", "PACKAGING", "MILLING_CONSUMABLE", "ENGINEERING_SPARE"]),
    unit: z.enum(["KG", "BAG", "TONNE"]).optional(),
    inventoryItemId: z.string().optional(),
    lowStockThreshold: z.number().nonnegative().optional(),
    reorderQuantity: z.number().nonnegative().optional(),
    packagingBagSize: z.enum(["KG_1", "KG_2", "KG_5", "KG_10", "KG_24", "KG_50"]).optional(),
    moistureMaxPct: z.number().optional(),
    aflatoxinMaxPpb: z.number().optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  const profile = await prisma.procurementItemProfile.create({ data: parse.data as never });
  res.status(201).json({ success: true, profile });
});

procurementRouter.post("/item-profiles/sync-from-inventory", async (_req, res) => {
  const result = await itemProfileSyncService.syncItemProfilesFromInventory();
  res.json({ success: true, ...result });
});

// ─── Reports ──────────────────────────────────────────────────────────────────

procurementRouter.get("/reports", (_req, res) => {
  res.json({ success: true, reports: PROCUREMENT_REPORT_TYPES });
});

procurementRouter.get("/reports/:reportType", requireAuth, async (req, res) => {
  try {
    const reportType = req.params.reportType as ProcurementReportType;
    const valid = PROCUREMENT_REPORT_TYPES.some((r) => r.id === reportType);
    if (!valid) {
      return res.status(400).json({
        message: "Unknown report type",
        available: PROCUREMENT_REPORT_TYPES.map((r) => r.id),
      });
    }

    const { from, to } = req.query;
    const buffer = await generateProcurementReportBuffer(
      reportType,
      typeof from === "string" ? from : undefined,
      typeof to === "string" ? to : undefined
    );

    const filename = `procurement-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      message: "Failed to generate report",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── Reports dashboard ───────────────────────────────────────────────────────

procurementRouter.get("/dashboard", requireAuth, async (_req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(now.getDate() - 90);

    const [
      totalSuppliers,
      activeSuppliers,
      totalRequisitions,
      reqByStatus,
      totalPOs,
      poByStatus,
      poSpend,
      openPOValue,
      totalGrns,
      grnPosted,
      matchData,
      recentPOs,
      topSuppliers,
      monthlySpend,
      vatBreakdown,
    ] = await Promise.all([
      // supplier counts
      prisma.supplier.count(),
      prisma.supplier.count({ where: { status: "ACTIVE" } }),

      // requisition counts
      prisma.purchaseRequisition.count(),
      prisma.purchaseRequisition.groupBy({ by: ["status"], _count: { _all: true } }),

      // PO counts
      prisma.purchaseOrder.count(),
      prisma.purchaseOrder.groupBy({ by: ["status"], _count: { _all: true } }),

      // total spend on all POs (sum totalAmount)
      prisma.purchaseOrder.aggregate({ _sum: { totalAmount: true } }),

      // open PO value (DRAFT + ISSUED + PARTIALLY_RECEIVED)
      prisma.purchaseOrder.aggregate({
        where: { status: { in: ["DRAFT", "ISSUED", "PARTIALLY_RECEIVED"] } },
        _sum: { totalAmount: true },
      }),

      // GRN counts
      prisma.goodsReceivedNote.count(),
      prisma.goodsReceivedNote.count({ where: { status: "POSTED" } }),

      // 3-way match stats
      prisma.threeWayMatch.groupBy({ by: ["status"], _count: { _all: true } }),

      // recent POs (last 10)
      prisma.purchaseOrder.findMany({
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
      prisma.purchaseOrder.groupBy({
        by: ["supplierId"],
        where: { createdAt: { gte: ninetyDaysAgo } },
        _sum: { totalAmount: true },
        _count: { _all: true },
        orderBy: { _sum: { totalAmount: "desc" } },
        take: 8,
      }),

      // monthly PO spend (last 6 months) — raw aggregation via findMany + JS group
      prisma.purchaseOrder.findMany({
        where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
        select: { createdAt: true, totalAmount: true, taxAmount: true, subtotal: true },
      }),

      // VAT vs non-VAT breakdown
      prisma.purchaseOrder.groupBy({
        by: ["taxRate"],
        _count: { _all: true },
        _sum: { totalAmount: true, taxAmount: true },
      }),
    ]);

    // resolve supplier names for top suppliers
    const supplierIds = topSuppliers.map((s) => s.supplierId);
    const supplierNames = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true },
    });
    const nameMap = Object.fromEntries(supplierNames.map((s) => [s.id, s.name]));

    // build monthly spend buckets
    const monthBuckets: Record<string, { label: string; totalSpend: number; vatAmount: number; subtotal: number; count: number }> = {};
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
    const reqStatusMap: Record<string, number> = {};
    for (const r of reqByStatus) reqStatusMap[r.status] = r._count._all;

    const poStatusMap: Record<string, number> = {};
    for (const p of poByStatus) poStatusMap[p.status] = p._count._all;

    const matchStatusMap: Record<string, number> = {};
    for (const m of matchData) matchStatusMap[m.status] = m._count._all;

    res.json({
      success: true,
      kpis: {
        totalSuppliers,
        activeSuppliers,
        totalRequisitions,
        pendingApprovals:
          (reqStatusMap["PENDING_HEAD_PROCUREMENT"] ?? 0) +
          (reqStatusMap["PENDING_FINANCE"] ?? 0),
        convertedRequisitions: reqStatusMap["CONVERTED_TO_PO"] ?? 0,
        totalPOs,
        openPOs:
          (poStatusMap["DRAFT"] ?? 0) +
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
        discrepancies:
          (matchStatusMap["PRICE_DISCREPANCY"] ?? 0) +
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
  } catch (error) {
    console.error("[procurement/dashboard] error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load procurement dashboard",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─── Requisitions ────────────────────────────────────────────────────────────

procurementRouter.get("/requisitions", requireAuth, async (req, res) => {
  const status = req.query.status as string | undefined;
  const requisitions = await prisma.purchaseRequisition.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      lines: { include: { itemProfile: true } },
      supplier: true,
      approvals: { orderBy: { decidedAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, requisitions });
});

procurementRouter.get("/requisitions/:id", requireAuth, async (req, res) => {
  const requisition = await prisma.purchaseRequisition.findUnique({
    where: { id: req.params.id },
    include: {
      lines: { include: { itemProfile: true } },
      supplier: true,
      approvals: { orderBy: { decidedAt: "asc" } },
      purchaseOrders: { include: { supplier: true } },
    },
  });
  if (!requisition) return res.status(404).json({ message: "Requisition not found" });

  // Fetch audit log for this requisition
  const auditLogs = await prisma.procurementAuditLog.findMany({
    where: { entityType: "PurchaseRequisition", entityId: req.params.id },
    orderBy: { createdAt: "asc" },
  });

  res.json({ success: true, requisition, auditLogs });
});

// POST /requisitions — Maker creates a DRAFT requisition
procurementRouter.post("/requisitions", requireAuth, requireMaker, async (req, res) => {
  const parse = CreateRequisitionSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid body", errors: parse.error.flatten() });
  }
  const actor = (req as AuthenticatedRequest).auth;
  try {
    const requisition = await requisitionService.createRequisition({
      ...parse.data,
      requestedBy: parse.data.requestedBy || actor.email,
      requestedById: actor.userId,
    });
    res.status(201).json({ success: true, requisition });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

// POST /requisitions/low-stock/generate — system auto-gen (no role gate)
procurementRouter.post("/requisitions/low-stock/generate", async (_req, res) => {
  const created = await requisitionService.generateLowStockRequisitions();
  res.json({ success: true, count: created.length, requisitions: created });
});

// POST /requisitions/:id/submit — Maker submits DRAFT → PENDING
procurementRouter.post(
  "/requisitions/:id/submit",
  requireAuth,
  requireMaker,
  async (req, res) => {
    const actor = (req as AuthenticatedRequest).auth;
    try {
      const requisition = await requisitionService.submitRequisition(
        req.params.id,
        actor.userId,
        actor.email
      );
      res.json({ success: true, requisition });
    } catch (error) {
      res.status(400).json({ message: String(error) });
    }
  }
);

// POST /requisitions/:id/approve — Approver approves PENDING → APPROVED (+ auto-PO)
procurementRouter.post(
  "/requisitions/:id/approve",
  requireAuth,
  requireApprover,
  async (req, res) => {
    const actor = (req as AuthenticatedRequest).auth;
    const body = z.object({ comments: z.string().optional() }).safeParse(req.body);
    const comments = body.success ? body.data.comments : undefined;
    try {
      const requisition = await requisitionService.approveRequisition(
        req.params.id,
        actor.userId,
        actor.email,
        comments
      );
      res.json({ success: true, requisition });
    } catch (error) {
      res.status(400).json({ message: String(error) });
    }
  }
);

// POST /requisitions/:id/reject — Approver rejects PENDING → REJECTED
procurementRouter.post(
  "/requisitions/:id/reject",
  requireAuth,
  requireApprover,
  async (req, res) => {
    const actor = (req as AuthenticatedRequest).auth;
    const body = z.object({ reason: z.string().min(1) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: "reason is required" });
    try {
      const requisition = await requisitionService.rejectRequisition(
        req.params.id,
        actor.userId,
        actor.email,
        body.data.reason
      );
      res.json({ success: true, requisition });
    } catch (error) {
      res.status(400).json({ message: String(error) });
    }
  }
);

// ─── Purchase orders ─────────────────────────────────────────────────────────

procurementRouter.get("/purchase-orders", requireAuth, async (req, res) => {
  const orders = await prisma.purchaseOrder.findMany({
    where: req.query.status ? { status: req.query.status as never } : undefined,
    include: { supplier: true, lines: { include: { itemProfile: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, purchaseOrders: orders });
});

procurementRouter.get("/purchase-orders/:id", requireAuth, async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({
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
  if (!po) return res.status(404).json({ message: "Purchase order not found" });
  res.json({ success: true, purchaseOrder: po });
});

// POST /purchase-orders/from-requisition/:id — Approver creates PO from APPROVED requisition
procurementRouter.post(
  "/purchase-orders/from-requisition/:requisitionId",
  requireAuth,
  requireApprover,
  async (req, res) => {
    const actor = (req as AuthenticatedRequest).auth;
    const body = z
      .object({ termsAndConditions: z.string().optional(), applyVat: z.boolean().optional() })
      .safeParse(req.body);
    try {
      const po = await poService.createPurchaseOrderFromRequisition(
        req.params.requisitionId,
        actor.email,
        body.success ? body.data.termsAndConditions : undefined,
        body.success ? (body.data.applyVat ?? true) : true
      );
      res.status(201).json({ success: true, purchaseOrder: po });
    } catch (error) {
      res.status(400).json({ message: String(error) });
    }
  }
);

procurementRouter.post("/purchase-orders/:id/issue", requireAuth, requireApprover, async (req, res) => {
  const actor = (req as AuthenticatedRequest).auth;
  try {
    const po = await poService.issuePurchaseOrder(req.params.id, actor.email);
    res.json({ success: true, purchaseOrder: po });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

procurementRouter.post("/purchase-orders/:id/cancel", requireAuth, requireApprover, async (req, res) => {
  const actor = (req as AuthenticatedRequest).auth;
  const body = z.object({ reason: z.string().optional() }).safeParse(req.body);
  try {
    const po = await poService.cancelPurchaseOrder(
      req.params.id,
      actor.email,
      body.success ? body.data.reason : undefined
    );
    res.json({ success: true, purchaseOrder: po });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

procurementRouter.patch("/purchase-orders/:id/expected-delivery", requireAuth, requireApprover, async (req, res) => {
  const body = z.object({ expectedDelivery: z.coerce.date() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "expectedDelivery date required" });
  try {
    const po = await poService.updateExpectedDelivery(req.params.id, body.data.expectedDelivery);
    res.json({ success: true, purchaseOrder: po });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

// ─── Weighbridge ─────────────────────────────────────────────────────────────

procurementRouter.get("/weighbridge/tickets", async (_req, res) => {
  try {
    const tickets = await prisma.weighbridgeTicket.findMany({
      where: { direction: "INBOUND" },
      include: {
        purchaseOrder: { include: { supplier: true } },
        qcResults: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { weighedInAt: "desc" },
    });
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: String(error) });
  }
});

procurementRouter.post("/weighbridge/tickets", async (req, res) => {
  const schema = z.object({
    purchaseOrderId: z.string().optional(),
    rawMaizeBatchId: z.string().optional(),
    truckRegistration: z.string().min(1),
    driverName: z.string().optional(),
    grossWeightKg: z.number().positive(),
    tareWeightKg: z.number().nonnegative(),
    operatorName: z.string().optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  try {
    const ticket = await receivingService.recordWeighbridgeTicket(parse.data);
    res.status(201).json({ success: true, ticket });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

// ─── QC ──────────────────────────────────────────────────────────────────────

procurementRouter.get("/qc/results", async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const results = await prisma.procurementQCLabResult.findMany({
      where: category ? { category: category as never } : undefined,
      include: {
        weighbridgeTicket: true,
        grn: { include: { purchaseOrder: { include: { supplier: true } } } },
      },
      orderBy: { testedAt: "desc" },
    });
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: String(error) });
  }
});

procurementRouter.post("/qc/maize", async (req, res) => {
  const parse = MaizeQCSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  const qc = await receivingService.submitProcurementQC(parse.data);
  res.status(201).json({ success: true, qc });
});

procurementRouter.post("/qc/packaging", async (req, res) => {
  const parse = PackagingQCSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  const qc = await receivingService.submitProcurementQC(parse.data);
  res.status(201).json({ success: true, qc });
});

// ─── GRN ─────────────────────────────────────────────────────────────────────

procurementRouter.get("/grns", async (_req, res) => {
  const grns = await prisma.goodsReceivedNote.findMany({
    include: { lines: true, purchaseOrder: { include: { supplier: true } }, qcResults: true },
    orderBy: { receivedAt: "desc" },
  });
  res.json({ success: true, grns });
});

procurementRouter.post("/grns", async (req, res) => {
  const schema = z.object({
    purchaseOrderId: z.string().min(1),
    weighbridgeTicketId: z.string().optional(),
    receivedBy: z.string().min(1),
    deliverySequence: z.number().int().positive().optional(),
    lines: z
      .array(
        z.object({
          purchaseOrderLineId: z.string().min(1),
          quantityAccepted: z.number().positive(),
          quantityRejected: z.number().nonnegative().optional(),
          unitPriceApplied: z.number().nonnegative(),
          lotNumber: z.string().optional(),
        })
      )
      .min(1),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  try {
    const grn = await receivingService.createGrnDraft(parse.data);
    res.status(201).json({ success: true, grn });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

procurementRouter.post("/grns/:id/post", async (req, res) => {
  const body = z.object({ postedBy: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "postedBy required" });
  try {
    const grn = await receivingService.postGrn(req.params.id, body.data.postedBy);
    res.json({ success: true, grn });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

// ─── Finance: 3-way match ─────────────────────────────────────────────────────

procurementRouter.get("/three-way-match", async (_req, res) => {
  const matches = await prisma.threeWayMatch.findMany({
    include: {
      grn: { include: { purchaseOrder: { include: { supplier: true } } } },
      supplierInvoice: true,
      paymentVouchers: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, matches });
});

procurementRouter.get("/three-way-match/:id", async (req, res) => {
  const match = await prisma.threeWayMatch.findUnique({
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
  if (!match) return res.status(404).json({ message: "Match not found" });
  res.json({ success: true, match });
});

/** Combined: register supplier invoice then immediately run 3-way match.
 *  Accepts the invoice fields plus grnId and matchedBy — single round-trip from the UI.
 */
procurementRouter.post("/three-way-match/register-and-match", async (req, res) => {
  const schema = z.object({
    // invoice fields
    invoiceNumber: z.string().min(1),
    invoiceDate: z.coerce.date(),
    dueDate: z.coerce.date().optional(),
    currency: z.enum(["KES", "USD", "EUR", "UGX", "TZS"]).optional(),
    subtotal: z.number().nonnegative(),
    taxAmount: z.number().nonnegative(),
    totalAmount: z.number().nonnegative(),
    fileUrl: z.string().url().optional(),
    // match fields
    grnId: z.string().min(1),
    matchedBy: z.string().min(1),
    tolerancePct: z.number().min(0).max(100).optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });

  try {
    // Resolve supplierId and purchaseOrderId from the GRN
    const grn = await prisma.goodsReceivedNote.findUnique({
      where: { id: parse.data.grnId },
      include: { purchaseOrder: { include: { supplier: true } } },
    });
    if (!grn) return res.status(404).json({ message: "GRN not found" });
    if (grn.status !== "POSTED") return res.status(400).json({ message: "GRN must be POSTED before running 3-way match" });

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
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

procurementRouter.post("/supplier-invoices", async (req, res) => {
  const schema = z.object({
    supplierId: z.string().min(1),
    purchaseOrderId: z.string().min(1),
    invoiceNumber: z.string().min(1),
    invoiceDate: z.coerce.date(),
    dueDate: z.coerce.date().optional(),
    currency: z.enum(["KES", "USD", "EUR", "UGX", "TZS"]).optional(),
    subtotal: z.number().nonnegative(),
    taxAmount: z.number().nonnegative(),
    totalAmount: z.number().nonnegative(),
    fileUrl: z.string().url().optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  const invoice = await financeService.registerSupplierInvoice(parse.data);
  res.status(201).json({ success: true, invoice });
});

procurementRouter.post("/three-way-match", async (req, res) => {
  const schema = z.object({
    grnId: z.string().min(1),
    supplierInvoiceId: z.string().min(1),
    matchedBy: z.string().min(1),
    tolerancePct: z.number().min(0).max(100).optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ errors: parse.error.flatten() });
  try {
    const match = await financeService.runThreeWayMatch(parse.data);
    res.status(201).json({ success: true, match });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

procurementRouter.post("/three-way-match/:id/approve-payment", async (req, res) => {
  const body = z.object({ approverName: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "approverName required" });
  const result = await financeService.approveMatchForPayment(
    req.params.id,
    body.data.approverName
  );
  res.json({ success: true, ...result });
});

procurementRouter.post("/payment-vouchers/:id/push-ap", async (req, res) => {
  const voucher = await financeService.pushToAccountsPayableQueue(req.params.id);
  res.json({ success: true, voucher });
});

// ─── Domain events (outbox poll) ─────────────────────────────────────────────

procurementRouter.get("/events/pending", async (_req, res) => {
  const events = await prisma.domainEvent.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  res.json({ success: true, events });
});
