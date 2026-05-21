import { Router } from "express";
import { z } from "zod";
import {
    seedDefaultUserIfNeeded,
    loginWithPasswordThenOtp,
    verifyOtp,
    forceResetPassword,
    createPasswordResetToken,
    resetPasswordWithToken,
} from "../services/auth.service";

export const authRouter = Router();

authRouter.post("/seed", async (_req, res) => {
    try {
        const u = await seedDefaultUserIfNeeded();
        res.status(200).json({ success: true, user: { id: u.id, email: u.email, role: u.role } });
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

