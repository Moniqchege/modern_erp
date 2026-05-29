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
exports.procurementRouter = (0, express_1.Router)();
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
// --- Item profiles ---
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
        packagingBagSize: zod_1.z
            .enum(["KG_1", "KG_2", "KG_5", "KG_10", "KG_24", "KG_50"])
            .optional(),
        moistureMaxPct: zod_1.z.number().optional(),
        aflatoxinMaxPpb: zod_1.z.number().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ errors: parse.error.flatten() });
    }
    const profile = await server_1.prisma.procurementItemProfile.create({ data: parse.data });
    res.status(201).json({ success: true, profile });
});
exports.procurementRouter.post("/item-profiles/sync-from-inventory", async (_req, res) => {
    const result = await itemProfileSyncService.syncItemProfilesFromInventory();
    res.json({ success: true, ...result });
});
// --- Requisitions ---
exports.procurementRouter.get("/requisitions", async (req, res) => {
    const status = req.query.status;
    const requisitions = await server_1.prisma.purchaseRequisition.findMany({
        where: status ? { status: status } : undefined,
        include: { lines: { include: { itemProfile: true } }, supplier: true },
        orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, requisitions });
});
exports.procurementRouter.post("/requisitions", async (req, res) => {
    const parse = CreateRequisitionSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid body", errors: parse.error.flatten() });
    }
    try {
        const requisition = await requisitionService.createRequisition(parse.data);
        res.status(201).json({ success: true, requisition });
    }
    catch (error) {
        res.status(500).json({ message: String(error) });
    }
});
exports.procurementRouter.post("/requisitions/low-stock/generate", async (_req, res) => {
    const created = await requisitionService.generateLowStockRequisitions();
    res.json({ success: true, count: created.length, requisitions: created });
});
exports.procurementRouter.post("/requisitions/:id/submit", async (req, res) => {
    const body = zod_1.z.object({ approverName: zod_1.z.string().min(1) }).safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ message: "approverName required" });
    try {
        const requisition = await requisitionService.submitRequisition(req.params.id, body.data.approverName);
        res.json({ success: true, requisition });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
exports.procurementRouter.post("/requisitions/:id/approve", async (req, res) => {
    const body = zod_1.z
        .object({
        level: zod_1.z.enum(["HEAD_PROCUREMENT", "FINANCE_DIRECTOR"]),
        approverName: zod_1.z.string().min(1),
        comments: zod_1.z.string().optional(),
    })
        .safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ message: "Invalid approval body" });
    try {
        const requisition = await requisitionService.approveRequisition(req.params.id, body.data.level, body.data.approverName, body.data.comments);
        res.json({ success: true, requisition });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
// --- Purchase orders ---
exports.procurementRouter.get("/purchase-orders", async (req, res) => {
    const orders = await server_1.prisma.purchaseOrder.findMany({
        where: req.query.status ? { status: req.query.status } : undefined,
        include: { supplier: true, lines: { include: { itemProfile: true } } },
        orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, purchaseOrders: orders });
});
exports.procurementRouter.post("/purchase-orders/from-requisition/:requisitionId", async (req, res) => {
    const body = zod_1.z
        .object({ issuedBy: zod_1.z.string().min(1), termsAndConditions: zod_1.z.string().optional() })
        .safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ message: "issuedBy required" });
    try {
        const po = await poService.createPurchaseOrderFromRequisition(req.params.requisitionId, body.data.issuedBy, body.data.termsAndConditions);
        res.status(201).json({ success: true, purchaseOrder: po });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
exports.procurementRouter.post("/purchase-orders/:id/issue", async (req, res) => {
    const body = zod_1.z.object({ issuedBy: zod_1.z.string().min(1) }).safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ message: "issuedBy required" });
    try {
        const po = await poService.issuePurchaseOrder(req.params.id, body.data.issuedBy);
        res.json({ success: true, purchaseOrder: po });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
// --- Weighbridge ---
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
    if (!parse.success) {
        return res.status(400).json({ errors: parse.error.flatten() });
    }
    try {
        const ticket = await receivingService.recordWeighbridgeTicket(parse.data);
        res.status(201).json({ success: true, ticket });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
// --- QC ---
exports.procurementRouter.post("/qc/maize", async (req, res) => {
    const parse = MaizeQCSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ errors: parse.error.flatten() });
    }
    const qc = await receivingService.submitProcurementQC(parse.data);
    res.status(201).json({ success: true, qc });
});
exports.procurementRouter.post("/qc/packaging", async (req, res) => {
    const parse = PackagingQCSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ errors: parse.error.flatten() });
    }
    const qc = await receivingService.submitProcurementQC(parse.data);
    res.status(201).json({ success: true, qc });
});
// --- GRN ---
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
    if (!parse.success) {
        return res.status(400).json({ errors: parse.error.flatten() });
    }
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
// --- Finance: 3-way match ---
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
    if (!parse.success) {
        return res.status(400).json({ errors: parse.error.flatten() });
    }
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
    if (!parse.success) {
        return res.status(400).json({ errors: parse.error.flatten() });
    }
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
// --- Domain events (outbox poll) ---
exports.procurementRouter.get("/events/pending", async (_req, res) => {
    const events = await server_1.prisma.domainEvent.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 100,
    });
    res.json({ success: true, events });
});
