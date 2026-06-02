"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStore = registerStore;
exports.listStores = listStores;
exports.updateStore = updateStore;
exports.setStoreActiveStatus = setStoreActiveStatus;
exports.assignStoreManager = assignStoreManager;
exports.removeStoreManager = removeStoreManager;
exports.listManagerAssignments = listManagerAssignments;
exports.getStoreAuditLog = getStoreAuditLog;
const http_error_1 = require("../errors/http-error");
const http_error_2 = require("../errors/http-error");
const server_1 = require("../server");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function assertAdmin(auth) {
    if (auth.role !== "ADMIN" && auth.role !== "SUPERADMIN") {
        throw new http_error_2.HttpError(403, "Only administrators can perform this action", "FORBIDDEN");
    }
}
function formatStore(store) {
    return {
        id: store.id,
        code: store.code,
        name: store.name,
        description: store.description,
        address: store.address,
        isActive: store.isActive,
        isLegacy: store.isLegacy,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
    };
}
async function writeAuditLog(storeId, action, performedByUserId, snapshot) {
    await server_1.prisma.storeAuditLog.create({
        data: { action, storeId, performedByUserId, snapshot },
    });
}
// ─── Req 1: Register a Store ──────────────────────────────────────────────────
async function registerStore(auth, input) {
    assertAdmin(auth);
    const code = input.code.trim();
    const name = input.name.trim();
    if (!name || name.length > 255) {
        throw new http_error_1.BadRequestError("Store name must be between 1 and 255 characters");
    }
    if (!code || /\s/.test(code) || code.length > 64) {
        throw new http_error_1.BadRequestError("Store code must be 1–64 characters with no whitespace");
    }
    const existing = await server_1.prisma.inventoryLocation.findUnique({ where: { code } });
    if (existing) {
        throw new http_error_1.ConflictError(`Store code '${code}' is already in use`, "STORE_CODE_CONFLICT");
    }
    const store = await server_1.prisma.inventoryLocation.create({
        data: {
            code,
            name,
            description: input.description?.trim() || null,
            address: input.address?.trim() || null,
            isActive: true,
            isLegacy: false,
        },
    });
    await writeAuditLog(store.id, "STORE_CREATED", auth.userId, formatStore(store));
    return formatStore(store);
}
// ─── Req 2: List Stores ───────────────────────────────────────────────────────
async function listStores(auth) {
    const isAdmin = auth.role === "ADMIN" || auth.role === "SUPERADMIN";
    const stores = await server_1.prisma.inventoryLocation.findMany({
        where: isAdmin ? {} : { isActive: true },
        orderBy: { name: "asc" },
    });
    return stores.map(formatStore);
}
// ─── Req 3: Update Store ──────────────────────────────────────────────────────
async function updateStore(auth, storeId, input) {
    assertAdmin(auth);
    const store = await server_1.prisma.inventoryLocation.findUnique({ where: { id: storeId } });
    if (!store)
        throw new http_error_1.NotFoundError(`Store not found: ${storeId}`);
    if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name || name.length > 255) {
            throw new http_error_1.BadRequestError("Store name must be between 1 and 255 characters");
        }
    }
    if (input.description !== undefined && input.description.length > 1000) {
        throw new http_error_1.BadRequestError("Description must not exceed 1000 characters");
    }
    if (input.address !== undefined && input.address.length > 500) {
        throw new http_error_1.BadRequestError("Address must not exceed 500 characters");
    }
    const updateData = {};
    if (input.name !== undefined)
        updateData.name = input.name.trim();
    if (input.description !== undefined)
        updateData.description = input.description.trim() || null;
    if (input.address !== undefined)
        updateData.address = input.address.trim() || null;
    const updated = await server_1.prisma.inventoryLocation.update({
        where: { id: storeId },
        data: updateData,
    });
    await writeAuditLog(storeId, "STORE_UPDATED", auth.userId, {
        before: formatStore(store),
        after: formatStore(updated),
        changes: updateData,
    });
    return formatStore(updated);
}
// ─── Req 4: Activate / Deactivate ────────────────────────────────────────────
async function setStoreActiveStatus(auth, storeId, activate) {
    assertAdmin(auth);
    const store = await server_1.prisma.inventoryLocation.findUnique({ where: { id: storeId } });
    if (!store)
        throw new http_error_1.NotFoundError(`Store not found: ${storeId}`);
    if (!activate) {
        // Check for in-flight transfers
        const inFlightCount = await server_1.prisma.stockTransferRequest.count({
            where: {
                OR: [{ sourceLocationId: storeId }, { destinationLocationId: storeId }],
                status: { in: ["PENDING", "APPROVED_IN_TRANSIT"] },
            },
        });
        if (inFlightCount > 0) {
            throw new http_error_1.ConflictError(`Cannot deactivate store: ${inFlightCount} in-flight transfer(s) are still pending or in transit`, "IN_FLIGHT_TRANSFERS");
        }
    }
    const updated = await server_1.prisma.inventoryLocation.update({
        where: { id: storeId },
        data: { isActive: activate },
    });
    const action = activate ? "STORE_ACTIVATED" : "STORE_DEACTIVATED";
    await writeAuditLog(storeId, action, auth.userId, formatStore(updated));
    return formatStore(updated);
}
// ─── Req 5: Assign Manager ────────────────────────────────────────────────────
async function assignStoreManager(auth, input) {
    // Validate in order: admin → user exists → store exists → store active
    assertAdmin(auth);
    const user = await server_1.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user)
        throw new http_error_1.NotFoundError(`User not found: ${input.userId}`);
    const store = await server_1.prisma.inventoryLocation.findUnique({ where: { id: input.storeId } });
    if (!store)
        throw new http_error_1.NotFoundError(`Store not found: ${input.storeId}`);
    if (!store.isActive) {
        throw new http_error_1.ConflictError(`Cannot assign manager to inactive store '${store.name}'`, "STORE_INACTIVE");
    }
    // Upsert: replace any existing assignment for this user
    const assignment = await server_1.prisma.storeManagerAssignment.upsert({
        where: { userId: input.userId },
        update: { storeId: input.storeId, assignedAt: new Date() },
        create: {
            userId: input.userId,
            storeId: input.storeId,
            assignedAt: new Date(),
        },
        include: {
            user: { select: { id: true, name: true, email: true } },
            store: { select: { id: true, code: true, name: true } },
        },
    });
    await writeAuditLog(input.storeId, "MANAGER_ASSIGNED", auth.userId, {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        storeCode: store.code,
    });
    return {
        userId: assignment.userId,
        storeId: assignment.storeId,
        storeCode: assignment.store.code,
        storeName: assignment.store.name,
        userName: assignment.user.name,
        userEmail: assignment.user.email,
        assignedAt: assignment.assignedAt,
    };
}
// ─── Req 6: Remove Manager ────────────────────────────────────────────────────
async function removeStoreManager(auth, userId) {
    assertAdmin(auth);
    const assignment = await server_1.prisma.storeManagerAssignment.findUnique({
        where: { userId },
        include: {
            store: { select: { id: true, code: true } },
            user: { select: { name: true, email: true } },
        },
    });
    if (!assignment) {
        throw new http_error_1.NotFoundError(`No manager assignment found for user: ${userId}`);
    }
    await server_1.prisma.storeManagerAssignment.delete({ where: { userId } });
    await writeAuditLog(assignment.storeId, "MANAGER_REMOVED", auth.userId, {
        userId,
        userName: assignment.user.name,
        userEmail: assignment.user.email,
        storeCode: assignment.store.code,
    });
    return { success: true, message: "Manager assignment removed" };
}
// ─── Req 7: List Manager Assignments ─────────────────────────────────────────
async function listManagerAssignments(auth, storeId) {
    assertAdmin(auth);
    const assignments = await server_1.prisma.storeManagerAssignment.findMany({
        where: storeId ? { storeId } : {},
        include: {
            user: { select: { id: true, name: true, email: true, role: true } },
            store: { select: { id: true, code: true, name: true } },
        },
        orderBy: { assignedAt: "desc" },
    });
    return assignments.map((a) => ({
        userId: a.userId,
        storeId: a.storeId,
        storeCode: a.store.code,
        storeName: a.store.name,
        userName: a.user.name,
        userEmail: a.user.email,
        userRole: a.user.role,
        assignedAt: a.assignedAt,
    }));
}
// ─── Req 9: Audit Log ─────────────────────────────────────────────────────────
async function getStoreAuditLog(auth, storeId) {
    assertAdmin(auth);
    const store = await server_1.prisma.inventoryLocation.findUnique({ where: { id: storeId } });
    if (!store)
        throw new http_error_1.NotFoundError(`Store not found: ${storeId}`);
    const logs = await server_1.prisma.storeAuditLog.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
    });
    return logs;
}
