"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const http_error_1 = require("../errors/http-error");
const server_1 = require("../server");
exports.usersRouter = (0, express_1.Router)();
exports.usersRouter.use(auth_1.requireAuth);
/**
 * GET /api/users
 * Admin-only. Returns a lightweight list of all users (id, name, email, role)
 * so the frontend can render a name-based picker instead of asking for a raw UUID.
 */
exports.usersRouter.get("/", async (req, res, next) => {
    try {
        const auth = req.auth;
        if (auth.role !== "ADMIN" && auth.role !== "SUPERADMIN") {
            throw new http_error_1.HttpError(403, "Only administrators can list users", "FORBIDDEN");
        }
        const users = await server_1.prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true },
            orderBy: { name: "asc" },
        });
        res.json({ users });
    }
    catch (err) {
        next(err);
    }
});
