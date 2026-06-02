import { StoreAuditAction } from "@prisma/client";
import type { AccessTokenPayload } from "../auth/jwt";
import { BadRequestError, ConflictError, NotFoundError } from "../errors/http-error";
import { HttpError } from "../errors/http-error";
import { prisma } from "../server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateStoreInput {
    code: string;
    name: string;
    description?: string;
    address?: string;
}

export interface UpdateStoreInput {
    name?: string;
    description?: string;
    address?: string;
}

export interface AssignManagerInput {
    userId: string;
    storeId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertAdmin(auth: AccessTokenPayload) {
    if (auth.role !== "ADMIN" && auth.role !== "SUPERADMIN") {
        throw new HttpError(403, "Only administrators can perform this action", "FORBIDDEN");
    }
}

function formatStore(store: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    address: string | null;
    isActive: boolean;
    isLegacy: boolean;
    createdAt: Date;
    updatedAt: Date;
}) {
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

async function writeAuditLog(
    storeId: string,
    action: StoreAuditAction,
    performedByUserId: string,
    snapshot: object
) {
    await prisma.storeAuditLog.create({
        data: { action, storeId, performedByUserId, snapshot },
    });
}

// ─── Req 1: Register a Store ──────────────────────────────────────────────────

export async function registerStore(
    auth: AccessTokenPayload,
    input: CreateStoreInput
) {
    assertAdmin(auth);

    const code = input.code.trim();
    const name = input.name.trim();

    if (!name || name.length > 255) {
        throw new BadRequestError("Store name must be between 1 and 255 characters");
    }
    if (!code || /\s/.test(code) || code.length > 64) {
        throw new BadRequestError(
            "Store code must be 1–64 characters with no whitespace"
        );
    }

    const existing = await prisma.inventoryLocation.findUnique({ where: { code } });
    if (existing) {
        throw new ConflictError(
            `Store code '${code}' is already in use`,
            "STORE_CODE_CONFLICT"
        );
    }

    const store = await prisma.inventoryLocation.create({
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

export async function listStores(auth: AccessTokenPayload) {
    const isAdmin = auth.role === "ADMIN" || auth.role === "SUPERADMIN";

    const stores = await prisma.inventoryLocation.findMany({
        where: isAdmin ? {} : { isActive: true },
        orderBy: { name: "asc" },
    });

    return stores.map(formatStore);
}

// ─── Req 3: Update Store ──────────────────────────────────────────────────────

export async function updateStore(
    auth: AccessTokenPayload,
    storeId: string,
    input: UpdateStoreInput
) {
    assertAdmin(auth);

    const store = await prisma.inventoryLocation.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundError(`Store not found: ${storeId}`);

    if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name || name.length > 255) {
            throw new BadRequestError("Store name must be between 1 and 255 characters");
        }
    }
    if (input.description !== undefined && input.description.length > 1000) {
        throw new BadRequestError("Description must not exceed 1000 characters");
    }
    if (input.address !== undefined && input.address.length > 500) {
        throw new BadRequestError("Address must not exceed 500 characters");
    }

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.description !== undefined) updateData.description = input.description.trim() || null;
    if (input.address !== undefined) updateData.address = input.address.trim() || null;

    const updated = await prisma.inventoryLocation.update({
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

export async function setStoreActiveStatus(
    auth: AccessTokenPayload,
    storeId: string,
    activate: boolean
) {
    assertAdmin(auth);

    const store = await prisma.inventoryLocation.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundError(`Store not found: ${storeId}`);

    if (!activate) {
        // Check for in-flight transfers
        const inFlightCount = await prisma.stockTransferRequest.count({
            where: {
                OR: [{ sourceLocationId: storeId }, { destinationLocationId: storeId }],
                status: { in: ["PENDING", "APPROVED_IN_TRANSIT"] },
            },
        });

        if (inFlightCount > 0) {
            throw new ConflictError(
                `Cannot deactivate store: ${inFlightCount} in-flight transfer(s) are still pending or in transit`,
                "IN_FLIGHT_TRANSFERS"
            );
        }
    }

    const updated = await prisma.inventoryLocation.update({
        where: { id: storeId },
        data: { isActive: activate },
    });

    const action = activate ? "STORE_ACTIVATED" : "STORE_DEACTIVATED";
    await writeAuditLog(storeId, action, auth.userId, formatStore(updated));

    return formatStore(updated);
}

// ─── Req 5: Assign Manager ────────────────────────────────────────────────────

export async function assignStoreManager(
    auth: AccessTokenPayload,
    input: AssignManagerInput
) {
    // Validate in order: admin → user exists → store exists → store active
    assertAdmin(auth);

    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new NotFoundError(`User not found: ${input.userId}`);

    const store = await prisma.inventoryLocation.findUnique({ where: { id: input.storeId } });
    if (!store) throw new NotFoundError(`Store not found: ${input.storeId}`);

    if (!store.isActive) {
        throw new ConflictError(
            `Cannot assign manager to inactive store '${store.name}'`,
            "STORE_INACTIVE"
        );
    }

    // Upsert: replace any existing assignment for this user
    const assignment = await prisma.storeManagerAssignment.upsert({
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

export async function removeStoreManager(
    auth: AccessTokenPayload,
    userId: string
) {
    assertAdmin(auth);

    const assignment = await prisma.storeManagerAssignment.findUnique({
        where: { userId },
        include: {
            store: { select: { id: true, code: true } },
            user: { select: { name: true, email: true } },
        },
    });
    if (!assignment) {
        throw new NotFoundError(`No manager assignment found for user: ${userId}`);
    }

    await prisma.storeManagerAssignment.delete({ where: { userId } });

    await writeAuditLog(assignment.storeId, "MANAGER_REMOVED", auth.userId, {
        userId,
        userName: assignment.user.name,
        userEmail: assignment.user.email,
        storeCode: assignment.store.code,
    });

    return { success: true, message: "Manager assignment removed" };
}

// ─── Req 7: List Manager Assignments ─────────────────────────────────────────

export async function listManagerAssignments(
    auth: AccessTokenPayload,
    storeId?: string
) {
    assertAdmin(auth);

    const assignments = await prisma.storeManagerAssignment.findMany({
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

export async function getStoreAuditLog(
    auth: AccessTokenPayload,
    storeId: string
) {
    assertAdmin(auth);

    const store = await prisma.inventoryLocation.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundError(`Store not found: ${storeId}`);

    const logs = await prisma.storeAuditLog.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
    });

    return logs;
}
