"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_service_1 = require("../services/auth.service");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/seed", async (_req, res) => {
    try {
        await (0, auth_service_1.seedDefaultUserIfNeeded)();
        res.status(200).json({ success: true, message: "Seed complete" });
    }
    catch (e) {
        res.status(500).json({ success: false, message: String(e) });
    }
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
exports.authRouter.post("/login", async (req, res) => {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ success: false, message: "Invalid request", errors: parse.error.flatten() });
    try {
        const data = await (0, auth_service_1.loginWithPasswordThenOtp)(parse.data);
        res.status(200).json({ success: true, ...data });
    }
    catch (e) {
        res.status(401).json({ success: false, message: String(e) });
    }
});
const verifyOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    otp: zod_1.z.string().min(4).max(10),
});
exports.authRouter.post("/verify-otp", async (req, res) => {
    const parse = verifyOtpSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ success: false, message: "Invalid request", errors: parse.error.flatten() });
    try {
        const data = await (0, auth_service_1.verifyOtp)(parse.data);
        res.status(200).json({ success: true, ...data });
    }
    catch (e) {
        res.status(400).json({ success: false, message: String(e) });
    }
});
const resendOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
exports.authRouter.post("/resend-otp", async (req, res) => {
    const parse = resendOtpSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({ success: false, message: "Invalid request", errors: parse.error.flatten() });
    }
    try {
        const data = await (0, auth_service_1.resendOtp)(parse.data);
        res.status(200).json({ success: true, ...data });
    }
    catch (e) {
        res.status(400).json({ success: false, message: String(e) });
    }
});
const forceResetSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    newPassword: zod_1.z.string().min(8),
});
exports.authRouter.post("/force-reset", async (req, res) => {
    const parse = forceResetSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ success: false, message: "Invalid request", errors: parse.error.flatten() });
    try {
        await (0, auth_service_1.forceResetPassword)(parse.data);
        res.status(200).json({ success: true });
    }
    catch (e) {
        res.status(400).json({ success: false, message: String(e) });
    }
});
const requestResetSchema = zod_1.z.object({ email: zod_1.z.string().email() });
exports.authRouter.post("/request-password-reset", async (req, res) => {
    const parse = requestResetSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ success: false, message: "Invalid request", errors: parse.error.flatten() });
    try {
        const data = await (0, auth_service_1.createPasswordResetToken)(parse.data.email);
        res.status(200).json({ success: true, ...data });
    }
    catch (e) {
        res.status(500).json({ success: false, message: String(e) });
    }
});
const resetSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    token: zod_1.z.string().min(10),
    newPassword: zod_1.z.string().min(8),
});
exports.authRouter.post("/reset-password", async (req, res) => {
    const parse = resetSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ success: false, message: "Invalid request", errors: parse.error.flatten() });
    try {
        await (0, auth_service_1.resetPasswordWithToken)(parse.data);
        res.status(200).json({ success: true });
    }
    catch (e) {
        res.status(400).json({ success: false, message: String(e) });
    }
});
