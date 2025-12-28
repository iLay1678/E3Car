import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Not authenticated", authenticated: false }, { status: 401 });
    }
    return NextResponse.json({
        authenticated: true,
        user: session.user
    });
}
