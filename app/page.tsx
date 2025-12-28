import { getSession } from "@/lib/auth";
import Link from "next/link";
import { Dashboard } from "./_components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="min-h-[80vh] flex flex-col items-center justify-center">
      {!session ? (
        <div className="max-w-2xl mx-auto px-6 py-12 text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">
              E3Car 企业账户自助兑换系统
            </h1>
            <p className="text-xl text-gray-600">
              自动开通 Office 365 E3 订阅，安全、快速、自助管理。
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
             <Link 
               href="/api/auth/login" 
               className="btn btn-primary px-8 py-3 text-lg shadow-lg hover:shadow-xl transition-all"
             >
               立即登录 / 注册
             </Link>
          </div>
          
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="p-6 bg-white rounded-xl border shadow-sm">
              <h3 className="font-semibold text-lg mb-2">自动开通</h3>
              <p className="text-gray-500">使用兑换码，系统自动为您创建企业子账号并分配许可。</p>
            </div>
            <div className="p-6 bg-white rounded-xl border shadow-sm">
              <h3 className="font-semibold text-lg mb-2">自助管理</h3>
              <p className="text-gray-500">随时查看订单状态，自主重置账号密码，无需人工干预。</p>
            </div>
             <div className="p-6 bg-white rounded-xl border shadow-sm">
              <h3 className="font-semibold text-lg mb-2">安全可靠</h3>
              <p className="text-gray-500">通过 OAuth 统一认证，保障您的账户与数据安全。</p>
            </div>
          </div>
        </div>
      ) : (
        <Dashboard user={session.user} />
      )}
    </main>
  );
}
