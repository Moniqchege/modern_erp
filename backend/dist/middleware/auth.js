"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jwt_1 = require("../auth/jwt");
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) {
        return res.status(401).json({ message: "Authentication required" });
    }
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        req.auth = payload;
        next();
    }
    catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}
