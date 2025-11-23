import { NextResponse } from "next/server";
import {
  adminAccessTokenCookieName,
  adminAccessTokenCookieOptions,
  adminRefreshTokenCookieName,
  adminRefreshTokenCookieOptions,
  createAdminAuthTokens,
  createAdminSession
} from "@/lib/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { password } = body;
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "ADMIN_PASSWORD not set" }, { status: 500 });
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const session = await createAdminSession();
  const { accessToken, refreshToken } = await createAdminAuthTokens(session.token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminAccessTokenCookieName, accessToken, adminAccessTokenCookieOptions);
  res.cookies.set(adminRefreshTokenCookieName, refreshToken, adminRefreshTokenCookieOptions);
  return res;
}
