import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  adminAccessTokenCookieName,
  adminAccessTokenCookieOptions,
  adminRefreshTokenCookieName,
  adminRefreshTokenCookieOptions,
  createAdminAuthTokens,
  createAdminSession,
  deleteAdminSession,
  getActiveAdminSession,
  verifyAdminRefreshToken
} from "@/lib/admin";

export async function POST() {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get(adminRefreshTokenCookieName)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const payload = await verifyAdminRefreshToken(refreshToken);
    const session = await getActiveAdminSession(payload.sid);
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    await deleteAdminSession(session.token);
    const newSession = await createAdminSession();
    const { accessToken, refreshToken: nextRefreshToken } = await createAdminAuthTokens(newSession.token);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(adminAccessTokenCookieName, accessToken, adminAccessTokenCookieOptions);
    res.cookies.set(adminRefreshTokenCookieName, nextRefreshToken, adminRefreshTokenCookieOptions);
    return res;
  } catch {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
}
