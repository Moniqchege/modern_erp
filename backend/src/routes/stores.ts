import { Router, Response, NextFunction } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import {
    activateStoreController,
    assignManagerController,
    deactivateStoreController,
    getAuditLogController,
    listAssignmentsController,
    listStoresController,
    registerStoreController,
    removeManagerController,
    updateStoreController,
} from "../controllers/store-onboarding.controller";

const handle = (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
    (req: unknown, res: Response, next: NextFunction) =>
        fn(req as AuthenticatedRequest, res).catch(next);

export const storesRouter = Router();

// All store management endpoints require authentication
storesRouter.use(requireAuth);

// ─── Store CRUD ───────────────────────────────────────────────────────────────

/** GET /api/stores — list all stores (admin sees all; others see active only) */
storesRouter.get("/", handle(listStoresController));

/** POST /api/stores — register a new store (admin only) */
storesRouter.post("/", handle(registerStoreController));

/** PATCH /api/stores/:id — update store metadata (admin only) */
storesRouter.patch("/:id", handle(updateStoreController));

/** POST /api/stores/:id/activate — set isActive = true (admin only) */
storesRouter.post("/:id/activate", handle(activateStoreController));

/** POST /api/stores/:id/deactivate — set isActive = false (admin only) */
storesRouter.post("/:id/deactivate", handle(deactivateStoreController));

// ─── Manager Assignments ──────────────────────────────────────────────────────

/** GET /api/stores/assignments — list all assignments, optional ?storeId= filter */
storesRouter.get("/assignments", handle(listAssignmentsController));

/** POST /api/stores/:id/assign-manager — assign a manager to a store */
storesRouter.post("/:id/assign-manager", handle(assignManagerController));

/** DELETE /api/stores/assignments/:userId — remove a manager's assignment */
storesRouter.delete("/assignments/:userId", handle(removeManagerController));

// ─── Audit Log ────────────────────────────────────────────────────────────────

/** GET /api/stores/:id/audit — get audit log for a store (admin only) */
storesRouter.get("/:id/audit", handle(getAuditLogController));
