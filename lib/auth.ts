import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";

const SECRET_KEY = process.env.AUTH_SECRET || "default_dev_secret_please_change";
const key = new TextEncoder().encode(SECRET_KEY);

export type Session = {
    user: {
        id: number;
        email: string;
        nickname?: string | null;
        avatar?: string | null;
    };
    expires: Date;
};

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(key);
}

export async function decrypt(input: string): Promise<any> {
    const { payload } = await jwtVerify(input, key, {
        algorithms: ["HS256"],
    });
    return payload;
}

export async function getSession(): Promise<Session | null> {
    const session = cookies().get("session")?.value;
    if (!session) return null;
    try {
        return await decrypt(session);
    } catch (error) {
        return null;
    }
}

export async function login(user: { id: number; email: string; nickname?: string | null; avatar?: string | null }) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await encrypt({ user, expires });

    cookies().set("session", session, { expires, httpOnly: true });
}

export async function logout() {
    cookies().set("session", "", { expires: new Date(0) });
}

export async function updateSession(request: NextRequest) {
    const session = request.cookies.get("session")?.value;
    if (!session) return; // No session, nothing to refresh

    // Refresh logic if needed, for now just returning response
    const parsed = await decrypt(session);
    parsed.expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const res = NextResponse.next();
    res.cookies.set({
        name: "session",
        value: await encrypt(parsed),
        httpOnly: true,
        expires: parsed.expires,
    });
    return res;
}

// OAuth Helpers
export async function getOAuthConfig() {
    const config = await prisma.appConfig.findFirst();
    if (!config) throw new Error("AppConfig not found");
    return {
        clientId: config.authClientId,
        clientSecret: config.authClientSecret,
        authUrl: config.authUrl,
        tokenUrl: config.tokenUrl,
        userUrl: config.userUrl,
    };
}
