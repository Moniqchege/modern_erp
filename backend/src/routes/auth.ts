import { Router } from "express";
import { z } from "zod";
import {
    seedDefaultUserIfNeeded,
    loginWithPasswordThenOtp,
    verifyOtp,
    resendOtp,
    forceResetPassword,
    createPasswordResetToken,
    resetPasswordWithToken,
    refreshAccessToken,
} from "../services/auth.service";

export const authRouter = Router();

authRouter.post("/seed", async (_req, res) => {
    try {
        await seedDefaultUserIfNeeded();
        res.status(200).json({ success: true, message: "Seed complete" });
    } catch (e) {
        res.status(500).json({ success: false, message: String(e) });
    }
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ success: false, message: "Invalid request", errors: parse.error.flatten() });

    try {
        const data = await loginWithPasswordThenOtp(parse.data);
        res.status(200).json({ success: true, ...data });
    } catch (e) {
        res.status(401).json({ success: false, message: String(e) });
    }
});

const verifyOtpSchema = z.object({
    email: z.string().email(),
    otp: z.string().min(4).max(10),
});

authRouter.post("/verify-otp", async (req, res) => {
    const parse = verifyOtpSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ success: false, message: "Invalid request", errors: parse.error.flatten() });

    try {
        const data = await verifyOtp(parse.data);
        res.status(200).json({ success: true, ...data });
    } catch (e) {
        res.status(400).json({ success: false, message: String(e) });
    }
});

/**
 * Refresh the access token. The client sends its current (possibly about to
 * expire) access token in the Authorization header and the server will issue
 * a fresh one with a new TTL window. This keeps the user logged in as long
 * as they are actively using the app.
 */
authRouter.post("/refresh", async (req, res) => {
    const header = req.headers.authorization;
    const token =
        header?.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
        return res.status(401).json({ success: false, message: "No token provided" });
    }

    try {
        const data = await refreshAccessToken(token);
        res.status(200).json({ success: true, ...data });
    } catch (e) {
        res.status(401).json({ success: false, message: String(e) });
    }
});

const resendOtpSchema = z.object({
    email: z.string().email(),
});

authRouter.post("/resend-otp", async (req, res) => {
    const parse = resendOtpSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ success: false, message: "Invalid request", errors: parse.error.flatten() });
    }

    try {
        const data = await resendOtp(parse.data);
        res.status(200).json({ success: true, ...data });
    } catch (e) {
        res.status(400).json({ success: false, message: String(e) });
    }
});

const forceResetSchema = z.object({
    email: z.string().email(),
    newPassword: z.string().min(8),
});

authRouter.post("/force-reset", async (req, res) => {
    const parse = forceResetSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ success: false, message: "Invalid request", errors: parse.error.flatten() });

    try {
        await forceResetPassword(parse.data);
        res.status(200).json({ success: true });
    } catch (e) {
        res.status(400).json({ success: false, message: String(e) });
    }
});

const requestResetSchema = z.object({ email: z.string().email() });
authRouter.post("/request-password-reset", async (req, res) => {
    const parse = requestResetSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ success: false, message: "Invalid request", errors: parse.error.flatten() });

    try {
        const data = await createPasswordResetToken(parse.data.email);
        res.status(200).json({ success: true, ...data });
    } catch (e) {
        res.status(500).json({ success: false, message: String(e) });
    }
});

const resetSchema = z.object({
    email: z.string().email(),
    token: z.string().min(10),
    newPassword: z.string().min(8),
});

authRouter.post("/reset-password", async (req, res) => {
    const parse = resetSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ success: false, message: "Invalid request", errors: parse.error.flatten() });

    try {
        await resetPasswordWithToken(parse.data);
        res.status(200).json({ success: true });
    } catch (e) {
        res.status(400).json({ success: false, message: String(e) });
    }
});
