import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  adminSessionCookieName,
  adminSessionCookieOptions,
  deleteAdminSession
} from "@/lib/admin";

export async function POST() {
  const token = cookies().get(adminSessionCookieName)?.value;
  if (token) {
    await deleteAdminSession(token);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminSessionCookieName, "", {
    ...adminSessionCookieOptions,
    maxAge: 0
  });
  return res;
}
