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

        const body = await request.json().catch(() => ({}));
        let { out_trade_no } = body;

        const config = await prisma.appConfig.findFirst();
        if (!config || !config.epayPid || !config.epayKey || !config.epayUrl) {
            return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
        }

        let price = Number(config.invitePrice) || 10;
        let order;

        if (out_trade_no) {
            order = await prisma.order.findUnique({
                where: { tradeNo: out_trade_no, userId: session.user.id }
            });
            if (!order || order.status !== "PENDING") {
                return NextResponse.json({ error: "Order not found or already paid" }, { status: 404 });
            }
            price = Number(order.amount);
        } else {
            // Create Layout Order
            out_trade_no = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;
            order = await prisma.order.create({
                data: {
                    tradeNo: out_trade_no,
                    amount: price,
                    userId: session.user.id,
                    status: "PENDING"
                }
            });
        }

        const notify_url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/pay/notify`;
        const return_url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/orders?check=${out_trade_no}`;

        const params: Record<string, string> = {
            pid: config.epayPid,
            type: "epay",
            out_trade_no: out_trade_no,
            notify_url,
            return_url,
            name: "Invite Code Purchase",
            money: price.toFixed(2),
            device: "pc"
        };

        params.sign = sign(params, config.epayKey);
        params.sign_type = "MD5";

        // Server-side submit to capture gateway trade_no (redirect URL)
        const formData = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            formData.append(key, value);
        }

        const submitUrl = `${config.epayUrl}/pay/submit.php`;
        console.log(`[PaymentSubmit] Submitting to ${submitUrl}`);

        const res = await fetch(submitUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
            },
            body: formData,
            redirect: "manual" // Capture 302
        });

        if (res.status === 302 || res.status === 301) {
            const location = res.headers.get("location");
            if (location) {
                console.log(`[PaymentSubmit] Redirect to: ${location}`);
                // Extract order_no from location
                // https://credit.linux.do/paying?order_no=...
                try {
                    const redirectUrlObj = new URL(location);
                    const order_no = redirectUrlObj.searchParams.get("order_no");
                    if (order_no) {
                        console.log(`[PaymentSubmit] Captured Gateway OrderNo: ${order_no}`);
                        // Update Order with apiTradeNo
                        await prisma.order.update({
                            where: { id: order.id },
                            data: { apiTradeNo: order_no }
                        });
                    }
                } catch (e) {
                    console.error("[PaymentSubmit] Error parsing redirect URL:", e);
                }

                return NextResponse.json({
                    url: location,
                    // We don't need params anymore since we redirect directly
                });
            }
        }

        // Fallback if no redirect (e.g. error or direct content)
        // Check if body contains error
        const text = await res.text();
        console.error(`[PaymentSubmit] Gateway returned ${res.status}: ${text.slice(0, 200)}`);

        return NextResponse.json({ error: "Gateway submission failed", details: text.slice(0, 100) }, { status: 502 });

    } catch (error) {
        console.error("Payment Submit Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
