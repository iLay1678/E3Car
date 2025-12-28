# Entra Invite Redemption System

一个功能完整的邀请码分发与管理系统。基于 **Next.js 14** + **Prisma (PostgreSQL)** 构建。
主要功能：
- **管理员后台**：配置 Microsoft Graph 应用，管理兑换码，查看订单。
- **OAuth 登录**：支持通过第三方 OAuth 2.0 服务登录（如 Linux.do）。
- **在线购买**：集成 EasyPay 支付协议（支持微信/支付宝等），用户购买后自动发货。
- **自动开号**：用户兑换邀请码后，自动在 Azure AD (Entra ID) 创建企业账户并分配 Office 365 E3 许可证。

## 功能特性

- ✅ **多方式获取**：支持手动批量生成兑换码，或用户在线付费购买。
- ✅ **支付集成**：兼容 EasyPay / CodePay 等支付接口，支持回调自动发货。
- ✅ **用户系统**：OAuth 2.0 快捷登录，无需单独注册，订单与账户绑定。
- ✅ **自动分配**：对接 Microsoft Graph API，自动创建用户并分配指定 SKU。
- ✅ **后台管理**：可视化配置 API 参数、支付参数，无需修改代码。

## 快速开始

### 1. 环境准备
- Node.js 18+
- PostgreSQL 数据库

### 2. 安装与配置
1.  **克隆代码并安装依赖**
    ```bash
    npm install
    ```

2.  **配置环境变量**
    复制 `.env.example` 为 `.env` 并填写：
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/db_name?schema=public"
    NEXT_PUBLIC_APP_URL="http://your-domain.com"
    ADMIN_PASSWORD="你的后台管理密码"
    AUTH_SECRET="生成的随机密钥(用于加密Session)"
    ```

3.  **初始化数据库**
    ```bash
    npx prisma migrate dev --name init
    ```

4.  **启动服务**
    ```bash
    npm run build
    npm start
    ```

## 系统配置指南

所有业务配置均在 **管理员后台** (`/admin`) 进行，无需重启服务。

### 1. 后台登录
访问 `/admin`，使用环境变量中设置的 `ADMIN_PASSWORD` 登录。

### 2. 配置 Microsoft Graph (用于开号)
在后台 **配置与授权** 页面填写：
- **Client ID & Secret**: Azure Portal 注册应用后获取。
- **自动分配 SKU**: 点击“拉取 SKU”选择（如 `ENTERPRISEPACK`）。
- **点击授权**:这是关键一步，必须使用全局管理员账号授权应用读写目录。

### 3. 配置 OAuth 登录 (用于前台用户)
支持标准 OAuth 2.0：
- **Client ID & Secret**: 第三方登录提供商（如 Linux.do）提供。
- **URLs**: 填写 Auth, Token, User Info 的 API 地址。
- **回调地址**: 填写 `http://你的域名/api/auth/callback` 到第三方提供商的应用配置中。

### 4. 配置支付 (用于售卖邀请码)
支持易支付（EPay）协议：
- **PID & Key**: 支付商户号和密钥。
- **网关地址**: 支付平台的 API 地址（例如 `https://credit.linux.do/epay`）。
- **价格**: 设置邀请码的售价。

## 使用流程

**用户侧**：
1.  **登录**: 点击首页或购买页的登录按钮。
2.  **购买**: 访问 `/buy` 支付购买邀请码。
3.  **查看**: 支付成功后自动跳转 `/orders` 查看邀请码。
4.  **兑换**: 在首页输入邀请码，系统自动创建 Microsoft 账号。

**管理侧**：
1.  **筛选**: 在“兑换码管理”中按“来源”筛选（手动/购买）。
2.  **监控**: 查看已使用/未使用的兑换码状态。

## 常用命令

- `npx prisma studio`: 打开数据库可视化界面。
- `npx prisma generate`: 更新数据库客户端类型。
