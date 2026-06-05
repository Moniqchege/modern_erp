"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.budgetRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const budget_controller_1 = require("../controllers/budget.controller");
const handle = (fn) => (req, res, next) => fn(req, res).catch(next);
exports.budgetRouter = (0, express_1.Router)();
exports.budgetRouter.use(auth_1.requireAuth);
// Periods, Categories, and Allocations
exports.budgetRouter.get("/periods", handle(budget_controller_1.listPeriodsController));
exports.budgetRouter.post("/periods", handle(budget_controller_1.createPeriodController));
exports.budgetRouter.get("/categories", handle(budget_controller_1.listCategoriesController));
exports.budgetRouter.post("/categories", handle(budget_controller_1.createCategoryController));
exports.budgetRouter.get("/allocations", handle(budget_controller_1.listAllocationsController));
exports.budgetRouter.post("/allocations", handle(budget_controller_1.createAllocationController));
// Imprest Requests
exports.budgetRouter.get("/imprests", handle(budget_controller_1.listImprestsController));
exports.budgetRouter.get("/imprests/:id", handle(budget_controller_1.getImprestController));
exports.budgetRouter.post("/imprests", handle(budget_controller_1.createImprestController));
exports.budgetRouter.post("/imprests/:id/approve", handle(budget_controller_1.approveImprestController));
exports.budgetRouter.post("/imprests/:id/reject", handle(budget_controller_1.rejectImprestController));
exports.budgetRouter.post("/imprests/:id/disburse", handle(budget_controller_1.disburseImprestController));
exports.budgetRouter.post("/imprests/:id/surrender", handle(budget_controller_1.submitSurrenderController));
// Imprest Surrenders
exports.budgetRouter.get("/surrenders", handle(budget_controller_1.listSurrendersController));
exports.budgetRouter.post("/surrenders/:id/verify", handle(budget_controller_1.verifySurrenderController));
