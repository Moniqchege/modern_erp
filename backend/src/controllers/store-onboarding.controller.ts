import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth";
import {
    assignStoreManager,
    getStoreAuditLog,
    listManagerAssignments,
    listStores,
    registerStore,
    removeStoreManager,
    setStoreActiveStatus,
    updateStore,
} from "../services/store-onboarding.service";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const RegisterStoreSchema = z.object({
    code: z.string().min(1).max(64).regex(/^\S+$/, "Store code must not contain whitespace"),
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    address: z.string().max(500).optional(),
});

const UpdateStoreSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    address: z.string().max(500).optional(),
});

const AssignManagerSchema = z.object({
    userId: z.string().min(1),
});

// ─── Controllers ──────────────────────────────────────────────────────────────

export async function registerStoreController(
    req: AuthenticatedRequest,
    res: Response
) {
    const parse = RegisterStoreSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const store = await registerStore(req.auth, parse.data);
    return res.status(201).json({ success: true, store });
}

export async function listStoresController(
    req: AuthenticatedRequest,
    res: Response
) {
    const stores = await listStores(req.auth);
    return res.json({ stores });
}

export async function updateStoreController(
    req: AuthenticatedRequest,
    res: Response
) {
    const parse = UpdateStoreSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const store = await updateStore(req.auth, req.params.id, parse.data);
    return res.json({ success: true, store });
}

export async function activateStoreController(
    req: AuthenticatedRequest,
    res: Response
) {
    const store = await setStoreActiveStatus(req.auth, req.params.id, true);
    return res.json({ success: true, store });
}

export async function deactivateStoreController(
    req: AuthenticatedRequest,
    res: Response
) {
    const store = await setStoreActiveStatus(req.auth, req.params.id, false);
    return res.json({ success: true, store });
}

export async function assignManagerController(
    req: AuthenticatedRequest,
    res: Response
) {
    const parse = AssignManagerSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parse.error.flatten() });
    }
    const assignment = await assignStoreManager(req.auth, {
        userId: parse.data.userId,
        storeId: req.params.id,
    });
    return res.status(201).json({ success: true, assignment });
}

export async function removeManagerController(
    req: AuthenticatedRequest,
    res: Response
) {
    const result = await removeStoreManager(req.auth, req.params.userId);
    return res.json(result);
}

export async function listAssignmentsController(
    req: AuthenticatedRequest,
    res: Response
) {
    const storeId = typeof req.query.storeId === "string" ? req.query.storeId : undefined;
    const assignments = await listManagerAssignments(req.auth, storeId);
    return res.json({ assignments });
}

export async function getAuditLogController(
    req: AuthenticatedRequest,
    res: Response
) {
    const logs = await getStoreAuditLog(req.auth, req.params.id);
    return res.json({ logs });
}
