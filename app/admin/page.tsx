"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ConfigResponse = {
  hasConfig: boolean;
  clientId: string | null;
  hasSecret: boolean;
  licenseSkuId: string | null;
  
  authClientId: string | null;
  authClientSecret: string | null;
  authUrl: string | null;
  tokenUrl: string | null;
  userUrl: string | null;

  epayPid: string | null;
  epayKey: string | null;
  epayUrl: string | null;
  invitePrice: string | number | null;

  tenantId: string | null;
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
  source: string;
  owner?: {
      email: string;
      nickname?: string;
  } | null;
  enterpriseUser?: {
    userPrincipalName: string;
  } | null;
};

const INVITES_PER_PAGE = 10;
const ADMIN_ACCESS_REFRESH_INTERVAL_MS = 4 * 60 * 1000;
const GRAPH_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const GRAPH_TOKEN_MIN_REFRESH_MS = 60 * 1000;

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<"config" | "invites" | "users" | "orders">("config");
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [configForm, setConfigForm] = useState({
    clientId: "",
    clientSecret: "",
    licenseSkuId: "",
    authClientId: "",
    authClientSecret: "",
    authUrl: "",
    tokenUrl: "",
    userUrl: "",
    epayPid: "",
    epayKey: "",
    epayUrl: "",
    invitePrice: "",
    tenantId: ""
  });
  
  const [filterSource, setFilterSource] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteCount, setInviteCount] = useState(5);
  const [inviteCode, setInviteCode] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingSkus, setLoadingSkus] = useState(false);
  const [graphRefreshLoading, setGraphRefreshLoading] = useState(false);
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState<{ type: "delete" | "revoke"; code: string } | null>(null);
  
  const [users, setUsers] = useState<any[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);

  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  
  const unusedCodes = invites.filter((invite) => !invite.used).map((invite) => invite.code);
  const usedCodes = invites.filter((invite) => invite.used).map((invite) => invite.code);
  const totalPages = Math.max(1, Math.ceil(invites.length / INVITES_PER_PAGE));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safeCurrentPage - 1) * INVITES_PER_PAGE;
  const paginatedInvites = invites.slice(startIndex, startIndex + INVITES_PER_PAGE);
  const currentPageCodes = paginatedInvites.map((invite) => invite.code);
  const allCurrentSelected =
    currentPageCodes.length > 0 && currentPageCodes.every((code) => selectedCodes.includes(code));

  const fetchWithAuth = useCallback(
    async (input: RequestInfo | URL, initFactory?: () => RequestInit) => {
      const attempt = () => fetch(input, initFactory ? initFactory() : undefined);
      let res = await attempt();
      if (res.status !== 401) {
        return res;
      }
      const refreshRes = await fetch("/api/admin/token", { method: "POST" });
      if (!refreshRes.ok) {
        return res;
      }
      return attempt();
    },
    []
  );

  const fetchConfigAndInvites = useCallback(async () => {
    setError(null);
    const res = await fetchWithAuth("/api/admin/config");
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
    setConfigForm((prev) => ({
        ...prev,
        clientId: data.clientId ?? "",
        clientSecret: data.hasSecret ? prev.clientSecret : "", // Don't wipe if user typing, but here usually loading
        licenseSkuId: data.licenseSkuId ?? "",
        authClientId: data.authClientId ?? "",
        authClientSecret: data.authClientSecret ?? "",
        authUrl: data.authUrl ?? "",
        tokenUrl: data.tokenUrl ?? "",
        userUrl: data.userUrl ?? "",
        epayPid: data.epayPid ?? "",
        epayKey: data.epayKey ?? "",
        epayUrl: data.epayUrl ?? "",
        invitePrice: data.invitePrice?.toString() ?? "",
        tenantId: data.tenantId ?? ""
    }));

    const query = new URLSearchParams();
    if (filterSource !== "all") query.set("source", filterSource);
    if (filterStatus !== "all") query.set("status", filterStatus);

    const inviteRes = await fetchWithAuth(`/api/admin/invite?${query.toString()}`);
    if (inviteRes.status === 401) {
      setAuthed(false);
      return;
    }
    if (inviteRes.ok) {
      const inviteData = (await inviteRes.json()) as Invite[];
      setInvites(inviteData);
      setSelectedCodes([]);
    }
  }, [fetchWithAuth, filterSource, filterStatus]);

  const fetchUsers = useCallback(async (page: number) => {
    setLoading(true);
    const res = await fetchWithAuth(`/api/admin/users?page=${page}&limit=10`);
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      setUsersTotalPages(data.pagination.totalPages);
      setUsersPage(data.pagination.page);
    }
  }, [fetchWithAuth]);

  const fetchOrders = useCallback(async (page: number) => {
    setLoading(true);
    const res = await fetchWithAuth(`/api/admin/orders?page=${page}&limit=10`);
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders);
      setOrdersTotalPages(data.pagination.totalPages);
      setOrdersPage(data.pagination.page);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (authed) {
      if (activeTab === "config" || activeTab === "invites") {
        fetchConfigAndInvites();
      } else if (activeTab === "users") {
        fetchUsers(usersPage);
      } else if (activeTab === "orders") {
        fetchOrders(ordersPage);
      }
    }
  }, [fetchConfigAndInvites, fetchUsers, fetchOrders, authed, activeTab, usersPage, ordersPage]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!authed) {
      return;
    }
    let cancelled = false;
    async function refreshAdminAccessToken() {
      try {
        const res = await fetch("/api/admin/token", { method: "POST" });
        if (!res.ok) {
          throw new Error("Failed to refresh admin session");
        }
      } catch {
        if (!cancelled) {
          setAuthed(false);
          setError("后台登录已过期，请重新登录");
        }
      }
    }
    const intervalId = window.setInterval(
      refreshAdminAccessToken,
      ADMIN_ACCESS_REFRESH_INTERVAL_MS
    );
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [authed]);

  useEffect(() => {
    if (!authed || !config?.token) {
      return;
    }
    const expiresAt = new Date(config.token.expiresAt).getTime();
    const now = Date.now();
    const rawDelay = expiresAt - now - GRAPH_TOKEN_REFRESH_BUFFER_MS;
    const delay = rawDelay > 0 ? Math.max(GRAPH_TOKEN_MIN_REFRESH_MS, rawDelay) : GRAPH_TOKEN_MIN_REFRESH_MS;
    if (!Number.isFinite(delay) || Number.isNaN(delay)) {
      return;
    }
    const timeoutId = window.setTimeout(async () => {
      const res = await fetchWithAuth("/api/admin/graph-token", () => ({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true })
      }));
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Graph token 刷新失败");
        return;
      }
      fetchConfigAndInvites();
    }, delay);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authed, config?.token, fetchConfigAndInvites, fetchWithAuth]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
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
    // fetch handled by useEffect
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    const res = await fetchWithAuth("/api/admin/config", () => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(configForm)
    }));
    setLoading(false);
    if (res.status === 401) {
      setAuthed(false);
      setError("未授权");
      return;
    }
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
    const res = await fetchWithAuth("/api/admin/skus");
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

  async function handleRefreshGraphToken() {
    setGraphRefreshLoading(true);
    setError(null);
    const res = await fetchWithAuth("/api/admin/graph-token", () => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true })
    }));
    setGraphRefreshLoading(false);
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Graph token 刷新失败");
      return;
    }
    setMessage("Graph token 已刷新");
    fetchConfigAndInvites();
  }

  async function handleCreateCodes(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const res = await fetchWithAuth("/api/admin/invite", () => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: inviteCount })
    }));
    if (res.status === 401) {
      setAuthed(false);
      setError("未授权");
      return;
    }
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
    const res = await fetchWithAuth("/api/admin/invite", () => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: inviteCode })
    }));
    if (res.status === 401) {
      setAuthed(false);
      setError("未授权");
      return;
    }
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
    return handleDelete(code);
  }

  async function handleDelete(code: string) {
    setError(null);
    setMessage(null);
    const res = await fetchWithAuth(`/api/admin/invite?code=${code}&force=true`, () => ({
      method: "DELETE"
    }));
    if (res.status === 401) {
      setAuthed(false);
      setError("未授权");
      return;
    }
    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "删除失败");
      return;
    }
    setMessage("兑换码已删除");
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

  function toggleSelectAllCurrent() {
    if (!currentPageCodes.length) {
      setSelectedCodes([]);
      return;
    }
    if (allCurrentSelected) {
      setSelectedCodes((prev) => prev.filter((code) => !currentPageCodes.includes(code)));
      return;
    }
    setSelectedCodes((prev) => {
      const merged = new Set(prev);
      currentPageCodes.forEach((code) => merged.add(code));
      return Array.from(merged);
    });
  }

  async function handleCopySelected() {
    if (!selectedCodes.length) {
      setError("请先勾选要复制的兑换码");
      return;
    }
    setError(null);
    await handleCopy(selectedCodes.join("\n"));
  }

  async function handleCopyUnused() {
    if (!unusedCodes.length) {
      setError("没有未使用的兑换码");
      return;
    }
    setError(null);
    await handleCopy(unusedCodes.join("\n"));
  }

  async function handleCopyUsed() {
    if (!usedCodes.length) {
      setError("没有已使用的兑换码");
      return;
    }
    setError(null);
    await handleCopy(usedCodes.join("\n"));
  }

  async function handleDeleteAllUsed() {
    if (!usedCodes.length) {
      setError("没有可删除的已使用兑换码");
      return;
    }
    if (!confirm("确定要删除所有已使用的兑换码吗？")) {
      return;
    }
    setError(null);
    setMessage(null);
    for (const code of usedCodes) {
      const res = await fetchWithAuth(`/api/admin/invite?code=${code}&force=true`, () => ({
        method: "DELETE"
      }));
      if (res.status === 401) {
        setAuthed(false);
        setError("未授权");
        return;
      }
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "删除失败");
        return;
      }
    }
    setMessage("已删除所有已使用的兑换码");
    fetchConfigAndInvites();
  }

  return (
    <div className="space-y-8 px-4 py-6 sm:px-0">
      <h1 className="heading">管理后台</h1>

      {!authed && (
        <form
          onSubmit={handleLogin}
          className="card p-6 space-y-4 max-w-md mx-auto"
        >
          <div>
            <label htmlFor="adminPassword" className="block text-sm font-medium mb-1">后台密码</label>
            <input
              id="adminPassword"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            aria-busy={loading}
          >
            登录
          </button>
          {error && <p className="text-red-600 text-sm" role="alert" aria-live="polite">{error}</p>}
          {message && <p className="text-green-600 text-sm" role="status" aria-live="polite">{message}</p>}
        </form>
      )}

      {authed && (
        <>
          <div className="card p-2 sm:p-3 flex flex-wrap items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              className={`btn whitespace-nowrap ${activeTab === "config" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("config")}
            >
              配置与授权
            </button>
            <button
              type="button"
              className={`btn whitespace-nowrap ${activeTab === "invites" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("invites")}
            >
              兑换码管理
            </button>
            <button
              type="button"
              className={`btn whitespace-nowrap ${activeTab === "users" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("users")}
            >
              用户管理
            </button>
            <button
              type="button"
              className={`btn whitespace-nowrap ${activeTab === "orders" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("orders")}
            >
              订单管理
            </button>
          </div>
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded" role="alert" aria-live="polite">
              {error}
            </div>
          )}
          {(message || copyMessage) && (
            <div className="p-3 bg-green-100 text-green-700 rounded space-y-1" role="status" aria-live="polite">
              {message && <div>{message}</div>}
              {copyMessage && <div className="text-sm">{copyMessage}</div>}
            </div>
          )}

          {activeTab === "config" && (
          <section className="card p-6 space-y-8">
            <div>
                <h2 className="text-xl font-semibold mb-4">API & SKU 配置</h2>
                <form className="space-y-4" onSubmit={handleSaveConfig}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">MS Graph Client ID</label>
                        <input
                        className="input"
                        value={configForm.clientId}
                        onChange={(e) => setConfigForm({ ...configForm, clientId: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">MS Graph Secret</label>
                        <input
                        type="password"
                        className="input"
                        value={configForm.clientSecret}
                        onChange={(e) => setConfigForm({ ...configForm, clientSecret: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">MS Graph Tenant ID</label>
                        <input
                        className="input"
                        value={configForm.tenantId}
                        onChange={(e) => setConfigForm({ ...configForm, tenantId: e.target.value })}
                        placeholder="Common or GUID"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">OAuth Client ID</label>
                        <input
                        className="input"
                        value={configForm.authClientId}
                        onChange={(e) => setConfigForm({ ...configForm, authClientId: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">OAuth Secret</label>
                        <input
                        type="password"
                        className="input"
                        value={configForm.authClientSecret}
                        onChange={(e) => setConfigForm({ ...configForm, authClientSecret: e.target.value })}
                        />
                    </div>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Auth URL (Base)</label>
                        <input
                        className="input"
                        value={configForm.authUrl}
                        onChange={(e) => setConfigForm({ ...configForm, authUrl: e.target.value })}
                        placeholder="https://auth.example.com/authorize"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Token URL</label>
                        <input
                        className="input"
                        value={configForm.tokenUrl}
                        onChange={(e) => setConfigForm({ ...configForm, tokenUrl: e.target.value })}
                        placeholder="https://auth.example.com/token"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">User URL</label>
                        <input
                        className="input"
                        value={configForm.userUrl}
                        onChange={(e) => setConfigForm({ ...configForm, userUrl: e.target.value })}
                        placeholder="https://auth.example.com/userinfo"
                        />
                    </div>
                 </div>

                 <div className="border-t pt-4">
                    <h3 className="font-medium mb-3">支付配置 (EasyPay)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                            <label className="block text-sm font-medium mb-1">PID (Merchant ID)</label>
                            <input
                            className="input"
                            value={configForm.epayPid}
                            onChange={(e) => setConfigForm({ ...configForm, epayPid: e.target.value })}
                            />
                       </div>
                       <div>
                            <label className="block text-sm font-medium mb-1">Key (Secret)</label>
                            <input
                            type="password"
                            className="input"
                            value={configForm.epayKey}
                            onChange={(e) => setConfigForm({ ...configForm, epayKey: e.target.value })}
                            />
                       </div>
                       <div>
                            <label className="block text-sm font-medium mb-1">网关地址</label>
                            <input
                            className="input"
                            value={configForm.epayUrl}
                            onChange={(e) => setConfigForm({ ...configForm, epayUrl: e.target.value })}
                            placeholder="https://credit.linux.do/epay"
                            />
                       </div>
                       <div>
                            <label className="block text-sm font-medium mb-1">邀请码价格</label>
                            <input
                            className="input"
                            type="number"
                            step="0.01"
                            value={configForm.invitePrice}
                            onChange={(e) => setConfigForm({ ...configForm, invitePrice: e.target.value })}
                            />
                       </div>
                    </div>
                 </div>

                <div className="flex items-center gap-3 pt-4 border-t">
                    <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">自动分配 SKU</label>
                    <select
                        className="select"
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
                        className="btn btn-secondary whitespace-nowrap self-end mb-1"
                        onClick={handleFetchSkus}
                        disabled={loadingSkus || !config?.token}
                    >
                        {loadingSkus ? "加载中..." : "拉取 SKU"}
                    </button>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
                    <button
                    type="submit"
                    className="btn btn-primary w-full sm:w-auto"
                    disabled={loading}
                    aria-busy={loading ? "true" : "false"}
                    >
                    保存所有配置
                    </button>
                    <a
                    href="/api/admin/oauth/authorize"
                    className="btn bg-purple-600 hover:bg-purple-700 text-white text-center w-full sm:w-auto"
                    >
                    前往 MS Graph 管理员授权
                    </a>
                </div>

                {config && (
                  <div className="text-sm text-gray-700 space-y-1 mt-4 p-4 bg-gray-50 rounded">
                    <div>Graph Token 状态:</div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span>Token: {config.token ? "已存储" : "未获取"}</span>
                      <button
                        type="button"
                        className="btn btn-secondary w-full sm:w-auto"
                        onClick={handleRefreshGraphToken}
                        disabled={!config.token || graphRefreshLoading}
                      >
                        {graphRefreshLoading ? "刷新中..." : "手动刷新 Token"}
                      </button>
                    </div>
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
            </div>
          </section>
          )}

          {activeTab === "invites" && (
          <section className="card p-6 space-y-4">
            <h2 className="text-xl font-semibold">兑换码管理</h2>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded border">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">来源:</label>
                    <select 
                        className="select py-1 px-2 text-sm"
                        value={filterSource}
                        onChange={e => setFilterSource(e.target.value)}
                    >
                        <option value="all">全部</option>
                        <option value="MANUAL">手动创建</option>
                        <option value="PURCHASE">在线购买</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">状态:</label>
                    <select 
                         className="select py-1 px-2 text-sm"
                         value={filterStatus}
                         onChange={e => setFilterStatus(e.target.value)}
                    >
                        <option value="all">全部</option>
                        <option value="used">已使用</option>
                        <option value="unused">未使用</option>
                    </select>
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <form className="grid gap-3 sm:flex sm:items-end sm:gap-3" onSubmit={handleCreateCodes}>
                <div className="sm:w-40">
                  <label className="block text-sm font-medium mb-1">批量创建数量</label>
                  <input
                    type="number"
                    className="input"
                    value={inviteCount}
                    min={1}
                    onChange={(e) => setInviteCount(Number(e.target.value))}
                  />
                </div>
                <button className="btn btn-success w-full sm:w-auto" type="submit">
                  批量生成
                </button>
              </form>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={toggleSelectAllCurrent}
                  disabled={!paginatedInvites.length}
                >
                  {allCurrentSelected ? "取消本页全选" : "全选本页"}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCopySelected}
                  disabled={!selectedCodes.length}
                >
                  复制选中 ({selectedCodes.length})
                </button>
                <div className="relative" ref={moreMenuRef}>
                  <button
                    type="button"
                    className="btn btn-secondary w-full sm:w-auto"
                    onClick={() => setMoreMenuOpen((open) => !open)}
                    disabled={!invites.length}
                    aria-haspopup="menu"
                    aria-expanded={moreMenuOpen}
                  >
                    更多操作
                  </button>
                  {moreMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded border bg-white shadow-lg z-10">
                      <button
                        type="button"
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-white"
                        onClick={async () => {
                          setMoreMenuOpen(false);
                          await handleCopyUnused();
                        }}
                        disabled={!unusedCodes.length}
                      >
                        复制未使用 ({unusedCodes.length})
                      </button>
                      <button
                        type="button"
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-white"
                        onClick={async () => {
                          setMoreMenuOpen(false);
                          await handleCopyUsed();
                        }}
                        disabled={!usedCodes.length}
                      >
                        复制已使用 ({usedCodes.length})
                      </button>
                      <button
                        type="button"
                        className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-white"
                        onClick={async () => {
                          setMoreMenuOpen(false);
                          await handleDeleteAllUsed();
                        }}
                        disabled={!usedCodes.length}
                      >
                        删除所有已使用
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
              <form className="grid gap-3 sm:flex sm:items-end sm:gap-3" onSubmit={handleCreateSingle}>
                <div className="sm:flex-1">
                  <label htmlFor="singleCode" className="block text-sm font-medium mb-1">指定兑换码</label>
                  <input
                    className="input"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    id="singleCode"
                  />
                </div>
                <button className="btn btn-primary w-full sm:w-auto" type="submit">
                  创建
                </button>
              </form>

            {invites.length === 0 && (
              <div className="p-6 bg-gray-50 border rounded text-sm text-gray-700">暂无兑换码，先在上方创建或批量生成。</div>
            )}
            <div className="overflow-x-auto -mx-4 sm:mx-0 hidden sm:block">
              <div className="min-w-[640px] sm:min-w-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 px-2">
                          <input
                            type="checkbox"
                            checked={allCurrentSelected}
                            onChange={toggleSelectAllCurrent}
                            disabled={!paginatedInvites.length}
                          />
                      </th>
                      <th className="py-2 px-2">兑换码</th>
                      <th className="py-2 px-2">状态</th>
                      <th className="py-2 px-2">来源</th>
                      <th className="py-2 px-2">创建时间</th>
                      <th className="py-2 px-2">使用时间</th>
                      <th className="py-2 px-2">企业账户</th>
                      <th className="py-2 px-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvites.map((invite) => (
                      <tr key={invite.id} className="border-b odd:bg-gray-50">
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
                        <td className="py-2 px-2">
                          <span className={`${invite.used ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"} inline-block px-2 py-1 rounded text-xs`}>
                            {invite.used ? "已使用" : "未使用"}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                           <span className={`text-xs px-2 py-1 rounded ${invite.source === 'PURCHASE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-600'}`}>
                             {invite.source === "PURCHASE" ? "购买" : "手动"} {invite.owner && `(${invite.owner.nickname || invite.owner.email})`}
                           </span>
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-500">
                          {new Date(invite.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 px-2">
                          {invite.usedAt ? new Date(invite.usedAt).toLocaleString() : "-"}
                        </td>
                        <td className="py-2 px-2">
                          {invite.enterpriseUser?.userPrincipalName ? (
                            <span className="inline-block px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                              {invite.enterpriseUser.userPrincipalName}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {!invite.used ? (
                            <button
                              className="text-red-600 hover:underline"
                              onClick={() => {
                                if (confirm("确定要作废该兑换码吗？")) {
                                  handleDelete(invite.code);
                                }
                              }}
                            >
                              作废
                            </button>
                          ) : (
                            <button
                              className="text-red-600 hover:underline"
                              onClick={() => setConfirming({ type: "delete", code: invite.code })}
                            >
                              删除
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="sm:hidden space-y-3">
              {paginatedInvites.map((invite) => (
                <div key={invite.id} className="border rounded p-3 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="font-mono text-sm text-left hover:underline break-words"
                      onClick={() => handleCopy(invite.code)}
                    >
                      {invite.code}
                    </button>
                    {!invite.used && (
                      <button
                        className="text-red-600 text-sm"
                        onClick={() => {
                          if (confirm("确定要作废该兑换码吗？")) {
                            handleDelete(invite.code);
                          }
                        }}
                      >
                        作废
                      </button>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-700 space-y-1">
                    <div>状态：{invite.used ? "已使用" : "未使用"}</div>
                    <div>来源：{invite.source === "PURCHASE" ? "购买" : "手动"}</div>
                    <div>创建：{new Date(invite.createdAt).toLocaleString()}</div>
                    <div>使用：{invite.usedAt ? new Date(invite.usedAt).toLocaleString() : "-"}</div>
                    <div>企业账户：{invite.enterpriseUser?.userPrincipalName || "-"}</div>
                  </div>
                  <div className="mt-2">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedCodes.includes(invite.code)}
                        onChange={() => toggleSelect(invite.code)}
                      />
                      选择
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {invites.length > INVITES_PER_PAGE && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t pt-4">
                <p className="text-sm text-gray-600">
                  第 {safeCurrentPage} / {totalPages} 页，共 {invites.length} 条记录
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded border text-sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={safeCurrentPage === 1}
                  >
                    上一页
                  </button>
                  <select
                    className="select w-32"
                    value={safeCurrentPage}
                    onChange={(e) => setCurrentPage(Number(e.target.value))}
                  >
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNumber) => (
                      <option key={pageNumber} value={pageNumber}>
                        第 {pageNumber} 页
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="px-3 py-2 rounded border text-sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={safeCurrentPage === totalPages}
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </section>
          )}

          {activeTab === "users" && (
            <section className="card p-6 space-y-6">
              <h2 className="text-xl font-semibold">用户管理</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="py-2 px-4">ID</th>
                      <th className="py-2 px-4">昵称</th>
                      <th className="py-2 px-4">邮箱</th>
                      <th className="py-2 px-4">加入时间</th>
                      <th className="py-2 px-4 text-center">订单/兑换</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4 text-gray-500">{u.id}</td>
                        <td className="py-2 px-4 font-medium">{u.nickname || "N/A"}</td>
                        <td className="py-2 px-4">{u.email}</td>
                        <td className="py-2 px-4 text-gray-500">{new Date(u.createdAt).toLocaleString()}</td>
                        <td className="py-2 px-4 text-center">
                          {u._count.orders} / {u._count.invites}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {usersTotalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                   <button disabled={usersPage <= 1} onClick={() => setUsersPage(p => p - 1)} className="btn btn-secondary px-3 py-1">上一页</button>
                   <span className="flex items-center text-sm font-medium">{usersPage} / {usersTotalPages}</span>
                   <button disabled={usersPage >= usersTotalPages} onClick={() => setUsersPage(p => p + 1)} className="btn btn-secondary px-3 py-1">下一页</button>
                </div>
              )}
            </section>
          )}

          {activeTab === "orders" && (
            <section className="card p-6 space-y-6">
              <h2 className="text-xl font-semibold">订单管理</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="py-2 px-4">商户单号</th>
                      <th className="py-2 px-4">金额</th>
                      <th className="py-2 px-4">状态</th>
                      <th className="py-2 px-4">下单用户</th>
                      <th className="py-2 px-4">兑换码</th>
                      <th className="py-2 px-4">下单时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4 font-mono">{o.tradeNo}</td>
                        <td className="py-2 px-4">¥{Number(o.amount).toFixed(2)}</td>
                        <td className="py-2 px-4">
                           <span className={`px-2 py-1 rounded text-xs ${o.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {o.status === 'PAID' ? '已支付' : o.status}
                           </span>
                        </td>
                        <td className="py-2 px-4">
                          <div className="text-sm font-medium">{o.user.nickname}</div>
                          <div className="text-xs text-gray-500">{o.user.email}</div>
                        </td>
                        <td className="py-2 px-4">
                           {o.inviteCode ? (
                             <div className="flex items-center gap-1">
                               <span className="font-mono text-xs">{o.inviteCode.code}</span>
                               <span className={`px-1 rounded-[2px] text-[10px] ${o.inviteCode.used ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-600'}`}>
                                 {o.inviteCode.used ? '已用' : '未用'}
                               </span>
                             </div>
                           ) : "-"}
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-500">{new Date(o.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
               {ordersTotalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                   <button disabled={ordersPage <= 1} onClick={() => setOrdersPage(p => p - 1)} className="btn btn-secondary px-3 py-1">上一页</button>
                   <span className="flex items-center text-sm font-medium">{ordersPage} / {ordersTotalPages}</span>
                   <button disabled={ordersPage >= ordersTotalPages} onClick={() => setOrdersPage(p => p + 1)} className="btn btn-secondary px-3 py-1">下一页</button>
                </div>
              )}
            </section>
          )}
          {confirming && (
            <div className="modal-overlay" role="dialog" aria-modal="true">
              <div className="modal">
                <div className="text-lg font-semibold mb-2">
                  {confirming.type === "revoke" ? "作废兑换码" : "删除兑换码"}
                </div>
                <p className="text-sm text-gray-700">
                  {confirming.type === "revoke"
                    ? "确定要作废该兑换码吗？作废后无法使用。"
                    : "确定要删除该兑换码吗？该操作不可恢复。"}
                </p>
                <p className="mt-2 font-mono text-sm">{confirming.code}</p>
                <div className="mt-4 flex gap-2 justify-end">
                  <button className="btn btn-secondary" onClick={() => setConfirming(null)}>取消</button>
                  <button
                    className="btn btn-danger"
                    onClick={async () => {
                      if (confirming.type === "revoke") {
                        await handleRevoke(confirming.code);
                      } else {
                        await handleDelete(confirming.code);
                      }
                      setConfirming(null);
                    }}
                  >
                    {confirming.type === "revoke" ? "作废" : "删除"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
