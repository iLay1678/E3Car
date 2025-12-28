import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tradeNo = searchParams.get("tradeNo");

    if (!tradeNo) {
        return NextResponse.json({ error: "Missing tradeNo" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
        where: { tradeNo },
        include: { inviteCode: true }
    });

    if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
        status: order.status,
        code: order.inviteCode?.code,
        amount: order.amount
    });
}
