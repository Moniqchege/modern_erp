import { Router, Response, NextFunction } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import {
  listPeriodsController,
  createPeriodController,
  listCategoriesController,
  createCategoryController,
  listAllocationsController,
  createAllocationController,
  listImprestsController,
  getImprestController,
  createImprestController,
  approveImprestController,
  rejectImprestController,
  disburseImprestController,
  submitSurrenderController,
  listSurrendersController,
  verifySurrenderController,
} from "../controllers/budget.controller";

const handle = (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
    (req: unknown, res: Response, next: NextFunction) =>
        fn(req as AuthenticatedRequest, res).catch(next);

export const budgetRouter = Router();

budgetRouter.use(requireAuth);

// Periods, Categories, and Allocations
budgetRouter.get("/periods", handle(listPeriodsController));
budgetRouter.post("/periods", handle(createPeriodController));

budgetRouter.get("/categories", handle(listCategoriesController));
budgetRouter.post("/categories", handle(createCategoryController));

budgetRouter.get("/allocations", handle(listAllocationsController));
budgetRouter.post("/allocations", handle(createAllocationController));

// Imprest Requests
budgetRouter.get("/imprests", handle(listImprestsController));
budgetRouter.get("/imprests/:id", handle(getImprestController));
budgetRouter.post("/imprests", handle(createImprestController));
budgetRouter.post("/imprests/:id/approve", handle(approveImprestController));
budgetRouter.post("/imprests/:id/reject", handle(rejectImprestController));
budgetRouter.post("/imprests/:id/disburse", handle(disburseImprestController));
budgetRouter.post("/imprests/:id/surrender", handle(submitSurrenderController));

// Imprest Surrenders
budgetRouter.get("/surrenders", handle(listSurrendersController));
budgetRouter.post("/surrenders/:id/verify", handle(verifySurrenderController));
