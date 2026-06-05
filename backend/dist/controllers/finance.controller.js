"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAccountsController = listAccountsController;
exports.createAccountController = createAccountController;
exports.listJournalEntriesController = listJournalEntriesController;
exports.createJournalEntryController = createJournalEntryController;
exports.postJournalEntryController = postJournalEntryController;
exports.getTrialBalanceController = getTrialBalanceController;
exports.getIncomeStatementController = getIncomeStatementController;
exports.getBalanceSheetController = getBalanceSheetController;
const zod_1 = require("zod");
const finance_service_1 = require("../services/finance.service");
// ─── Zod Validation Schemas ───────────────────────────────────────────────
const CreateAccountSchema = zod_1.z.object({
    code: zod_1.z.string().min(1).max(32),
    name: zod_1.z.string().min(1).max(255),
    type: zod_1.z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
    description: zod_1.z.string().max(1000).optional(),
});
const JournalLineSchema = zod_1.z.object({
    accountId: zod_1.z.string().min(1),
    debit: zod_1.z.number().nonnegative(),
    credit: zod_1.z.number().nonnegative(),
    description: zod_1.z.string().max(255).optional(),
});
const CreateJournalEntrySchema = zod_1.z.object({
    reference: zod_1.z.string().max(128).optional(),
    description: zod_1.z.string().min(1).max(1000),
    date: zod_1.z.string().optional(),
    lines: zod_1.z.array(JournalLineSchema).min(2),
});
// ─── Controller Handlers ───────────────────────────────────────────────────
async function listAccountsController(req, res) {
    const accounts = await (0, finance_service_1.listAccounts)();
    return res.json({ accounts });
}
async function createAccountController(req, res) {
    const parse = CreateAccountSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const account = await (0, finance_service_1.createAccount)(parse.data);
    return res.status(201).json({ success: true, account });
}
async function listJournalEntriesController(req, res) {
    const journals = await (0, finance_service_1.listJournalEntries)();
    return res.json({ journals });
}
async function createJournalEntryController(req, res) {
    const parse = CreateJournalEntrySchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const entry = await (0, finance_service_1.createJournalEntry)(req.auth.userId, parse.data);
    return res.status(201).json({ success: true, entry });
}
async function postJournalEntryController(req, res) {
    const entry = await (0, finance_service_1.postJournalEntry)(req.params.id);
    return res.json({ success: true, entry });
}
async function getTrialBalanceController(req, res) {
    const report = await (0, finance_service_1.getTrialBalance)();
    return res.json(report);
}
async function getIncomeStatementController(req, res) {
    const report = await (0, finance_service_1.getIncomeStatement)();
    return res.json(report);
}
async function getBalanceSheetController(req, res) {
    const report = await (0, finance_service_1.getBalanceSheet)();
    return res.json(report);
}
