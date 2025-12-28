import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertInviteCodeUsable, markInviteUsed } from "@/lib/invite";
import { createEnterpriseUser } from "@/lib/graph";
import { z } from "zod";

const schema = z.object({
  displayName: z.string().min(1, "displayName is required"),
  localPart: z.string().optional(),
  inviteCode: z.string().min(1)
});

import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { displayName, localPart, inviteCode } = parsed.data;

  try {
    const invite = await assertInviteCodeUsable(inviteCode);
    const { userPrincipalName, graphUserId, password } = await createEnterpriseUser({
      displayName,
      localPart
    });
    const enterpriseUser = await prisma.enterpriseUser.findUnique({
      where: { graphUserId }
    });
    if (!enterpriseUser) {
      throw new Error("Failed to persist enterprise user");
    }
    await markInviteUsed(invite.id, enterpriseUser.id);
    return NextResponse.json({ userPrincipalName, password });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
