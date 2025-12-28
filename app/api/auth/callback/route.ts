import { getOAuthConfig, login } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state") || "/"; // Redirect target

    if (!code) {
        return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    try {
        const config = await getOAuthConfig();
        const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/callback`;

        // 1. Exchange Code for Token
        const tokenRes = await fetch(config.tokenUrl!, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
            body: new URLSearchParams({
                client_id: config.clientId!,
                client_secret: config.clientSecret!,
                code,
                grant_type: "authorization_code",
                redirect_uri: callbackUrl,
            })
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
            console.error("Token Exchange Error:", tokenData);
            return NextResponse.json({ error: "Failed to exchange token", details: tokenData }, { status: 400 });
        }

        const accessToken = tokenData.access_token;

        // 2. Get User Info
        const userRes = await fetch(config.userUrl!, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/json"
            }
        });

        const userData = await userRes.json();
        if (!userRes.ok) {
            console.error("User Info Error:", userData);
            return NextResponse.json({ error: "Failed to fetch user info" }, { status: 400 });
        }

        // Map fields (adjust based on provider)
        const email = userData.email || userData.sub || "unknown"; // sub is fallback
        const nickname = userData.name || userData.nickname || userData.preferred_username || "User";
        const avatar = userData.picture || userData.avatar || null;

        // 3. Upsert User
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                nickname,
                avatar,
            },
            create: {
                email,
                nickname,
                avatar,
                source: "OAUTH",
            }
        });

        // 4. Create Session
        await login(user);

        // 5. Redirect
        return NextResponse.redirect(new URL(state, request.url));

    } catch (error) {
        console.error("Auth Callback Error:", error);
        return NextResponse.json({ error: "Internal Authentication Error" }, { status: 500 });
    }
}
