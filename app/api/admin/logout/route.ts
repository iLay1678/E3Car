import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  adminAccessTokenCookieName,
  adminAccessTokenCookieOptions,
  adminRefreshTokenCookieName,
  adminRefreshTokenCookieOptions,
  decodeSessionIdFromToken,
  deleteAdminSession
} from "@/lib/admin";

export async function POST() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(adminAccessTokenCookieName)?.value;
  const refreshToken = cookieStore.get(adminRefreshTokenCookieName)?.value;
  const sessionId =
    (accessToken && decodeSessionIdFromToken(accessToken)) ||
    (refreshToken && decodeSessionIdFromToken(refreshToken));
  if (sessionId) {
    await deleteAdminSession(sessionId);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminAccessTokenCookieName, "", {
    ...adminAccessTokenCookieOptions,
    maxAge: 0
  });
  res.cookies.set(adminRefreshTokenCookieName, "", {
    ...adminRefreshTokenCookieOptions,
    maxAge: 0
  });
  return res;
}
