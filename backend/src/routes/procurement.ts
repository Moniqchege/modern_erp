import { Router } from "express";
import { z } from "zod";
import { prisma } from "../server";
import * as requisitionService from "../services/procurement/requisition.service";
import * as poService from "../services/procurement/purchase-order.service";
import * as receivingService from "../services/procurement/receiving.service";
import * as financeService from "../services/procurement/finance-match.service";

export const procurementRouter = Router();

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

// --- Item profiles ---
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
    packagingBagSize: z
      .enum(["KG_1", "KG_2", "KG_5", "KG_10", "KG_24", "KG_50"])
      .optional(),
    moistureMaxPct: z.number().optional(),
    aflatoxinMaxPpb: z.number().optional(),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ errors: parse.error.flatten() });
  }
  const profile = await prisma.procurementItemProfile.create({ data: parse.data as never });
  res.status(201).json({ success: true, profile });
});

// --- Requisitions ---
procurementRouter.get("/requisitions", async (req, res) => {
  const status = req.query.status as string | undefined;
  const requisitions = await prisma.purchaseRequisition.findMany({
    where: status ? { status: status as never } : undefined,
    include: { lines: { include: { itemProfile: true } }, supplier: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, requisitions });
});

procurementRouter.post("/requisitions", async (req, res) => {
  const parse = CreateRequisitionSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid body", errors: parse.error.flatten() });
  }
  try {
    const requisition = await requisitionService.createRequisition(parse.data);
    res.status(201).json({ success: true, requisition });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

procurementRouter.post("/requisitions/low-stock/generate", async (_req, res) => {
  const created = await requisitionService.generateLowStockRequisitions();
  res.json({ success: true, count: created.length, requisitions: created });
});

procurementRouter.post("/requisitions/:id/submit", async (req, res) => {
  const body = z.object({ approverName: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "approverName required" });
  try {
    const requisition = await requisitionService.submitRequisition(
      req.params.id,
      body.data.approverName
    );
    res.json({ success: true, requisition });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

procurementRouter.post("/requisitions/:id/approve", async (req, res) => {
  const body = z
    .object({
      level: z.enum(["HEAD_PROCUREMENT", "FINANCE_DIRECTOR"]),
      approverName: z.string().min(1),
      comments: z.string().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "Invalid approval body" });
  try {
    const requisition = await requisitionService.approveRequisition(
      req.params.id,
      body.data.level,
      body.data.approverName,
      body.data.comments
    );
    res.json({ success: true, requisition });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

// --- Purchase orders ---
procurementRouter.get("/purchase-orders", async (req, res) => {
  const orders = await prisma.purchaseOrder.findMany({
    where: req.query.status ? { status: req.query.status as never } : undefined,
    include: { supplier: true, lines: { include: { itemProfile: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, purchaseOrders: orders });
});

procurementRouter.post("/purchase-orders/from-requisition/:requisitionId", async (req, res) => {
  const body = z
    .object({ issuedBy: z.string().min(1), termsAndConditions: z.string().optional() })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "issuedBy required" });
  try {
    const po = await poService.createPurchaseOrderFromRequisition(
      req.params.requisitionId,
      body.data.issuedBy,
      body.data.termsAndConditions
    );
    res.status(201).json({ success: true, purchaseOrder: po });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

procurementRouter.post("/purchase-orders/:id/issue", async (req, res) => {
  const body = z.object({ issuedBy: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "issuedBy required" });
  try {
    const po = await poService.issuePurchaseOrder(req.params.id, body.data.issuedBy);
    res.json({ success: true, purchaseOrder: po });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

// --- Weighbridge ---
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
  if (!parse.success) {
    return res.status(400).json({ errors: parse.error.flatten() });
  }
  try {
    const ticket = await receivingService.recordWeighbridgeTicket(parse.data);
    res.status(201).json({ success: true, ticket });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

// --- QC ---
procurementRouter.post("/qc/maize", async (req, res) => {
  const parse = MaizeQCSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ errors: parse.error.flatten() });
  }
  const qc = await receivingService.submitProcurementQC(parse.data);
  res.status(201).json({ success: true, qc });
});

procurementRouter.post("/qc/packaging", async (req, res) => {
  const parse = PackagingQCSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ errors: parse.error.flatten() });
  }
  const qc = await receivingService.submitProcurementQC(parse.data);
  res.status(201).json({ success: true, qc });
});

// --- GRN ---
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
  if (!parse.success) {
    return res.status(400).json({ errors: parse.error.flatten() });
  }
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

// --- Finance: 3-way match ---
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
  if (!parse.success) {
    return res.status(400).json({ errors: parse.error.flatten() });
  }
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
  if (!parse.success) {
    return res.status(400).json({ errors: parse.error.flatten() });
  }
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

// --- Domain events (outbox poll) ---
procurementRouter.get("/events/pending", async (_req, res) => {
  const events = await prisma.domainEvent.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  res.json({ success: true, events });
});
