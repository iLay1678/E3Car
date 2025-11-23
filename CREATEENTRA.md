# 创建并配置 Entra 应用指南

## 1) Azure Portal 创建应用
- 路径：Microsoft Entra ID → 应用注册 → 新注册。
- 名称任意，账户类型选“仅此组织目录”。
- 重定向 URI 选 Web，填 `http://localhost:3000/api/admin/oauth/callback`。
- 记录应用(客户端)ID 和 目录(租户)ID。

## 2) 生成客户端密钥
- 应用 → 证书和密码 → 新客户端密码，期限自定。
- 复制“值”（只显示一次），后续填到后台。

## 3) 配置 Graph 权限
- 应用 → API 权限 → 添加权限 → Microsoft Graph → 委派权限。
- 添加：`User.ReadWrite.All`、`Directory.ReadWrite.All`。
- 点击“授予管理员同意”使权限生效。

## 4) 身份验证设置
- 应用 → 身份验证：确认包含回调 `http://localhost:3000/api/admin/oauth/callback`。
- 勾选“访问令牌”“ID 令牌”后保存（如有选项）。

## 5) 本地环境变量示例
在仓库根目录创建 `.env`：
```
ENTRA_TENANT_ID="<目录(租户)ID>"
ENTRA_TENANT_DOMAIN="<yourtenant.onmicrosoft.com>"
OAUTH_REDIRECT_URI="http://localhost:3000/api/admin/oauth/callback"
ADMIN_PASSWORD="<自定义后台密码>"
DATABASE_URL="file:./dev.db"
OFFICE_E3_SKU_ID="<可选，Office 365 E3 的 skuId>"
ENTRA_USAGE_LOCATION="CN" # 两位国家/地区代码，如 CN/US，用于许可证分配（默认 CN）
```

## 6) 初始化与启动
- 首次或更新 schema：`npx prisma migrate dev --name init`
- 生成 Prisma Client（如需）：`npx prisma generate`
- 启动：`npm run dev`

### 可选：自动分配 Office 365 E3 授权
- 在 Entra → “计费”/“订阅的 SKU”（或 Graph 调用 `/subscribedSkus`）查到 Office 365 E3 的 `skuId`（产品名称通常为 `ENTERPRISEPACK`）。
- 将 `OFFICE_E3_SKU_ID` 写入 `.env`，系统在创建用户后会自动调用 Graph `/users/{id}/assignLicense` 赋予该 SKU。
- 若分配许可证报 “invalid usage location”，请在 `.env` 设置 `ENTRA_USAGE_LOCATION`（两位国家/地区代码，如 CN/US；默认 CN）。

## 7) 后台配置与授权流程
- 访问 `http://localhost:3000/admin`，用 `ADMIN_PASSWORD` 登录。
- 在后台填写 Client ID、Client Secret 并保存。
- 点击“管理员授权”，用租户管理员账号登录并同意权限。
- 返回后台即可生成/管理兑换码，前台 `/` 输入兑换码创建 Entra 企业账户。

## 8) 上线时的注意事项
- 在 Entra 应用“身份验证”里新增生产域名的回调 URL，并同步更新 `.env` 的 `OAUTH_REDIRECT_URI`。
- 生产环境使用 https，并在服务器上设置对应的环境变量和持久化数据库。***
