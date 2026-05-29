import { Router } from "express";
import { z } from "zod";
import { prisma } from "../server";
import * as supplierService from "../services/supplier.service";
import {
  approveSupplierOnboarding,
  rejectSupplierOnboarding,
  lockSupplier,
  unlockSupplier,
} from "../services/procurement/supplier-crm.service";


export const suppliersRouter = Router();

const CreateSupplierSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(255),
  contactPerson: z.string().max(255).optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(2000).optional().nullable(),
  farmLocation: z.string().max(500).optional().nullable(),
  certifications: z.string().max(2000).optional().nullable(),
  businessRegistrationNo: z.string().max(64).optional().nullable(),
  taxPin: z.string().max(32).optional().nullable(),
  vatNumber: z.string().max(32).optional().nullable(),
  bankName: z.string().max(128).optional().nullable(),
  bankAccountNo: z.string().max(64).optional().nullable(),
  bankBranch: z.string().max(128).optional().nullable(),
  bankSwiftCode: z.string().max(32).optional().nullable(),
  suppliedItems: z
    .array(
      z.object({
        itemProfileId: z.string().min(1),
        isPreferred: z.boolean().optional(),
        leadTimeDays: z.number().int().positive().optional().nullable(),
        minOrderQty: z.number().positive().optional().nullable(),
        lastUnitPrice: z.number().nonnegative().optional().nullable(),
        notes: z.string().max(500).optional().nullable(),
      })
    )
    .optional(),
});



suppliersRouter.get("/", async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === "true";
    const suppliers = await supplierService.getAllSuppliers(activeOnly);
    res.status(200).json({ success: true, suppliers });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch suppliers", error: String(error) });
  }
});

suppliersRouter.get("/:id", async (req, res) => {
  try {
    const supplier = await supplierService.getSupplierById(req.params.id);
    // Compliance document syncing removed
    res.status(200).json({ success: true, supplier, documents: [] });

  } catch (error) {
    res.status(404).json({ message: String(error) });
  }
});

suppliersRouter.get("/:id/performance", async (req, res) => {
  try {
    const performance = await supplierService.getSupplierPerformance(req.params.id);
    res.status(200).json({ success: true, performance });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

suppliersRouter.post("/", async (req, res) => {
  const parse = CreateSupplierSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid body", errors: parse.error.flatten() });
  }
  try {
    const { suppliedItems = [], ...supplierData } = parse.data;
    const supplier = await prisma.supplier.create({
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
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

suppliersRouter.patch("/:id", async (req, res) => {
  const parse = CreateSupplierSchema.partial().safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid body", errors: parse.error.flatten() });
  }
  try {
    const supplier = await supplierService.updateSupplier(req.params.id, parse.data as any);
    res.status(200).json({ success: true, supplier });
  } catch (error) {
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




suppliersRouter.post("/:id/onboarding/approve", async (req, res) => {
  const body = z
    .object({ actorName: z.string().min(1), notes: z.string().optional() })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ message: "actorName required" });
  }
  try {
    const supplier = await approveSupplierOnboarding(
      req.params.id,
      body.data.actorName,
      body.data.notes
    );
    res.status(200).json({ success: true, supplier });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

suppliersRouter.post("/:id/onboarding/reject", async (req, res) => {
  const body = z
    .object({ actorName: z.string().min(1), notes: z.string().optional() })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ message: "actorName required" });
  }
  try {
    const supplier = await rejectSupplierOnboarding(
      req.params.id,
      body.data.actorName,
      body.data.notes
    );
    res.status(200).json({ success: true, supplier });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});


suppliersRouter.post("/:id/onboarding/lock", async (req, res) => {
  const body = z
    .object({ actorName: z.string().min(1), notes: z.string().optional() })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ message: "actorName required" });
  }
  try {
    const supplier = await lockSupplier(
      req.params.id,
      body.data.actorName,
      body.data.notes
    );
    res.status(200).json({ success: true, supplier });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});

suppliersRouter.post("/:id/onboarding/unlock", async (req, res) => {
  const body = z
    .object({ actorName: z.string().min(1), notes: z.string().optional() })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ message: "actorName required" });
  }
  try {
    const supplier = await unlockSupplier(
      req.params.id,
      body.data.actorName,
      body.data.notes
    );
    res.status(200).json({ success: true, supplier });
  } catch (error) {
    res.status(400).json({ message: String(error) });
  }
});
