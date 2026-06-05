import { Router, Response, NextFunction } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import {
  listAccountsController,
  createAccountController,
  listJournalEntriesController,
  createJournalEntryController,
  postJournalEntryController,
  getTrialBalanceController,
  getIncomeStatementController,
  getBalanceSheetController,
} from "../controllers/finance.controller";

const handle = (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
    (req: unknown, res: Response, next: NextFunction) =>
        fn(req as AuthenticatedRequest, res).catch(next);

export const financeRouter = Router();

financeRouter.use(requireAuth);

// Chart of Accounts
financeRouter.get("/accounts", handle(listAccountsController));
financeRouter.post("/accounts", handle(createAccountController));

// Journal Entries
financeRouter.get("/journals", handle(listJournalEntriesController));
financeRouter.post("/journals", handle(createJournalEntryController));
financeRouter.post("/journals/:id/post", handle(postJournalEntryController));

// Reports
financeRouter.get("/reports/trial-balance", handle(getTrialBalanceController));
financeRouter.get("/reports/income-statement", handle(getIncomeStatementController));
financeRouter.get("/reports/balance-sheet", handle(getBalanceSheetController));
