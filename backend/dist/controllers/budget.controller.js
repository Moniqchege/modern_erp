"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPeriodsController = listPeriodsController;
exports.createPeriodController = createPeriodController;
exports.listCategoriesController = listCategoriesController;
exports.createCategoryController = createCategoryController;
exports.listAllocationsController = listAllocationsController;
exports.createAllocationController = createAllocationController;
exports.listImprestsController = listImprestsController;
exports.getImprestController = getImprestController;
exports.createImprestController = createImprestController;
exports.approveImprestController = approveImprestController;
exports.rejectImprestController = rejectImprestController;
exports.disburseImprestController = disburseImprestController;
exports.submitSurrenderController = submitSurrenderController;
exports.listSurrendersController = listSurrendersController;
exports.verifySurrenderController = verifySurrenderController;
const zod_1 = require("zod");
const budget_service_1 = require("../services/budget.service");
// ─── Zod Validation Schemas ───────────────────────────────────────────────
const CreatePeriodSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    startDate: zod_1.z.string(),
    endDate: zod_1.z.string(),
});
const CreateCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    code: zod_1.z.string().min(1).max(32),
    description: zod_1.z.string().max(1000).optional(),
});
const CreateAllocationSchema = zod_1.z.object({
    periodId: zod_1.z.string().min(1),
    categoryId: zod_1.z.string().min(1),
    department: zod_1.z.string().min(1).max(128),
    amount: zod_1.z.number().positive(),
});
const CreateImprestRequestSchema = zod_1.z.object({
    department: zod_1.z.string().min(1).max(128),
    budgetId: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive(),
    purpose: zod_1.z.string().min(1).max(1000),
});
const RejectImprestRequestSchema = zod_1.z.object({
    reason: zod_1.z.string().max(1000).optional(),
});
const DisburseImprestRequestSchema = zod_1.z.object({
    paymentMethod: zod_1.z.string().min(1).max(64),
    referenceNo: zod_1.z.string().max(128).optional(),
});
const SubmitSurrenderSchema = zod_1.z.object({
    actualSpent: zod_1.z.number().nonnegative(),
    receiptUrl: zod_1.z.string().max(500).optional(),
});
const VerifySurrenderSchema = zod_1.z.object({
    approve: zod_1.z.boolean(),
    reason: zod_1.z.string().max(1000).optional(),
});
// ─── Controller Handlers ───────────────────────────────────────────────────
async function listPeriodsController(req, res) {
    const periods = await (0, budget_service_1.listPeriods)();
    return res.json({ periods });
}
async function createPeriodController(req, res) {
    const parse = CreatePeriodSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const period = await (0, budget_service_1.createPeriod)(parse.data.name, new Date(parse.data.startDate), new Date(parse.data.endDate));
    return res.status(201).json({ success: true, period });
}
async function listCategoriesController(req, res) {
    const categories = await (0, budget_service_1.listCategories)();
    return res.json({ categories });
}
async function createCategoryController(req, res) {
    const parse = CreateCategorySchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const category = await (0, budget_service_1.createCategory)(parse.data.name, parse.data.code, parse.data.description);
    return res.status(201).json({ success: true, category });
}
async function listAllocationsController(req, res) {
    const periodId = typeof req.query.periodId === "string" ? req.query.periodId : undefined;
    const allocations = await (0, budget_service_1.listAllocations)(periodId);
    return res.json({ allocations });
}
async function createAllocationController(req, res) {
    const parse = CreateAllocationSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const allocation = await (0, budget_service_1.createAllocation)(parse.data.periodId, parse.data.categoryId, parse.data.department, parse.data.amount);
    return res.status(201).json({ success: true, allocation });
}
async function listImprestsController(req, res) {
    const requesterId = typeof req.query.requesterId === "string" ? req.query.requesterId : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const imprests = await (0, budget_service_1.listImprestRequests)(requesterId, status);
    return res.json({ imprests });
}
async function getImprestController(req, res) {
    const imprest = await (0, budget_service_1.getImprestRequest)(req.params.id);
    return res.json({ imprest });
}
async function createImprestController(req, res) {
    const parse = CreateImprestRequestSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const request = await (0, budget_service_1.createImprestRequest)(req.auth.userId, parse.data.department, parse.data.budgetId, parse.data.amount, parse.data.purpose);
    return res.status(201).json({ success: true, request });
}
async function approveImprestController(req, res) {
    const request = await (0, budget_service_1.approveImprestRequest)(req.auth.userId, req.params.id);
    return res.json({ success: true, request });
}
async function rejectImprestController(req, res) {
    const parse = RejectImprestRequestSchema.safeParse(req.body);
    const reason = parse.success ? parse.data.reason : undefined;
    const request = await (0, budget_service_1.rejectImprestRequest)(req.auth.userId, req.params.id, reason);
    return res.json({ success: true, request });
}
async function disburseImprestController(req, res) {
    const parse = DisburseImprestRequestSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const request = await (0, budget_service_1.disburseImprestRequest)(req.auth.userId, req.params.id, parse.data.paymentMethod, parse.data.referenceNo);
    return res.json({ success: true, request });
}
async function submitSurrenderController(req, res) {
    const parse = SubmitSurrenderSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const surrender = await (0, budget_service_1.submitImprestSurrender)(req.auth.userId, req.params.id, parse.data.actualSpent, parse.data.receiptUrl);
    return res.status(201).json({ success: true, surrender });
}
async function listSurrendersController(req, res) {
    const surrenders = await (0, budget_service_1.listSurrenders)();
    return res.json({ surrenders });
}
async function verifySurrenderController(req, res) {
    const parse = VerifySurrenderSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const surrender = await (0, budget_service_1.verifyImprestSurrender)(req.auth.userId, req.params.id, parse.data.approve, parse.data.reason);
    return res.json({ success: true, surrender });
}
