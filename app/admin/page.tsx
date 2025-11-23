"use client";

import { useEffect, useState } from "react";

type ConfigResponse = {
  hasConfig: boolean;
  clientId: string | null;
  hasSecret: boolean;
  licenseSkuId: string | null;
  updatedAt: string | null;
  token: {
    expiresAt: string;
    expired: boolean;
    scope?: string | null;
    tokenLength: number;
  } | null;
};

type Invite = {
  id: number;
  code: string;
  used: boolean;
  usedAt: string | null;
  createdAt: string;
  enterpriseUser?: {
    userPrincipalName: string;
  } | null;
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [configForm, setConfigForm] = useState({
    clientId: "",
    clientSecret: "",
    licenseSkuId: ""
  });
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteCount, setInviteCount] = useState(5);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSkus, setLoadingSkus] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skus, setSkus] = useState<
    Array<{
      skuId: string;
      name: string;
      capabilityStatus: string;
      consumedUnits: number;
      enabled: number;
      servicePlans: Array<{ name: string; status: string }>;
    }>
  >([]);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  async function fetchConfigAndInvites() {
    setError(null);
    const res = await fetch("/api/admin/config");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    if (!res.ok) {
      setError("加载配置失败");
      return;
    }
    const data: ConfigResponse = await res.json();
    setAuthed(true);
    setConfig(data);
    if (data.clientId) {
      setConfigForm((prev) => ({
        ...prev,
        clientId: data.clientId ?? "",
        licenseSkuId: data.licenseSkuId ?? ""
      }));
    }

    const inviteRes = await fetch("/api/admin/invite");
    if (inviteRes.ok) {
      const inviteData = (await inviteRes.json()) as Invite[];
      setInvites(inviteData);
      setSelectedCodes([]);
    }
  }

  useEffect(() => {
    fetchConfigAndInvites();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "登录失败");
      return;
    }
    setAuthed(true);
    setMessage("登录成功");
    fetchConfigAndInvites();
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(configForm)
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "保存失败");
      return;
    }
    setMessage("配置已保存");
    fetchConfigAndInvites();
  }

  async function handleFetchSkus() {
    setLoadingSkus(true);
    setError(null);
    const res = await fetch("/api/admin/skus");
    setLoadingSkus(false);
    if (res.status === 401) {
      setAuthed(false);
      setError("未授权");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "获取订阅 SKU 失败");
      return;
    }
    const body = (await res.json()) as {
      skus: Array<{
        skuId: string;
        name: string;
        capabilityStatus: string;
        consumedUnits: number;
        enabled: number;
        servicePlans: Array<{ name: string; status: string }>;
      }>;
    };
    setSkus(body.skus);
  }

  async function handleCreateCodes(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: inviteCount })
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "创建失败");
      return;
    }
    const body = await res.json();
    setMessage(`已创建兑换码：${body.codes.join(", ")}`);
    fetchConfigAndInvites();
  }

  async function handleCreateSingle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: inviteCode })
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "创建失败");
      return;
    }
    setInviteCode("");
    setMessage("兑换码已创建");
    fetchConfigAndInvites();
  }

  async function handleRevoke(code: string) {
    const res = await fetch(`/api/admin/invite?code=${code}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "作废失败");
      return;
    }
    setMessage("兑换码已作废");
    fetchConfigAndInvites();
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(`已复制：${text}`);
      setTimeout(() => setCopyMessage(null), 2000);
    } catch (err) {
      setError("复制失败，请手动选择复制");
    }
  }

  function toggleSelect(code: string) {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function toggleSelectAll() {
    if (selectedCodes.length === invites.length) {
      setSelectedCodes([]);
    } else {
      setSelectedCodes(invites.map((i) => i.code));
    }
  }

  async function handleCopySelected() {
    if (!selectedCodes.length) {
      setError("请先勾选要复制的兑换码");
      return;
    }
    await handleCopy(selectedCodes.join("\n"));
  }

  return (
    <div className="space-y-8 px-4 py-6 sm:px-0">
      <h1 className="text-3xl font-bold">Admin Panel</h1>

      {!authed && (
        <form
          onSubmit={handleLogin}
          className="bg-white shadow p-6 rounded space-y-4 max-w-md mx-auto border border-gray-100"
        >
          <div>
            <label className="block text-sm font-medium mb-1">后台密码</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            disabled={loading}
          >
            登录
          </button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}
        </form>
      )}

      {authed && (
        <>
          {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}
          {(message || copyMessage) && (
            <div className="p-3 bg-green-100 text-green-700 rounded space-y-1">
              {message && <div>{message}</div>}
              {copyMessage && <div className="text-sm">{copyMessage}</div>}
            </div>
          )}

          <section className="bg-white shadow p-6 rounded">
            <h2 className="text-xl font-semibold mb-4">Graph 应用配置</h2>
            <form className="space-y-4" onSubmit={handleSaveConfig}>
              <div>
                <label className="block text-sm font-medium mb-1">Client ID</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={configForm.clientId}
                  onChange={(e) => setConfigForm({ ...configForm, clientId: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Client Secret</label>
                <input
                  type="password"
                  className="w-full border rounded px-3 py-2"
                  value={configForm.clientSecret}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, clientSecret: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">自动分配 SKU</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={configForm.licenseSkuId}
                    onChange={(e) => setConfigForm({ ...configForm, licenseSkuId: e.target.value })}
                  >
                    <option value="">不自动分配</option>
                    {skus.map((sku) => (
                      <option key={sku.skuId} value={sku.skuId}>
                        {sku.name} ({sku.consumedUnits}/{sku.enabled || "∞"}) {sku.capabilityStatus}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    从订阅 SKU 中选择（如 Office 365 E3: ENTERPRISEPACK）。未选择则跳过授权。
                  </p>
                </div>
                <button
                  type="button"
                  className="whitespace-nowrap bg-gray-200 px-3 py-2 rounded text-sm"
                  onClick={handleFetchSkus}
                  disabled={loadingSkus || !config?.token}
                >
                  {loadingSkus ? "加载中..." : "拉取 SKU"}
                </button>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full sm:w-auto"
                  disabled={loading}
                >
                  保存配置
                </button>
                <a
                  href="/api/admin/oauth/authorize"
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-center w-full sm:w-auto"
                >
                  前往管理员授权
                </a>
              </div>
              {config && (
                <div className="text-sm text-gray-700 space-y-1">
                  <div>已保存配置: {config.hasConfig ? "是" : "否"}</div>
                  <div>Token: {config.token ? "已存储" : "未获取"}</div>
                  {config.token && (
                    <ul className="list-disc ml-5">
                      <li>长度 {config.token.tokenLength}</li>
                      <li>过期时间 {new Date(config.token.expiresAt).toLocaleString()}</li>
                      <li>{config.token.expired ? "已过期" : "未过期"}</li>
                    </ul>
                  )}
                </div>
              )}
            </form>
          </section>

          <section className="bg-white shadow p-6 rounded space-y-4">
            <h2 className="text-xl font-semibold">兑换码管理</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <form className="grid gap-3 sm:flex sm:items-end sm:gap-3" onSubmit={handleCreateCodes}>
                <div className="sm:w-40">
                  <label className="block text-sm font-medium mb-1">批量创建数量</label>
                  <input
                    type="number"
                    className="border rounded px-3 py-2 w-full"
                    value={inviteCount}
                    min={1}
                    onChange={(e) => setInviteCount(Number(e.target.value))}
                  />
                </div>
                <button className="bg-green-600 text-white px-4 py-2 rounded w-full sm:w-auto" type="submit">
                  批量生成
                </button>
              </form>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="bg-gray-100 text-gray-800 px-3 py-2 rounded text-sm"
                  onClick={toggleSelectAll}
                >
                  {selectedCodes.length === invites.length ? "取消全选" : "全选"}
                </button>
                <button
                  type="button"
                  className="bg-blue-600 text-white px-3 py-2 rounded text-sm"
                  onClick={handleCopySelected}
                  disabled={!selectedCodes.length}
                >
                  复制选中 ({selectedCodes.length})
                </button>
              </div>
            </div>
            <form className="grid gap-3 sm:flex sm:items-end sm:gap-3" onSubmit={handleCreateSingle}>
              <div className="sm:flex-1">
                <label className="block text-sm font-medium mb-1">指定兑换码</label>
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                />
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded w-full sm:w-auto" type="submit">
                创建
              </button>
            </form>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[640px] sm:min-w-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={selectedCodes.length === invites.length && invites.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="py-2 px-2">兑换码</th>
                      <th className="py-2 px-2">状态</th>
                      <th className="py-2 px-2">使用时间</th>
                      <th className="py-2 px-2">企业账户</th>
                      <th className="py-2 px-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((invite) => (
                      <tr key={invite.id} className="border-b">
                        <td className="py-2 px-2">
                          <input
                            type="checkbox"
                            checked={selectedCodes.includes(invite.code)}
                            onChange={() => toggleSelect(invite.code)}
                          />
                        </td>
                        <td className="py-2 px-2 font-mono break-words">
                          <button
                            type="button"
                            className="text-left w-full hover:underline"
                            onClick={() => handleCopy(invite.code)}
                          >
                            {invite.code}
                          </button>
                        </td>
                        <td className="py-2 px-2">{invite.used ? "已使用" : "未使用"}</td>
                        <td className="py-2 px-2">
                          {invite.usedAt ? new Date(invite.usedAt).toLocaleString() : "-"}
                        </td>
                        <td className="py-2 px-2">
                          {invite.enterpriseUser?.userPrincipalName || "-"}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {!invite.used && (
                            <button
                              className="text-red-600 hover:underline"
                              onClick={() => handleRevoke(invite.code)}
                            >
                              作废
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
