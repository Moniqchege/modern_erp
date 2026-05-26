import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth/jwt";
import type { AccessTokenPayload } from "../auth/jwt";

export type AuthenticatedRequest = Request & {
  auth: AccessTokenPayload;
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token =
    header?.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).auth = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
