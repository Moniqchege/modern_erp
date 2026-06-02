"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storesRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const store_onboarding_controller_1 = require("../controllers/store-onboarding.controller");
const handle = (fn) => (req, res, next) => fn(req, res).catch(next);
exports.storesRouter = (0, express_1.Router)();
// All store management endpoints require authentication
exports.storesRouter.use(auth_1.requireAuth);
// ─── Store CRUD ───────────────────────────────────────────────────────────────
/** GET /api/stores — list all stores (admin sees all; others see active only) */
exports.storesRouter.get("/", handle(store_onboarding_controller_1.listStoresController));
/** POST /api/stores — register a new store (admin only) */
exports.storesRouter.post("/", handle(store_onboarding_controller_1.registerStoreController));
/** PATCH /api/stores/:id — update store metadata (admin only) */
exports.storesRouter.patch("/:id", handle(store_onboarding_controller_1.updateStoreController));
/** POST /api/stores/:id/activate — set isActive = true (admin only) */
exports.storesRouter.post("/:id/activate", handle(store_onboarding_controller_1.activateStoreController));
/** POST /api/stores/:id/deactivate — set isActive = false (admin only) */
exports.storesRouter.post("/:id/deactivate", handle(store_onboarding_controller_1.deactivateStoreController));
// ─── Manager Assignments ──────────────────────────────────────────────────────
/** GET /api/stores/assignments — list all assignments, optional ?storeId= filter */
exports.storesRouter.get("/assignments", handle(store_onboarding_controller_1.listAssignmentsController));
/** POST /api/stores/:id/assign-manager — assign a manager to a store */
exports.storesRouter.post("/:id/assign-manager", handle(store_onboarding_controller_1.assignManagerController));
/** DELETE /api/stores/assignments/:userId — remove a manager's assignment */
exports.storesRouter.delete("/assignments/:userId", handle(store_onboarding_controller_1.removeManagerController));
// ─── Audit Log ────────────────────────────────────────────────────────────────
/** GET /api/stores/:id/audit — get audit log for a store (admin only) */
exports.storesRouter.get("/:id/audit", handle(store_onboarding_controller_1.getAuditLogController));
