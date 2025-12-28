"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function BuyPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handlePurchase() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pay/submit", { method: "POST" });
      const data = await res.json();
      
      if (res.status === 401) {
        router.push("/login?redirect=/buy");
        return;
      }
      
      if (!res.ok) {
        throw new Error(data.error || "创建订单失败");
      }

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
      }
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="card max-w-lg mx-auto p-8 space-y-6">
        <h1 className="text-2xl font-bold text-center">购买邀请码</h1>
        
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-gray-600">商品名称</span>
                <span className="font-semibold">E3 订阅邀请码</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-gray-600">价格</span>
                <span className="text-xl font-bold text-purple-600">Checking...</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
                * 购买后立即自动发货，可在“我的订单”中查看。
            </p>
        </div>

        {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded text-sm">
                {error}
            </div>
        )}

        <button
            onClick={handlePurchase}
            disabled={loading}
            className="btn btn-primary w-full py-3 text-lg"
        >
            {loading ? "正在跳转支付..." : "立即购买"}
        </button>
      </div>
    </div>
  );
}
