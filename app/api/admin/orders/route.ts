import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        await requireAdminSession();
    } catch (err) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * pageSize;

    try {
        const [total, orders] = await Promise.all([
            prisma.order.count(),
            prisma.order.findMany({
                take: pageSize,
                skip,
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: {
                            email: true,
                            nickname: true
                        }
                    },
                    inviteCode: {
                        select: {
                            code: true,
                            used: true
                        }
                    }
                }
            })
        ]);

        return NextResponse.json({
            orders,
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error("List orders error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
