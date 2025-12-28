/*
  Warnings:

  - A unique constraint covering the columns `[orderId]` on the table `InviteCode` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AppConfig" ADD COLUMN     "authClientId" TEXT,
ADD COLUMN     "authClientSecret" TEXT,
ADD COLUMN     "authUrl" TEXT,
ADD COLUMN     "epayKey" TEXT,
ADD COLUMN     "epayPid" TEXT,
ADD COLUMN     "epayUrl" TEXT DEFAULT 'https://credit.linux.do/epay',
ADD COLUMN     "invitePrice" DECIMAL(65,30) DEFAULT 10.00,
ADD COLUMN     "tenantId" TEXT,
ADD COLUMN     "tokenUrl" TEXT,
ADD COLUMN     "userUrl" TEXT;

-- AlterTable
ALTER TABLE "InviteCode" ADD COLUMN     "orderId" INTEGER,
ADD COLUMN     "ownerId" INTEGER,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nickname" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "tradeNo" TEXT NOT NULL,
    "apiTradeNo" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tradeNo_key" ON "Order"("tradeNo");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_orderId_key" ON "InviteCode"("orderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
