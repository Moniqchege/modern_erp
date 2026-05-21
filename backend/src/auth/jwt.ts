import jwt, { SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const ACCESS_TOKEN_TTL =
  (process.env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"]) || "15m";

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
  return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
}