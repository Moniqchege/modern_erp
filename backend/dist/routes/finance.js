"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financeRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const finance_controller_1 = require("../controllers/finance.controller");
const handle = (fn) => (req, res, next) => fn(req, res).catch(next);
exports.financeRouter = (0, express_1.Router)();
exports.financeRouter.use(auth_1.requireAuth);
// Chart of Accounts
exports.financeRouter.get("/accounts", handle(finance_controller_1.listAccountsController));
exports.financeRouter.post("/accounts", handle(finance_controller_1.createAccountController));
// Journal Entries
exports.financeRouter.get("/journals", handle(finance_controller_1.listJournalEntriesController));
exports.financeRouter.post("/journals", handle(finance_controller_1.createJournalEntryController));
exports.financeRouter.post("/journals/:id/post", handle(finance_controller_1.postJournalEntryController));
// Reports
exports.financeRouter.get("/reports/trial-balance", handle(finance_controller_1.getTrialBalanceController));
exports.financeRouter.get("/reports/income-statement", handle(finance_controller_1.getIncomeStatementController));
exports.financeRouter.get("/reports/balance-sheet", handle(finance_controller_1.getBalanceSheetController));
