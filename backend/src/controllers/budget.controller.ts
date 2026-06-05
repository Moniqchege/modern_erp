import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth";
import {
  listPeriods,
  createPeriod,
  listCategories,
  createCategory,
  listAllocations,
  createAllocation,
  listImprestRequests,
  getImprestRequest,
  createImprestRequest,
  approveImprestRequest,
  rejectImprestRequest,
  disburseImprestRequest,
  submitImprestSurrender,
  listSurrenders,
  verifyImprestSurrender,
} from "../services/budget.service";
import { ImprestStatus } from "@prisma/client";

// ─── Zod Validation Schemas ───────────────────────────────────────────────

const CreatePeriodSchema = z.object({
  name: z.string().min(1).max(255),
  startDate: z.string(),
  endDate: z.string(),
});

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(32),
  description: z.string().max(1000).optional(),
});

const CreateAllocationSchema = z.object({
  periodId: z.string().min(1),
  categoryId: z.string().min(1),
  department: z.string().min(1).max(128),
  amount: z.number().positive(),
});

const CreateImprestRequestSchema = z.object({
  department: z.string().min(1).max(128),
  budgetId: z.string().min(1),
  amount: z.number().positive(),
  purpose: z.string().min(1).max(1000),
});

const RejectImprestRequestSchema = z.object({
  reason: z.string().max(1000).optional(),
});

const DisburseImprestRequestSchema = z.object({
  paymentMethod: z.string().min(1).max(64),
  referenceNo: z.string().max(128).optional(),
});

const SubmitSurrenderSchema = z.object({
  actualSpent: z.number().nonnegative(),
  receiptUrl: z.string().max(500).optional(),
});

const VerifySurrenderSchema = z.object({
  approve: z.boolean(),
  reason: z.string().max(1000).optional(),
});

// ─── Controller Handlers ───────────────────────────────────────────────────

export async function listPeriodsController(req: AuthenticatedRequest, res: Response) {
  const periods = await listPeriods();
  return res.json({ periods });
}

export async function createPeriodController(req: AuthenticatedRequest, res: Response) {
  const parse = CreatePeriodSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
  }

  const period = await createPeriod(
    parse.data.name,
    new Date(parse.data.startDate),
    new Date(parse.data.endDate)
  );
  return res.status(201).json({ success: true, period });
}

export async function listCategoriesController(req: AuthenticatedRequest, res: Response) {
  const categories = await listCategories();
  return res.json({ categories });
}

export async function createCategoryController(req: AuthenticatedRequest, res: Response) {
  const parse = CreateCategorySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
  }

  const category = await createCategory(parse.data.name, parse.data.code, parse.data.description);
  return res.status(201).json({ success: true, category });
}

export async function listAllocationsController(req: AuthenticatedRequest, res: Response) {
  const periodId = typeof req.query.periodId === "string" ? req.query.periodId : undefined;
  const allocations = await listAllocations(periodId);
  return res.json({ allocations });
}

export async function createAllocationController(req: AuthenticatedRequest, res: Response) {
  const parse = CreateAllocationSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
  }

  const allocation = await createAllocation(
    parse.data.periodId,
    parse.data.categoryId,
    parse.data.department,
    parse.data.amount
  );
  return res.status(201).json({ success: true, allocation });
}

export async function listImprestsController(req: AuthenticatedRequest, res: Response) {
  const requesterId = typeof req.query.requesterId === "string" ? req.query.requesterId : undefined;
  const status = typeof req.query.status === "string" ? (req.query.status as ImprestStatus) : undefined;

  const imprests = await listImprestRequests(requesterId, status);
  return res.json({ imprests });
}

export async function getImprestController(req: AuthenticatedRequest, res: Response) {
  const imprest = await getImprestRequest(req.params.id);
  return res.json({ imprest });
}

export async function createImprestController(req: AuthenticatedRequest, res: Response) {
  const parse = CreateImprestRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
  }

  const request = await createImprestRequest(
    req.auth.userId,
    parse.data.department,
    parse.data.budgetId,
    parse.data.amount,
    parse.data.purpose
  );
  return res.status(201).json({ success: true, request });
}

export async function approveImprestController(req: AuthenticatedRequest, res: Response) {
  const request = await approveImprestRequest(req.auth.userId, req.params.id);
  return res.json({ success: true, request });
}

export async function rejectImprestController(req: AuthenticatedRequest, res: Response) {
  const parse = RejectImprestRequestSchema.safeParse(req.body);
  const reason = parse.success ? parse.data.reason : undefined;

  const request = await rejectImprestRequest(req.auth.userId, req.params.id, reason);
  return res.json({ success: true, request });
}

export async function disburseImprestController(req: AuthenticatedRequest, res: Response) {
  const parse = DisburseImprestRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
  }

  const request = await disburseImprestRequest(
    req.auth.userId,
    req.params.id,
    parse.data.paymentMethod,
    parse.data.referenceNo
  );
  return res.json({ success: true, request });
}

export async function submitSurrenderController(req: AuthenticatedRequest, res: Response) {
  const parse = SubmitSurrenderSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
  }

  const surrender = await submitImprestSurrender(
    req.auth.userId,
    req.params.id,
    parse.data.actualSpent,
    parse.data.receiptUrl
  );
  return res.status(201).json({ success: true, surrender });
}

export async function listSurrendersController(req: AuthenticatedRequest, res: Response) {
  const surrenders = await listSurrenders();
  return res.json({ surrenders });
}

export async function verifySurrenderController(req: AuthenticatedRequest, res: Response) {
  const parse = VerifySurrenderSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
  }

  const surrender = await verifyImprestSurrender(
    req.auth.userId,
    req.params.id,
    parse.data.approve,
    parse.data.reason
  );
  return res.json({ success: true, surrender });
}
