import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";

export async function GET() {
  try {
    await requireAdminSession();
  } catch (err) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const config = await prisma.appConfig.findFirst({ orderBy: { id: "desc" } });
  const token = await prisma.adminToken.findFirst({ orderBy: { obtainedAt: "desc" } });
  const now = Date.now();
  return NextResponse.json({
    hasConfig: !!config,
    clientId: config?.clientId ?? null,
    tenantId: config?.tenantId ?? null,
    clientSecret: config?.clientSecret ?? null,
    licenseSkuId: config?.licenseSkuId ?? null,

    // New fields
    authClientId: config?.authClientId ?? null,
    authClientSecret: config?.authClientSecret ?? null,
    authUrl: config?.authUrl ?? null,
    tokenUrl: config?.tokenUrl ?? null,
    userUrl: config?.userUrl ?? null,

    epayPid: config?.epayPid ?? null,
    epayKey: config?.epayKey ?? null,
    epayUrl: config?.epayUrl ?? null,
    invitePrice: config?.invitePrice ?? null,

    updatedAt: config?.updatedAt ?? null,
    token: token
      ? {
        expiresAt: token.expiresAt,
        expired: token.expiresAt.getTime() < now,
        scope: token.scope,
        tokenLength: token.accessToken.length
      }
      : null
  });
}

export async function POST(request: Request) {
  try {
    await requireAdminSession();
  } catch (err) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));

  // Basic validation still checks Graph Client ID as it's core? Or make it optional?
  // Existing logic enforced clientId/Secret. We keep that enforcement or relax it?
  // User wants payment primarily but code assumes Graph logic exists.
  // We'll keep Graph logic mandatory for now to avoid breaking existing flow, but add others.

  const {
    clientId, clientSecret, licenseSkuId, tenantId,
    authClientId, authClientSecret, authUrl, tokenUrl, userUrl,
    epayPid, epayKey, epayUrl, invitePrice
  } = body;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Graph Client ID 和 Client Secret 均不能为空" }, { status: 400 });
  }

  const existing = await prisma.appConfig.findFirst({ orderBy: { id: "desc" } });
  const data = {
    clientId,
    clientSecret,
    tenantId: tenantId || null,
    licenseSkuId: licenseSkuId || null,
    authClientId: authClientId || null,
    authClientSecret: authClientSecret || null,
    authUrl: authUrl || null,
    tokenUrl: tokenUrl || null,
    userUrl: userUrl || null,
    epayPid: epayPid || null,
    epayKey: epayKey || null,
    epayUrl: epayUrl || "https://credit.linux.do/epay",
    invitePrice: invitePrice || 10
  };

  if (existing) {
    await prisma.appConfig.update({
      where: { id: existing.id },
      data
    });
  } else {
    await prisma.appConfig.create({ data });
  }

  return NextResponse.json({ ok: true });
}
