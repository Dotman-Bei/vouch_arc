-- CreateTable
CREATE TABLE "Leader" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "hlWallet" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "bondAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAnalyzed" TIMESTAMP(3),

    CONSTRAINT "Leader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderMetric" (
    "id" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sharpe30d" DOUBLE PRECISION NOT NULL,
    "sortino30d" DOUBLE PRECISION NOT NULL,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "profitFactor" DOUBLE PRECISION NOT NULL,
    "return24hBps" INTEGER NOT NULL,
    "return7dBps" INTEGER NOT NULL,
    "regimeAlpha" DOUBLE PRECISION NOT NULL,
    "degradationScore" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "slashRisk" TEXT NOT NULL,
    "reasonHash" TEXT NOT NULL,
    "ipfsCid" TEXT NOT NULL,
    "traceJson" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "LeaderMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlashEvent" (
    "id" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "slashBps" INTEGER NOT NULL,
    "slashAmount" DECIMAL(65,30) NOT NULL,
    "reasonHash" TEXT NOT NULL,
    "ipfsCid" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlashEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "leadersAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "slashesTriggered" INTEGER NOT NULL DEFAULT 0,
    "avgSharpe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newTraces" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT,
    "circleUserId" TEXT NOT NULL,
    "circleWalletId" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Leader_address_key" ON "Leader"("address");

-- CreateIndex
CREATE INDEX "LeaderMetric_leaderId_computedAt_idx" ON "LeaderMetric"("leaderId", "computedAt");

-- CreateIndex
CREATE INDEX "LeaderMetric_reasonHash_idx" ON "LeaderMetric"("reasonHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_circleUserId_key" ON "User"("circleUserId");

-- AddForeignKey
ALTER TABLE "LeaderMetric" ADD CONSTRAINT "LeaderMetric_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Leader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlashEvent" ADD CONSTRAINT "SlashEvent_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Leader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
