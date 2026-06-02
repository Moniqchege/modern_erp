import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../errors/http-error";
import { prisma } from "../server";
import type { AuthenticatedRequest } from "../middleware/auth";

export const usersRouter = Router();

usersRouter.use(requireAuth);

/**
 * GET /api/users
 * Admin-only. Returns a lightweight list of all users (id, name, email, role)
 * so the frontend can render a name-based picker instead of asking for a raw UUID.
 */
usersRouter.get("/", async (req, res, next) => {
    try {
        const auth = (req as AuthenticatedRequest).auth;
        if (auth.role !== "ADMIN" && auth.role !== "SUPERADMIN") {
            throw new HttpError(403, "Only administrators can list users", "FORBIDDEN");
        }

        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true },
            orderBy: { name: "asc" },
        });

        res.json({ users });
    } catch (err) {
        next(err);
    }
});
