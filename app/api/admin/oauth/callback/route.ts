import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForToken } from "@/lib/oauth";

function buildRedirectUrl(request: Request, path: string) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (forwardedProto && host) {
    return new URL(path, `${forwardedProto}://${host}`);
  }
  if (host) {
    const base = new URL(request.url);
    return new URL(path, `${base.protocol}//${host}`);
  }
  return new URL(path, request.url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = cookies();
  const storedState = cookieStore.get("oauth_state")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin?error=oauth_state"));
  }

  const config = await prisma.appConfig.findFirst({ orderBy: { id: "desc" } });
  if (!config || !config.tenantId) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin?error=config-missing-tenant"));
  }

  // Derive redirect URI from config or app url
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectUri = `${appUrl}/api/admin/oauth/callback`;

  try {
    await exchangeCodeForToken({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      tenantId: config.tenantId,
      redirectUri
    });
    const res = NextResponse.redirect(buildRedirectUrl(request, "/admin?success=oauth"));
    res.cookies.delete("oauth_state");
    return res;
  } catch (err) {
    return NextResponse.redirect(
      buildRedirectUrl(request, `/admin?error=${encodeURIComponent((err as Error).message)}`)
    );
  }
}
