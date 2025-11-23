import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { decodeJwt, JWTPayload, SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

const accessTokenTtlSeconds = 60 * 5; // 5 minutes
const refreshTokenTtlSeconds = 60 * 60 * 24 * 7; // 7 days
const sessionTtlSeconds = refreshTokenTtlSeconds;
const jwtIssuer = "e3car-admin";
const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/"
};

export const adminAccessTokenCookieName = "adminAccessToken";
export const adminRefreshTokenCookieName = "adminRefreshToken";
export const adminAccessTokenCookieOptions = {
  ...baseCookieOptions,
  maxAge: accessTokenTtlSeconds
};
export const adminRefreshTokenCookieOptions = {
  ...baseCookieOptions,
  maxAge: refreshTokenTtlSeconds
};

type AdminTokenType = "access" | "refresh";

interface AdminJwtPayload extends JWTPayload {
  sid: string;
  type: AdminTokenType;
}

let cachedSecret: Uint8Array | null = null;

function getJwtSecret() {
  if (!process.env.ADMIN_JWT_SECRET) {
    throw new Error("ADMIN_JWT_SECRET not set");
  }
  if (!cachedSecret) {
    cachedSecret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET);
  }
  return cachedSecret;
}

async function signAdminToken(sessionId: string, type: AdminTokenType, ttlSeconds: number) {
  return new SignJWT({ sid: sessionId, type })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(jwtIssuer)
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getJwtSecret());
}

async function verifyAdminToken(token: string, expectedType: AdminTokenType) {
  const { payload } = await jwtVerify(token, getJwtSecret(), { issuer: jwtIssuer });
  if (payload.type !== expectedType || typeof payload.sid !== "string") {
    throw new Error("Unauthorized");
  }
  return payload as AdminJwtPayload;
}

export async function createAdminAuthTokens(sessionId: string) {
  const [accessToken, refreshToken] = await Promise.all([
    signAdminToken(sessionId, "access", accessTokenTtlSeconds),
    signAdminToken(sessionId, "refresh", refreshTokenTtlSeconds)
  ]);
  return { accessToken, refreshToken };
}

export async function verifyAdminAccessToken(token: string) {
  return verifyAdminToken(token, "access");
}

export async function verifyAdminRefreshToken(token: string) {
  return verifyAdminToken(token, "refresh");
}

export function decodeSessionIdFromToken(token: string) {
  try {
    const decoded = decodeJwt(token) as AdminJwtPayload;
    return typeof decoded.sid === "string" ? decoded.sid : null;
  } catch {
    return null;
  }
}

export async function createAdminSession() {
  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000);
  await prisma.adminSession.create({
    data: {
      token,
      expiresAt
    }
  });
  return { token, expiresAt };
}

export async function deleteAdminSession(token: string) {
  await prisma.adminSession.deleteMany({ where: { token } });
}

async function findActiveSession(token: string) {
  const session = await prisma.adminSession.findUnique({ where: { token } });
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) {
      await prisma.adminSession.delete({ where: { token } }).catch(() => {});
    }
    return null;
  }
  return session;
}

export async function requireAdminSession() {
  const cookieStore = cookies();
  const token = cookieStore.get(adminAccessTokenCookieName)?.value;
  if (!token) {
    throw new Error("Unauthorized");
  }

  const payload = await verifyAdminAccessToken(token);
  const session = await findActiveSession(payload.sid);
  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

export async function getActiveAdminSession(token: string) {
  return findActiveSession(token);
}
