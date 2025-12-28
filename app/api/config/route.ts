import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const config = await prisma.appConfig.findFirst({
            orderBy: { id: "desc" },
        });

        return NextResponse.json({
            invitePrice: config?.invitePrice ? Number(config.invitePrice) : 10,
        });
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
