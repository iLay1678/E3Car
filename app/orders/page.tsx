import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import OrderList from "../_components/OrderList";

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?redirect=/orders");
  }

  const rawOrders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { inviteCode: true }
  });

  // Serialize Decimal to avoid Next.js serialization error if any
  const orders = rawOrders.map(o => ({
    ...o,
    amount: o.amount.toString(),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    inviteCode: o.inviteCode ? {
        ...o.inviteCode,
        createdAt: o.inviteCode.createdAt.toISOString(),
        usedAt: o.inviteCode.usedAt?.toISOString() || null,
    } : null
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">我的订单</h1>
          <a href="/buy" className="text-purple-600 text-sm hover:underline">继续购买 →</a>
      </div>
      
      <OrderList initialOrders={orders as any} />
    </div>
  );
}
