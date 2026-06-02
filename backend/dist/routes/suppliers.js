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
exports.suppliersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const server_1 = require("../server");
const supplierService = __importStar(require("../services/supplier.service"));
const supplier_crm_service_1 = require("../services/procurement/supplier-crm.service");
exports.suppliersRouter = (0, express_1.Router)();
const CreateSupplierSchema = zod_1.z.object({
    code: zod_1.z.string().min(1).max(32),
    name: zod_1.z.string().min(1).max(255),
    contactPerson: zod_1.z.string().max(255).optional().nullable(),
    phone: zod_1.z.string().max(32).optional().nullable(),
    email: zod_1.z.string().email().optional().nullable(),
    address: zod_1.z.string().max(2000).optional().nullable(),
    farmLocation: zod_1.z.string().max(500).optional().nullable(),
    certifications: zod_1.z.string().max(2000).optional().nullable(),
    businessRegistrationNo: zod_1.z.string().max(64).optional().nullable(),
    taxPin: zod_1.z.string().max(32).optional().nullable(),
    vatNumber: zod_1.z.string().max(32).optional().nullable(),
    bankName: zod_1.z.string().max(128).optional().nullable(),
    bankAccountNo: zod_1.z.string().max(64).optional().nullable(),
    bankBranch: zod_1.z.string().max(128).optional().nullable(),
    bankSwiftCode: zod_1.z.string().max(32).optional().nullable(),
    suppliedItems: zod_1.z
        .array(zod_1.z.object({
        itemProfileId: zod_1.z.string().min(1),
        isPreferred: zod_1.z.boolean().optional(),
        leadTimeDays: zod_1.z.number().int().positive().optional().nullable(),
        minOrderQty: zod_1.z.number().positive().optional().nullable(),
        lastUnitPrice: zod_1.z.number().nonnegative().optional().nullable(),
        notes: zod_1.z.string().max(500).optional().nullable(),
    }))
        .optional(),
});
exports.suppliersRouter.get("/", async (req, res) => {
    try {
        const activeOnly = req.query.activeOnly === "true";
        const suppliers = await supplierService.getAllSuppliers(activeOnly);
        res.status(200).json({ success: true, suppliers });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch suppliers", error: String(error) });
    }
});
exports.suppliersRouter.get("/:id", async (req, res) => {
    try {
        const supplier = await supplierService.getSupplierById(req.params.id);
        // Compliance document syncing removed
        res.status(200).json({ success: true, supplier, documents: [] });
    }
    catch (error) {
        res.status(404).json({ message: String(error) });
    }
});
exports.suppliersRouter.get("/:id/performance", async (req, res) => {
    try {
        const performance = await supplierService.getSupplierPerformance(req.params.id);
        res.status(200).json({ success: true, performance });
    }
    catch (error) {
        res.status(500).json({ message: String(error) });
    }
});
exports.suppliersRouter.post("/", async (req, res) => {
    const parse = CreateSupplierSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid body", errors: parse.error.flatten() });
    }
    try {
        const { suppliedItems = [], ...supplierData } = parse.data;
        const supplier = await server_1.prisma.supplier.create({
            data: {
                ...supplierData,
                suppliedItems: {
                    create: suppliedItems.map((item) => ({
                        itemProfileId: item.itemProfileId,
                        isPreferred: item.isPreferred ?? false,
                        leadTimeDays: item.leadTimeDays ?? null,
                        minOrderQty: item.minOrderQty ?? null,
                        lastUnitPrice: item.lastUnitPrice ?? null,
                        notes: item.notes ?? null,
                    })),
                },
            },
            include: {
                suppliedItems: {
                    include: { itemProfile: true },
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        res.status(201).json({ success: true, supplier });
    }
    catch (error) {
        res.status(500).json({ message: String(error) });
    }
});
exports.suppliersRouter.patch("/:id", async (req, res) => {
    const parse = CreateSupplierSchema.partial().safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid body", errors: parse.error.flatten() });
    }
    try {
        const supplier = await supplierService.updateSupplier(req.params.id, parse.data);
        res.status(200).json({ success: true, supplier });
    }
    catch (error) {
        res.status(500).json({ message: String(error) });
    }
});
// Document uploads removed (supplier no longer needs compliance documents)
// suppliersRouter.post("/:id/documents", async (req, res) => {
//   const parse = ComplianceDocSchema.safeParse(req.body);
//   if (!parse.success) {
//     return res.status(400).json({ message: "Invalid body", errors: parse.error.flatten() });
//   }
//   try {
//     const doc = await addComplianceDocument(req.params.id, parse.data);
//     res.status(201).json({ success: true, document: doc });
//   } catch (error) {
//     res.status(500).json({ message: String(error) });
//   }
// });
// (intentionally left out) Compliance document upload endpoints removed
//   const parse = ComplianceDocBatchSchema.safeParse(req.body);
//   if (!parse.success) {
//     return res
//       .status(400)
//       .json({ message: "Invalid body", errors: parse.error.flatten() });
//   }
//
//   try {
//     const supplierId = req.params.id;
//
//     const docs = await Promise.all(
//       parse.data.documents.map((d) => addComplianceDocument(supplierId, d))
//     );
//
//     res.status(201).json({ success: true, documents: docs });
//   } catch (error) {
//     res.status(500).json({ message: String(error) });
//   }
// });
exports.suppliersRouter.post("/:id/onboarding/approve", async (req, res) => {
    const body = zod_1.z
        .object({ actorName: zod_1.z.string().min(1), notes: zod_1.z.string().optional() })
        .safeParse(req.body);
    if (!body.success) {
        return res.status(400).json({ message: "actorName required" });
    }
    try {
        const supplier = await (0, supplier_crm_service_1.approveSupplierOnboarding)(req.params.id, body.data.actorName, body.data.notes);
        res.status(200).json({ success: true, supplier });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
exports.suppliersRouter.post("/:id/onboarding/reject", async (req, res) => {
    const body = zod_1.z
        .object({ actorName: zod_1.z.string().min(1), notes: zod_1.z.string().optional() })
        .safeParse(req.body);
    if (!body.success) {
        return res.status(400).json({ message: "actorName required" });
    }
    try {
        const supplier = await (0, supplier_crm_service_1.rejectSupplierOnboarding)(req.params.id, body.data.actorName, body.data.notes);
        res.status(200).json({ success: true, supplier });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
exports.suppliersRouter.post("/:id/onboarding/lock", async (req, res) => {
    const body = zod_1.z
        .object({ actorName: zod_1.z.string().min(1), notes: zod_1.z.string().optional() })
        .safeParse(req.body);
    if (!body.success) {
        return res.status(400).json({ message: "actorName required" });
    }
    try {
        const supplier = await (0, supplier_crm_service_1.lockSupplier)(req.params.id, body.data.actorName, body.data.notes);
        res.status(200).json({ success: true, supplier });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
exports.suppliersRouter.post("/:id/onboarding/unlock", async (req, res) => {
    const body = zod_1.z
        .object({ actorName: zod_1.z.string().min(1), notes: zod_1.z.string().optional() })
        .safeParse(req.body);
    if (!body.success) {
        return res.status(400).json({ message: "actorName required" });
    }
    try {
        const supplier = await (0, supplier_crm_service_1.unlockSupplier)(req.params.id, body.data.actorName, body.data.notes);
        res.status(200).json({ success: true, supplier });
    }
    catch (error) {
        res.status(400).json({ message: String(error) });
    }
});
