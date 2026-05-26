import bcrypt from "bcrypt";
import { prisma } from "../server";
import { constantTimeEqual, randomNumericOtp } from "../utils/auth";
import { signAccessToken } from "../auth/jwt";
import crypto from "crypto";

const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || "admin@local.test";
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || "Default Admin";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "Admin123!";

function otpTtlMs() {
    const v = process.env.OTP_TTL_MS;
    return v ? Number(v) : 5 * 60 * 1000;
}

function tokenTtlMs() {
    const v = process.env.PASSWORD_RESET_TTL_MS;
    return v ? Number(v) : 60 * 60 * 1000;
}

function hashToken(raw: string) {
    return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function seedDefaultUserIfNeeded() {
    const existing = await prisma.user.findUnique({ where: { email: DEFAULT_ADMIN_EMAIL } });
    if (existing) return existing;

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

    return prisma.user.create({
        data: {
            email: DEFAULT_ADMIN_EMAIL,
            name: DEFAULT_ADMIN_NAME,
            role: "SUPERADMIN",
            passwordHash,
            forcePasswordReset: true,
        },
    });
}

export async function loginWithPasswordThenOtp(params: { email: string; password: string }) {
    const { email, password } = params;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
        console.warn(`[OTP] login attempt failed: user not found or missing passwordHash. email=${email}`);
        throw new Error("Invalid credentials");
    }


    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
        console.warn(`[OTP] login attempt failed: invalid password. email=${email}`);
        throw new Error("Invalid credentials");
    }


    const code = randomNumericOtp(6);
    const expiresAt = new Date(Date.now() + otpTtlMs());

    await prisma.otpCode.upsert({
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

export async function resendOtp(params: { email: string }) {
    const { email } = params;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("Invalid request");

    const code = randomNumericOtp(6);
    const expiresAt = new Date(Date.now() + otpTtlMs());

    await prisma.otpCode.upsert({
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

export async function verifyOtp(params: { email: string; otp: string }) {
    const { email, otp } = params;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("Invalid request");

    const otpRow = await prisma.otpCode.findUnique({ where: { userId: user.id } });
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
    if (!constantTimeEqual(otp, otpRow.code)) {
        console.warn(`[OTP] verify failed: invalid otp. email=${email} provided=${otp} expected=${otpRow.code}`);
        throw new Error("Invalid OTP");
    }



    await prisma.otpCode.update({
        where: { userId: user.id },
        data: { verifiedAt: new Date() },
    });

    console.log(`[OTP] verified: email=${user.email} userId=${user.id}`);

    const accessToken = signAccessToken({
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

export async function forceResetPassword(params: { email: string; newPassword: string }) {
    const { email, newPassword } = params;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("User not found");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash,
            forcePasswordReset: false,
        },
    });

    return { ok: true };
}

export async function getUserByTokenPayload(payload: { userId: string }) {
    return prisma.user.findUnique({ where: { id: payload.userId } });
}

export async function createPasswordResetToken(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        // Avoid leaking existence
        return { ok: true };
    }

    const raw = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + tokenTtlMs());

    await prisma.passwordResetToken.upsert({
        where: { userId: user.id },
        update: { tokenHash, expiresAt },
        create: { userId: user.id, tokenHash, expiresAt },
    });

    return { ok: true, token: raw };
}

export async function resetPasswordWithToken(params: { email: string; token: string; newPassword: string }) {
    const { email, token, newPassword } = params;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("Invalid request");

    const row = await prisma.passwordResetToken.findUnique({ where: { userId: user.id } });
    if (!row) throw new Error("Reset not requested");
    if (row.expiresAt.getTime() < Date.now()) throw new Error("Reset token expired");

    const tokenHash = hashToken(token);
    if (tokenHash !== row.tokenHash) throw new Error("Invalid reset token");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, forcePasswordReset: false },
    });

    await prisma.passwordResetToken.delete({ where: { userId: user.id } });

    return { ok: true };
}

