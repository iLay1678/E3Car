import { getOAuthConfig, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma"; // Adjust path if needed
import { sign } from "@/lib/payment";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const config = await prisma.appConfig.findFirst();
        if (!config || !config.epayPid || !config.epayKey || !config.epayUrl) {
            return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
        }

        const price = Number(config.invitePrice) || 10;

        // Create Layout Order
        const out_trade_no = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

        const order = await prisma.order.create({
            data: {
                tradeNo: out_trade_no,
                amount: price,
                userId: session.user.id,
                status: "PENDING"
            }
        });

        const notify_url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/pay/notify`;
        const return_url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/orders`;

        const params: Record<string, string> = {
            pid: config.epayPid,
            type: "epay",
            out_trade_no: out_trade_no,
            notify_url,
            return_url,
            name: "Invite Code Purchase",
            money: price.toFixed(2),
            sign_type: "MD5"
        };

        params.sign = sign(params, config.epayKey);

        const qs = new URLSearchParams(params).toString();
        const jumpUrl = `${config.epayUrl}/pay/submit.php?${qs}`;

        // Normally we might return the URL for frontend to jump
        // But since this is a submit API called by frontend, returning JSON is best.
        // Or we could return a form HTML if we needed POST, but GET is fine for many epay usually?
        // User guide says: "POST /pay/submit.php".
        // So we should construct a form and auto-submit it, or use the client to submit.
        // Returning the params to the client is cleaner.

        return NextResponse.json({
            url: `${config.epayUrl}/pay/submit.php`,
            params
        });

    } catch (error) {
        console.error("Payment Submit Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
