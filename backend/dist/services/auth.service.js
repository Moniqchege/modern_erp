"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultUserIfNeeded = seedDefaultUserIfNeeded;
exports.loginWithPasswordThenOtp = loginWithPasswordThenOtp;
exports.resendOtp = resendOtp;
exports.verifyOtp = verifyOtp;
exports.forceResetPassword = forceResetPassword;
exports.getUserByTokenPayload = getUserByTokenPayload;
exports.createPasswordResetToken = createPasswordResetToken;
exports.resetPasswordWithToken = resetPasswordWithToken;
const bcrypt_1 = __importDefault(require("bcrypt"));
const server_1 = require("../server");
const auth_1 = require("../utils/auth");
const jwt_1 = require("../auth/jwt");
const crypto_1 = __importDefault(require("crypto"));
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || "admin@local.test";
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || "Default Admin";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "Admin123!";
// ─── Dev store-manager accounts ──────────────────────────────────────────────
// These are created on startup so the app can be demoed with different roles
// without manual DB setup. All share the same temporary password and are
// flagged forcePasswordReset = true.
const DEMO_PASSWORD = "Manager123!";
const DEMO_USERS = [
    { email: "main.store@local.test", name: "Main Store Manager", role: "MAIN_STORE_MANAGER", storeCode: "MAIN_STORE" },
    { email: "maize.store@local.test", name: "Maize Store Manager", role: "MAIZE_STORE_MANAGER", storeCode: "MAIZE_STORE" },
    { email: "packaging.store@local.test", name: "Packaging Store Manager", role: "PACKAGING_STORE_MANAGER", storeCode: "PACKAGING_STORE" },
    { email: "dispatch.store@local.test", name: "Dispatch Store Manager", role: "DISPATCH_STORE_MANAGER", storeCode: "DISPATCH_STORE" },
];
function otpTtlMs() {
    const v = process.env.OTP_TTL_MS;
    return v ? Number(v) : 5 * 60 * 1000;
}
function tokenTtlMs() {
    const v = process.env.PASSWORD_RESET_TTL_MS;
    return v ? Number(v) : 60 * 60 * 1000;
}
function hashToken(raw) {
    return crypto_1.default.createHash("sha256").update(raw).digest("hex");
}
async function seedDefaultUserIfNeeded() {
    const existing = await server_1.prisma.user.findUnique({ where: { email: DEFAULT_ADMIN_EMAIL } });
    if (!existing) {
        const passwordHash = await bcrypt_1.default.hash(DEFAULT_ADMIN_PASSWORD, 10);
        await server_1.prisma.user.create({
            data: {
                email: DEFAULT_ADMIN_EMAIL,
                name: DEFAULT_ADMIN_NAME,
                role: "SUPERADMIN",
                passwordHash,
                forcePasswordReset: true,
            },
        });
    }
    // Seed demo store-manager users (idempotent)
    const demoHash = await bcrypt_1.default.hash(DEMO_PASSWORD, 10);
    for (const demo of DEMO_USERS) {
        const user = await server_1.prisma.user.upsert({
            where: { email: demo.email },
            update: {}, // don't overwrite if already set up
            create: {
                email: demo.email,
                name: demo.name,
                role: demo.role,
                passwordHash: demoHash,
                forcePasswordReset: false,
            },
        });
        // Ensure the legacy store location exists and link via StoreManagerAssignment
        const store = await server_1.prisma.inventoryLocation.findUnique({ where: { code: demo.storeCode } });
        if (store) {
            await server_1.prisma.storeManagerAssignment.upsert({
                where: { userId: user.id },
                update: { storeId: store.id },
                create: { userId: user.id, storeId: store.id, assignedAt: new Date() },
            });
        }
    }
}
async function loginWithPasswordThenOtp(params) {
    const { email, password } = params;
    const user = await server_1.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
        console.warn(`[OTP] login attempt failed: user not found or missing passwordHash. email=${email}`);
        throw new Error("Invalid credentials");
    }
    const ok = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!ok) {
        console.warn(`[OTP] login attempt failed: invalid password. email=${email}`);
        throw new Error("Invalid credentials");
    }
    const code = (0, auth_1.randomNumericOtp)(6);
    const expiresAt = new Date(Date.now() + otpTtlMs());
    await server_1.prisma.otpCode.upsert({
        where: { userId: user.id },
        update: {
            code,
            expiresAt,
            verifiedAt: null,
        },
        create: {
            userId: user.id,
            code,
            expiresAt,
            verifiedAt: null,
        },
    });
    console.log(`[OTP] generated: ${code}`);
    return {
        userId: user.id,
        email: user.email,
        forcePasswordReset: user.forcePasswordReset,
        otpExpiresAt: expiresAt,
        otp: code,
    };
}
async function resendOtp(params) {
    const { email } = params;
    const user = await server_1.prisma.user.findUnique({ where: { email } });
    if (!user)
        throw new Error("Invalid request");
    const code = (0, auth_1.randomNumericOtp)(6);
    const expiresAt = new Date(Date.now() + otpTtlMs());
    await server_1.prisma.otpCode.upsert({
        where: { userId: user.id },
        update: {
            code,
            expiresAt,
            verifiedAt: null,
            createdAt: new Date(),
        },
        create: {
            userId: user.id,
            code,
            expiresAt,
            verifiedAt: null,
        },
    });
    console.log(`[OTP] resent: ${code} email=${email}`);
    return {
        otpExpiresAt: expiresAt,
    };
}
async function verifyOtp(params) {
    const { email, otp } = params;
    const user = await server_1.prisma.user.findUnique({ where: { email } });
    if (!user)
        throw new Error("Invalid request");
    const otpRow = await server_1.prisma.otpCode.findUnique({ where: { userId: user.id } });
    if (!otpRow) {
        console.warn(`[OTP] verify failed: otp not generated. email=${email}`);
        throw new Error("OTP not generated");
    }
    if (otpRow.verifiedAt) {
        console.warn(`[OTP] verify failed: otp already verified. email=${email}`);
        throw new Error("OTP already verified");
    }
    if (otpRow.expiresAt.getTime() < Date.now()) {
        console.warn(`[OTP] verify failed: otp expired. email=${email} expiresAt=${otpRow.expiresAt.toISOString()}`);
        throw new Error("OTP expired");
    }
    if (!(0, auth_1.constantTimeEqual)(otp, otpRow.code)) {
        console.warn(`[OTP] verify failed: invalid otp. email=${email} provided=${otp} expected=${otpRow.code}`);
        throw new Error("Invalid OTP");
    }
    await server_1.prisma.otpCode.update({
        where: { userId: user.id },
        data: { verifiedAt: new Date() },
    });
    console.log(`[OTP] verified: email=${user.email} userId=${user.id}`);
    const accessToken = (0, jwt_1.signAccessToken)({
        userId: user.id,
        email: user.email,
        role: user.role,
        forcePasswordReset: user.forcePasswordReset,
    });
    return {
        accessToken,
        forcePasswordReset: user.forcePasswordReset,
    };
}
async function forceResetPassword(params) {
    const { email, newPassword } = params;
    const user = await server_1.prisma.user.findUnique({ where: { email } });
    if (!user)
        throw new Error("User not found");
    const passwordHash = await bcrypt_1.default.hash(newPassword, 10);
    await server_1.prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash,
            forcePasswordReset: false,
        },
    });
    return { ok: true };
}
async function getUserByTokenPayload(payload) {
    return server_1.prisma.user.findUnique({ where: { id: payload.userId } });
}
async function createPasswordResetToken(email) {
    const user = await server_1.prisma.user.findUnique({ where: { email } });
    if (!user) {
        // Avoid leaking existence
        return { ok: true };
    }
    const raw = crypto_1.default.randomBytes(32).toString("hex");
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + tokenTtlMs());
    await server_1.prisma.passwordResetToken.upsert({
        where: { userId: user.id },
        update: { tokenHash, expiresAt },
        create: { userId: user.id, tokenHash, expiresAt },
    });
    return { ok: true, token: raw };
}
async function resetPasswordWithToken(params) {
    const { email, token, newPassword } = params;
    const user = await server_1.prisma.user.findUnique({ where: { email } });
    if (!user)
        throw new Error("Invalid request");
    const row = await server_1.prisma.passwordResetToken.findUnique({ where: { userId: user.id } });
    if (!row)
        throw new Error("Reset not requested");
    if (row.expiresAt.getTime() < Date.now())
        throw new Error("Reset token expired");
    const tokenHash = hashToken(token);
    if (tokenHash !== row.tokenHash)
        throw new Error("Invalid reset token");
    const passwordHash = await bcrypt_1.default.hash(newPassword, 10);
    await server_1.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, forcePasswordReset: false },
    });
    await server_1.prisma.passwordResetToken.delete({ where: { userId: user.id } });
    return { ok: true };
}
