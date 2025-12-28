import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createPurchasedInviteCode } from "@/lib/invite";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { out_trade_no } = await request.json();

        if (!out_trade_no) {
            return NextResponse.json({ error: "Missing out_trade_no" }, { status: 400 });
        }

        const order = await prisma.order.findUnique({
            where: { tradeNo: out_trade_no, userId: session.user.id },
            include: { inviteCode: true }
        });

        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        if (order.status === "PAID") {
            return NextResponse.json({ status: "PAID", order });
        }

        const config = await prisma.appConfig.findFirst();
        if (!config || !config.epayPid || !config.epayKey || !config.epayUrl) {
            return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
        }

        // Query Gateway
        // act=order&pid={pid}&key={key}&out_trade_no={out_trade_no}
        const queryUrl = `${config.epayUrl}/api.php?act=order&pid=${config.epayPid}&key=${config.epayKey}&out_trade_no=${out_trade_no}`;

        const res = await fetch(queryUrl);
        if (!res.ok) {
            return NextResponse.json({ error: "Gateway query failed" }, { status: 502 });
        }

        const data = await res.json();

        // EasyPay response: code=1 means success, status=1 means paid
        if (data.code === 1 && String(data.status) === "1") {
            const updatedOrder = await prisma.$transaction(async (tx) => {
                const o = await tx.order.update({
                    where: { id: order.id },
                    data: {
                        status: "PAID",
                        apiTradeNo: data.trade_no || null
                    }
                });

                if (!order.inviteCode) {
                    let code = "";
                    while (true) {
                        code = `INV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
                        const exists = await tx.inviteCode.findUnique({ where: { code } });
                        if (!exists) break;
                    }
                    await tx.inviteCode.create({
                        data: {
                            code,
                            source: "PURCHASE",
                            ownerId: session.user.id,
                            orderId: order.id
                        }
                    });
                }
                return o;
            });

            return NextResponse.json({ status: "PAID", order: updatedOrder });
        }

        return NextResponse.json({ status: order.status, msg: data.msg || "未支付" });

    } catch (error) {
        console.error("Check Status Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
