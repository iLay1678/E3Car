import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const adminSessionCookieName = "adminSession";
const sessionTtlSeconds = 60 * 60 * 24; // 24 hours

export const adminSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: sessionTtlSeconds
};

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

export async function requireAdminSession() {
  const cookieStore = cookies();
  const token = cookieStore.get(adminSessionCookieName)?.value;
  if (!token) {
    throw new Error("Unauthorized");
  }

  const session = await prisma.adminSession.findUnique({ where: { token } });
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) {
      await prisma.adminSession.delete({ where: { token } }).catch(() => {});
    }
    throw new Error("Unauthorized");
  }

  return session;
}
