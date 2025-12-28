"use client";

import React from "react";

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="card p-8 w-full max-w-md text-center space-y-6 shadow-xl">
        <h1 className="text-2xl font-bold text-gray-800">登录账号</h1>
        <p className="text-gray-500">
          为了您的账户安全及订单管理，请先登录。
        </p>
        <a 
          href="/api/auth/login" 
          className="btn btn-primary w-full block py-3 text-lg font-medium transition-transform hover:scale-105"
        >
          前往认证登录
        </a>
      </div>
    </div>
  );
}
