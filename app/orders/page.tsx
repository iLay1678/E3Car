import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?redirect=/orders");
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { inviteCode: true } // Include the code if generated
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">我的订单</h1>
      
      <div className="space-y-4">
        {orders.length === 0 ? (
           <div className="text-center py-10 bg-gray-50 rounded-lg text-gray-500">
             暂无订单
           </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="card p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
               <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-gray-500">{order.tradeNo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                        order.status === "PAID" ? "bg-green-100 text-green-700" : 
                        order.status === "PENDING" ? "bg-yellow-100 text-yellow-700" : 
                        "bg-gray-100 text-gray-600"
                    }`}>
                        {order.status === "PAID" ? "已支付" : order.status === "PENDING" ? "待支付" : "已失效"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </div>
               </div>

               <div className="flex-1 sm:text-right">
                  {order.inviteCode ? (
                      <div className="text-right">
                          <div className="text-sm text-gray-500 mb-1">兑换码</div>
                          <div className="font-mono font-bold text-lg select-all bg-gray-50 px-2 py-1 rounded inline-block border">
                              {order.inviteCode.code}
                          </div>
                          <div className="mt-1">
                              {order.inviteCode.used ? (
                                  <span className="text-xs text-green-600">
                                      已使用 ({new Date(order.inviteCode.usedAt!).toLocaleString()})
                                  </span>
                              ) : (
                                  <span className="text-xs text-gray-500">未使用</span>
                              )}
                          </div>
                      </div>
                  ) : order.status === "PAID" ? (
                      <span className="text-red-500 text-sm">发货失败，请联系管理员</span>
                  ) : (
                      <div className="text-sm text-gray-400">待支付</div>
                  )}
               </div>
               
               <div className="font-semibold text-lg">
                   ¥{Number(order.amount).toFixed(2)}
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
