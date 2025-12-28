"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image"; // Optimization

export function Dashboard({ user }: { user: any }) {
  const router = useRouter();

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* User Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-2xl font-bold text-purple-600 uppercase overflow-hidden">
             {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt={user.nickname} /> : user.nickname?.[0] || user.email[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user.nickname || "User"}</h2>
            <p className="text-gray-500">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-3">
           <Link href="/orders" className="btn bg-white border border-gray-200 hover:bg-gray-50 text-gray-700">
             我的订单
           </Link>
           <a href="/api/auth/logout" className="btn bg-white border border-gray-200 hover:bg-red-50 text-red-600 hover:border-red-100">
             退出登录
           </a>
        </div>
      </div>

       {/* Action Grid */}
       <div className="grid md:grid-cols-2 gap-6">
          {/* Buy Card */}
          <div className="card p-6 flex flex-col items-start gap-4 hover:shadow-md transition-shadow">
             <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
             </div>
             <div>
               <h3 className="text-lg font-bold">购买兑换码</h3>
               <p className="text-gray-500 text-sm mt-1">获取新的 E3 订阅邀请码，支持多种支付方式。</p>
             </div>
             <Link href="/buy" className="btn btn-primary w-full justify-center mt-auto">
               立即购买
             </Link>
          </div>

           {/* Orders Card */}
          <div className="card p-6 flex flex-col items-start gap-4 hover:shadow-md transition-shadow">
             <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center text-green-600 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
             </div>
             <div>
               <h3 className="text-lg font-bold">历史订单</h3>
               <p className="text-gray-500 text-sm mt-1">查看已购买的兑换码详情及使用状态。</p>
             </div>
             <Link href="/orders" className="btn bg-white border border-gray-200 text-gray-700 w-full justify-center mt-auto hover:bg-gray-50">
               查看记录
             </Link>
          </div>
       </div>

       {/* Redeem Section */}
       <div className="space-y-6">
          <div className="flex items-center gap-2">
             <h3 className="text-xl font-bold">兑换激活</h3>
             <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">已有兑换码？</span>
          </div>
          
          <RedeemTabs />
       </div>
    </div>
  );
}

function RedeemTabs() {
  const [tab, setTab] = useState<"redeem" | "reset">("redeem");

  return (
    <div className="card overflow-hidden">
       <div className="flex border-b">
         <button 
           onClick={() => setTab("redeem")}
           className={`flex-1 py-4 text-sm font-medium transition-colors ${tab === "redeem" ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50/50" : "text-gray-500 hover:bg-gray-50"}`}
         >
           新开账户
         </button>
         <button 
           onClick={() => setTab("reset")}
           className={`flex-1 py-4 text-sm font-medium transition-colors ${tab === "reset" ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50/50" : "text-gray-500 hover:bg-gray-50"}`}
         >
           重置密码
         </button>
       </div>
       <div className="p-6">
         {tab === "redeem" ? <RedeemForm /> : <ResetForm />}
       </div>
    </div>
  );
}

function RedeemForm() {
    const [displayName, setDisplayName] = useState("");
    const [localPart, setLocalPart] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/redeem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayName, localPart, inviteCode })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    if (result) {
        return (
            <div className="space-y-4 bg-green-50 p-6 rounded-lg border border-green-200">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-2xl">✓</div>
                    <h4 className="text-lg font-bold text-green-800">开通成功</h4>
                </div>
                <div className="grid gap-3 text-sm">
                    <div className="flex justify-between p-3 bg-white rounded border border-green-100">
                        <span className="text-gray-500">账号</span>
                        <span className="font-mono font-medium select-all">{result.userPrincipalName}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-white rounded border border-green-100">
                        <span className="text-gray-500">密码</span>
                        <span className="font-mono font-medium select-all">{result.password}</span>
                    </div>
                </div>
                <button onClick={() => setResult(null)} className="btn btn-outline w-full text-green-700 border-green-300 hover:bg-green-100">
                    继续兑换
                </button>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto">
            <div>
                <label className="label">显示名</label>
                <input required className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Zhang San" />
            </div>
            <div>
                <label className="label">前缀 (可选)</label>
                <input className="input" value={localPart} onChange={e => setLocalPart(e.target.value)} placeholder="Leave empty to auto-generate" />
            </div>
             <div>
                <label className="label">兑换码</label>
                <input required className="input" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Enter your 20-char code" />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button disabled={loading} className="btn btn-primary w-full py-3">
                {loading ? "正在开通..." : "立即开通"}
            </button>
        </form>
    )
}

function ResetForm() {
    const [userPrincipalName, setUserPrincipalName] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

     async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userPrincipalName, inviteCode })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");
            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

     if (result) {
        return (
            <div className="space-y-4 bg-green-50 p-6 rounded-lg border border-green-200">
                <div className="text-center space-y-2">
                     <h4 className="text-lg font-bold text-green-800">密码已重置</h4>
                </div>
                 <div className="flex justify-between p-3 bg-white rounded border border-green-100 text-sm">
                        <span className="text-gray-500">新密码</span>
                        <span className="font-mono font-medium select-all">{result.password}</span>
                 </div>
                <button onClick={() => setResult(null)} className="btn btn-outline w-full text-green-700 border-green-300 hover:bg-green-100">
                    返回
                </button>
            </div>
        )
    }

    return (
         <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto">
            <div>
                <label className="label">企业账号</label>
                <input required className="input" value={userPrincipalName} onChange={e => setUserPrincipalName(e.target.value)} placeholder="user@domain.com" />
            </div>
             <div>
                <label className="label">兑换码</label>
                <input required className="input" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="The code used to create this account" />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button disabled={loading} className="btn btn-primary w-full py-3">
                {loading ? "重置密码" : "确认重置"}
            </button>
        </form>
    )
}
