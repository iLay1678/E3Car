import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAuthorizeUrl } from "@/lib/oauth";
import { requireAdminSession } from "@/lib/admin";

export async function GET(request: Request) {
  try {
    await requireAdminSession();
  } catch (err) {
    return NextResponse.redirect(new URL("/admin?error=unauthorized", request.url));
  }

  const config = await prisma.appConfig.findFirst({ orderBy: { id: "desc" } });
  if (!config || !config.tenantId) {
    return NextResponse.redirect(new URL("/admin?error=config-missing-tenant", request.url));
  }

  // Derive redirect URI from config or app url
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectUri = `${appUrl}/api/admin/oauth/callback`;

  const state = Math.random().toString(36).slice(2);
  const url = buildAuthorizeUrl(config.clientId, config.tenantId, redirectUri, state);

  const res = NextResponse.redirect(url);
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10
  });
  return res;
}
