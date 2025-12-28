import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createPurchasedInviteCode } from "@/lib/invite";

export const dynamic = 'force-dynamic';

// Log helper removed


export async function GET() {
    console.log("[PaymentCheck] GET request received - route is alive");
    return NextResponse.json({ status: "checking route is alive" });
}

export async function POST(request: Request) {
    console.log("[PaymentCheck] Request received");
    try {
        const session = await getSession();
        if (!session) {
            console.log("[PaymentCheck] Unauthenticated");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await request.json().catch(err => {
            console.error("[PaymentCheck] JSON parse error:", err);
            return null;
        });
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { out_trade_no, trade_no } = body;

        if (!out_trade_no && !trade_no) {
            return NextResponse.json({ error: "Missing out_trade_no or trade_no" }, { status: 400 });
        }

        const tradeNoToUse = out_trade_no; // We need out_trade_no to find local order

        // Find order by out_trade_no (which is our tradeNo in DB)
        const order = await prisma.order.findUnique({
            where: { tradeNo: tradeNoToUse, userId: session.user.id },
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

        // Query Gateway - Using act=order as per documentation
        // trade_no is REQUIRED.
        // We prioritize trade_no from request (callback), then saved apiTradeNo, then fallback to empty.
        const gatewayTradeNo = trade_no || order.apiTradeNo || "";
        const gatewayOutTradeNo = out_trade_no || "";

        const queryUrl = `${config.epayUrl}/api.php?act=order&pid=${config.epayPid}&key=${config.epayKey}&trade_no=${gatewayTradeNo}&out_trade_no=${gatewayOutTradeNo}`;

        console.log(`[PaymentCheck] Querying: ${queryUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

        let data: any;
        try {
            const res = await fetch(queryUrl, {
                signal: controller.signal,
                next: { revalidate: 0 }
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                const errorText = await res.text().catch(() => "No body");
                console.error(`[PaymentCheck] Gateway returned status ${res.status}: ${errorText}`);
                return NextResponse.json({
                    error: "Gateway query failed",
                    gatewayStatus: res.status,
                    gatewayError: errorText.slice(0, 100)
                }, { status: 502 });
            }
            data = await res.json();
        } catch (fetchError) {
            clearTimeout(timeoutId);
            console.error("[PaymentCheck] Fetch error:", fetchError);
            return NextResponse.json({
                error: (fetchError as any).name === 'AbortError' ? "Gateway query timeout" : "Gateway connection failed",
                details: (fetchError as any).message
            }, { status: 504 });
        }

        console.log(`[PaymentCheck] Gateway response:`, data);

        // EasyPay response: code=1 means success, status=1 means paid
        if (data.code === 1 && String(data.status) === "1") {
            try {
                const updatedOrder = await prisma.$transaction(async (tx) => {
                    const o = await tx.order.update({
                        where: { id: order.id },
                        data: {
                            status: "PAID",
                            apiTradeNo: String(data.trade_no || "")
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
            } catch (dbError) {
                console.error("[PaymentCheck] Database update error:", dbError);
                return NextResponse.json({ error: "Failed to update order status", details: (dbError as any).message }, { status: 500 });
            }
        }

        return NextResponse.json({ status: order.status, msg: data.msg || "未支付" });

    } catch (error) {
        console.error("Check Status Global Error:", error);
        return NextResponse.json({ error: "Internal Error", details: (error as any).message }, { status: 500 });
    }
}
