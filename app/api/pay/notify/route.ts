import { prisma } from "@/lib/prisma";
import { verify } from "@/lib/payment";
import { createPurchasedInviteCode } from "@/lib/invite";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    return handle(request);
}

export async function POST(request: Request) {
    return handle(request);
}

async function handle(request: Request) {
    try {
        const url = new URL(request.url);
        const entries = Array.from(url.searchParams.entries());
        const params: Record<string, string> = {};
        for (const [k, v] of entries) {
            params[k] = v;
        }

        // If POST, body might overwrite params? EPay usually sends QUERY params or FORM body.
        // For simplicity, we check URL params first. 
        // If empty and POST, read body.
        if (Object.keys(params).length === 0 && request.method === "POST") {
            const formData = await request.formData();
            formData.forEach((value, key) => {
                if (typeof value === 'string') params[key] = value;
            });
        }

        const { out_trade_no, trade_status, trade_no } = params;

        const config = await prisma.appConfig.findFirst();
        if (!config || !config.epayKey) {
            console.error("Notify Error: Config missing");
            return new Response("fail", { status: 500 });
        }

        if (!verify(params, config.epayKey)) {
            console.error("Notify Error: Invalid Signature", params);
            return new Response("fail", { status: 400 });
        }

        // Find Order
        const order = await prisma.order.findUnique({
            where: { tradeNo: out_trade_no },
            include: { inviteCode: true }
        });

        if (!order) {
            // Only return success if it's truly unknown? No, maybe retry?
            console.error("Notify Error: Order not found", out_trade_no);
            return new Response("fail", { status: 404 });
        }

        if (order.status === "PAID") {
            return new Response("success", { status: 200 });
        }

        // Update Order & Create Code
        // status 1 usually means success in epay/codepay
        // But check trade_status if available
        // Epay doc says: "trade_status fixed TRADE_SUCCESS"
        if (params.trade_status === "TRADE_SUCCESS" || params.status === "1") {
            await prisma.$transaction(async (tx) => {
                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        status: "PAID",
                        apiTradeNo: trade_no,
                    }
                });
                // Create Invite Code if not exists
                if (!order.inviteCode) {
                    // We need to call createPurchasedInviteCode but using tx? 
                    // Our lib function uses global prisma. We can just duplicate logic or import differently.
                    // For simplicity, let's just do it here with tx.
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
                            ownerId: order.userId,
                            orderId: order.id
                        }
                    });
                }
            });
        }

        return new Response("success", { status: 200 });

    } catch (err) {
        console.error("Notify Exception:", err);
        return new Response("fail", { status: 500 });
    }
}
