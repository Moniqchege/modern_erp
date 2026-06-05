"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStoreController = registerStoreController;
exports.listStoresController = listStoresController;
exports.updateStoreController = updateStoreController;
exports.activateStoreController = activateStoreController;
exports.deactivateStoreController = deactivateStoreController;
exports.assignManagerController = assignManagerController;
exports.removeManagerController = removeManagerController;
exports.listAssignmentsController = listAssignmentsController;
exports.getAuditLogController = getAuditLogController;
const zod_1 = require("zod");
const store_onboarding_service_1 = require("../services/store-onboarding.service");
// ─── Schemas ──────────────────────────────────────────────────────────────────
const RegisterStoreSchema = zod_1.z.object({
    code: zod_1.z.string().min(1).max(64).regex(/^\S+$/, "Store code must not contain whitespace"),
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).optional(),
    address: zod_1.z.string().max(500).optional(),
});
const UpdateStoreSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().max(1000).optional(),
    address: zod_1.z.string().max(500).optional(),
});
const AssignManagerSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1),
});
// ─── Controllers ──────────────────────────────────────────────────────────────
async function registerStoreController(req, res) {
    const parse = RegisterStoreSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const store = await (0, store_onboarding_service_1.registerStore)(req.auth, parse.data);
    return res.status(201).json({ success: true, store });
}
async function listStoresController(req, res) {
    const stores = await (0, store_onboarding_service_1.listStores)(req.auth);
    return res.json({ stores });
}
async function updateStoreController(req, res) {
    const parse = UpdateStoreSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const store = await (0, store_onboarding_service_1.updateStore)(req.auth, req.params.id, parse.data);
    return res.json({ success: true, store });
}
async function activateStoreController(req, res) {
    const store = await (0, store_onboarding_service_1.setStoreActiveStatus)(req.auth, req.params.id, true);
    return res.json({ success: true, store });
}
async function deactivateStoreController(req, res) {
    const store = await (0, store_onboarding_service_1.setStoreActiveStatus)(req.auth, req.params.id, false);
    return res.json({ success: true, store });
}
async function assignManagerController(req, res) {
    const parse = AssignManagerSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const assignment = await (0, store_onboarding_service_1.assignStoreManager)(req.auth, {
        userId: parse.data.userId,
        storeId: req.params.id,
    });
    return res.status(201).json({ success: true, assignment });
}
async function removeManagerController(req, res) {
    const result = await (0, store_onboarding_service_1.removeStoreManager)(req.auth, req.params.userId);
    return res.json(result);
}
async function listAssignmentsController(req, res) {
    const storeId = typeof req.query.storeId === "string" ? req.query.storeId : undefined;
    const assignments = await (0, store_onboarding_service_1.listManagerAssignments)(req.auth, storeId);
    return res.json({ assignments });
}
async function getAuditLogController(req, res) {
    const logs = await (0, store_onboarding_service_1.getStoreAuditLog)(req.auth, req.params.id);
    return res.json({ logs });
}
