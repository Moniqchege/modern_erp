import { Router } from "express";
import { z } from "zod";
import { prisma } from "../server";
import * as requisitionService from "../services/procurement/requisition.service";
import * as poService from "../services/procurement/purchase-order.service";
import * as receivingService from "../services/procurement/receiving.service";
import * as financeService from "../services/procurement/finance-match.service";
import * as itemProfileSyncService from "../services/procurement/item-profile-sync.service";
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
