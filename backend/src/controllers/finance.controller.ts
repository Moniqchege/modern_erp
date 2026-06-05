import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth";
import {
  listAccounts,
  createAccount,
  listJournalEntries,
  createJournalEntry,
  postJournalEntry,
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
} from "../services/finance.service";

// ─── Zod Validation Schemas ───────────────────────────────────────────────

const CreateAccountSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(255),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  description: z.string().max(1000).optional(),
});

const JournalLineSchema = z.object({
  accountId: z.string().min(1),
  debit: z.number().nonnegative(),
  credit: z.number().nonnegative(),
  description: z.string().max(255).optional(),
});

const CreateJournalEntrySchema = z.object({
  reference: z.string().max(128).optional(),
  description: z.string().min(1).max(1000),
  date: z.string().optional(),
  lines: z.array(JournalLineSchema).min(2),
});

// ─── Controller Handlers ───────────────────────────────────────────────────

export async function listAccountsController(req: AuthenticatedRequest, res: Response) {
  const accounts = await listAccounts();
  return res.json({ accounts });
}

export async function createAccountController(req: AuthenticatedRequest, res: Response) {
  const parse = CreateAccountSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
  }

  const account = await createAccount(parse.data);
  return res.status(201).json({ success: true, account });
}

export async function listJournalEntriesController(req: AuthenticatedRequest, res: Response) {
  const journals = await listJournalEntries();
  return res.json({ journals });
}

export async function createJournalEntryController(req: AuthenticatedRequest, res: Response) {
  const parse = CreateJournalEntrySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
  }

  const entry = await createJournalEntry(req.auth.userId, parse.data);
  return res.status(201).json({ success: true, entry });
}

export async function postJournalEntryController(req: AuthenticatedRequest, res: Response) {
  const entry = await postJournalEntry(req.params.id);
  return res.json({ success: true, entry });
}

export async function getTrialBalanceController(req: AuthenticatedRequest, res: Response) {
  const report = await getTrialBalance();
  return res.json(report);
}

export async function getIncomeStatementController(req: AuthenticatedRequest, res: Response) {
  const report = await getIncomeStatement();
  return res.json(report);
}

export async function getBalanceSheetController(req: AuthenticatedRequest, res: Response) {
  const report = await getBalanceSheet();
  return res.json(report);
}
