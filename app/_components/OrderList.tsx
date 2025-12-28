"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Order {
    id: number;
    tradeNo: string;
    amount: any;
    status: string;
    createdAt: string;
    inviteCode?: {
        code: string;
        used: boolean;
        usedAt: string | null;
    } | null;
}

export default function OrderList({ initialOrders }: { initialOrders: Order[] }) {
    const [orders, setOrders] = useState(initialOrders);
    const [checking, setChecking] = useState<string | null>(null);
    const [paying, setPaying] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        // Auto check if returning from payment with a specific trade no
        // e.g. /orders?check=ORD...
        const checkTradeNo = searchParams.get("check");
        if (checkTradeNo) {
            handleCheckStatus(checkTradeNo);
        }
    }, [searchParams]);

    async function handleCheckStatus(tradeNo: string) {
        setChecking(tradeNo);
        try {
            const res = await fetch("/api/pay/check", {
                method: "POST",
                body: JSON.stringify({ out_trade_no: tradeNo }),
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            if (data.status === "PAID") {
                // Update local status
                setOrders(prev => prev.map(o => o.tradeNo === tradeNo ? { ...o, ...data.order } : o));
            } else if (data.msg) {
                alert(data.msg);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setChecking(null);
        }
    }

    async function handlePayNow(tradeNo: string) {
        setPaying(tradeNo);
        try {
            const res = await fetch("/api/pay/submit", { 
                method: "POST",
                body: JSON.stringify({ out_trade_no: tradeNo }), // API needs support for existing order
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            if (data.url && data.params) {
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = data.url;
                for (const [key, value] of Object.entries(data.params)) {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = key;
                    input.value = String(value);
                    form.appendChild(input);
                }
                document.body.appendChild(form);
                form.submit();
            } else {
                alert(data.error || "支付跳转失败");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setPaying(null);
        }
    }

    return (
        <div className="space-y-4">
            {orders.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-lg text-gray-500">
                    暂无订单
                </div>
            ) : (
                orders.map((order) => (
                    <div key={order.id} className="card p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div className="flex-1">
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
                            
                            {order.inviteCode && (
                                <div className="mt-3 p-2 bg-gray-50 rounded border border-dashed">
                                    <div className="text-xs text-gray-400 mb-1">您的邀请码：</div>
                                    <div className="font-mono font-bold text-lg select-all text-purple-700">
                                        {order.inviteCode.code}
                                    </div>
                                    {order.inviteCode.used && (
                                        <div className="text-[10px] text-green-600 mt-1">
                                            已于 {new Date(order.inviteCode.usedAt!).toLocaleString()} 使用
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:items-end gap-2 shrink-0">
                            <div className="font-semibold text-lg">
                                ¥{Number(order.amount).toFixed(2)}
                            </div>
                            
                            <div className="flex gap-2">
                                {order.status === "PENDING" && (
                                    <>
                                        <button 
                                            onClick={() => handlePayNow(order.tradeNo)}
                                            disabled={paying === order.tradeNo}
                                            className="btn btn-primary px-3 py-1 text-sm"
                                        >
                                            {paying === order.tradeNo ? "跳转中..." : "去支付"}
                                        </button>
                                        <button 
                                            onClick={() => handleCheckStatus(order.tradeNo)}
                                            disabled={checking === order.tradeNo}
                                            className="btn btn-secondary px-3 py-1 text-sm"
                                        >
                                            {checking === order.tradeNo ? "检查中..." : "检查状态"}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
