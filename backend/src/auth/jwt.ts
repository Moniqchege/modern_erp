import jwt, { SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const ACCESS_TOKEN_TTL =
  (process.env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"]) || "15m";

/**
 * Grace period in seconds added to the expiry check on the verification side
 * so that the client can call /auth/refresh a few seconds after the access
 * token's nominal expiry without being kicked out. The newly-issued token
 * will start a fresh TTL window.
 */
const CLOCK_SKEW_SECONDS = Number(process.env.JWT_CLOCK_SKEW_SECONDS || 30);

export type AccessTokenPayload = {
  userId: string;
  email: string;
  role: string;
  forcePasswordReset: boolean;
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_SECRET, {
    clockTolerance: CLOCK_SKEW_SECONDS,
  }) as AccessTokenPayload;
}
