import { logout } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST() {
    await logout();
    return NextResponse.json({ success: true });
}

export async function GET(request: Request) { // Support GET for link based logout
    const { searchParams } = new URL(request.url);
    const redirect = searchParams.get("redirect") || "/";
    await logout();
    return NextResponse.redirect(new URL(redirect, request.url));
}
