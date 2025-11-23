# Entra Invite Redemption

一个基于 Next.js 14 + Prisma 的示例：管理员配置 Microsoft Graph 应用并完成 OAuth 授权，批量分发兑换码，用户用兑换码在 Entra（Azure AD）自动创建企业账户，可选自动分配 Office 365 E3 许可证。面向新手，按步骤跟着做即可。

## 快速开始（本地）

1) 准备工具：安装 Node.js 18+ 和 npm。  
2) 克隆代码后安装依赖：
```bash
npm install
```
3) 生成本地数据库（SQLite）和 Prisma Client：
```bash
npx prisma migrate dev --name init
```
4) 在仓库根目录创建 `.env`（示例见下）。  
5) 启动开发环境：
```bash
npm run dev
```
本地地址 `http://localhost:3000`，后台 `http://localhost:3000/admin`。

## 必填/可选环境变量

```env
ENTRA_TENANT_ID="目录(租户)ID"                # Azure Portal 复制
ENTRA_TENANT_DOMAIN="yourtenant.onmicrosoft.com" # 租户的 onmicrosoft.com 域名
OAUTH_REDIRECT_URI="http://localhost:3000/api/admin/oauth/callback" # 本地回调地址
ADMIN_PASSWORD="自定义后台密码"              # 用于登录后台
ADMIN_JWT_SECRET="随机 32+ 字符"            # 签发后台 JWT 的密钥
DATABASE_URL="file:./dev.db"                # 本地 SQLite
OFFICE_E3_SKU_ID="可选，Office 365 E3 的 skuId，用于自动分配许可证"
ENTRA_USAGE_LOCATION="CN"                   # 两位国家/地区代码，默认 CN
```

## 在 Azure Portal 配置 Entra 应用

1) 进入 Azure Portal → Microsoft Entra ID → “应用注册” → “新注册”，账户类型选“仅此组织目录”。  
2) “重定向 URI” 选择 Web，填 `http://localhost:3000/api/admin/oauth/callback`（上线后替换为你的域名回调）。  
3) 创建客户端密码（证书和密码 → 新客户端密码），记下“值”。  
4) API 权限（委派）：添加 `User.ReadWrite.All`、`Directory.ReadWrite.All`，然后点击“授予管理员同意”。  
5) 记录 租户 ID、租户 onmicrosoft 域名、Client ID、Client Secret，填入 `.env`。

## 后台操作流程

1) 访问 `/admin`，使用 `ADMIN_PASSWORD` 登录。  
2) 填写 Client ID / Client Secret → 保存 → 点击“前往管理员授权”并用管理员账号同意。  
3) （可选）点击“拉取 SKU”获取订阅，选择 Office 365 E3（ENTERPRISEPACK）以自动分配许可证。  
4) 创建兑换码（批量或单个）。  
5) 用户访问 `/` 输入显示名和兑换码，系统创建账户并返回 UPN + 初始密码。

## 生产部署提示

- 在 Azure 应用的“身份验证”中添加生产域名回调，例如 `https://yourdomain.com/api/admin/oauth/callback`，并同步更新 `.env` 的 `OAUTH_REDIRECT_URI`。  
- 生成 32 位以上随机的 `ADMIN_JWT_SECRET`，保护后台 access/refresh token 签名。  
- 使用持久化数据库（例如 Azure SQL/Postgres），并更新 `DATABASE_URL`。  
- 生产启动：`npm run build`，`npm start`（确保设置了所有环境变量）。

## 常见问题

- 授权回调 400/invalid_grant：同一个 code 只能用一次，请重新点击“管理员授权”。  
- 403 获取 SKU：确保已管理员同意 `Directory.ReadWrite.All`，并使用有目录/许可证管理权限的账号授权。  
- 分配许可证报 “invalid usage location”：在 `.env` 设置 `ENTRA_USAGE_LOCATION`（如 `CN`/`US`），重启后再试。  
- UPN 冲突：当前未自动重命名，如同名会报错，可在前端填写唯一前缀或自行改造重试逻辑。

## 常用命令

- 开发：`npm run dev`  
- 构建/生产：`npm run build` && `npm start`  
- Lint：`npm run lint`  
- 数据库：`npx prisma migrate dev --name <tag>`、`npx prisma generate`
