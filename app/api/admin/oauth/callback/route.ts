import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForToken } from "@/lib/oauth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = cookies();
  const storedState = cookieStore.get("oauth_state")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/admin?error=oauth_state", request.url));
  }

  const config = await prisma.appConfig.findFirst({ orderBy: { id: "desc" } });
  if (!config) {
    return NextResponse.redirect(new URL("/admin?error=config-missing", request.url));
  }

  try {
    await exchangeCodeForToken({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret
    });
    const res = NextResponse.redirect(new URL("/admin?success=oauth", request.url));
    res.cookies.delete("oauth_state");
    return res;
  } catch (err) {
    return NextResponse.redirect(
      new URL(`/admin?error=${encodeURIComponent((err as Error).message)}`, request.url)
    );
  }
}
