import { getOAuthConfig } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const config = await getOAuthConfig();

        if (!config.clientId || !config.authUrl || !config.tokenUrl || !config.userUrl) {
            return NextResponse.json({ error: "OAuth configuration incomplete in System Settings" }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const redirectUrl = searchParams.get("redirect") || "/";

        const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/callback`;

        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: callbackUrl,
            response_type: "code",
            scope: "openid profile email", // Standard scopes, adjust if needed
            state: redirectUrl, // Pass redirect URL as state to redirect back after login
        });

        return NextResponse.redirect(`${config.authUrl}?${params.toString()}`);
    } catch (error) {
        console.error("Login Error:", error);
        return NextResponse.json({ error: "Failed to initiate login" }, { status: 500 });
    }
}
