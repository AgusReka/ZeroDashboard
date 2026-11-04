-- CH-43: the Telegram link (DEC-185, DEC-196). Additive.
--
-- Two new tables and no change to any existing one. Each tenant has at most one link and
-- at most one live code (`tenantId` unique); `codigoHash` is unique so a code resolves to
-- a single tenant. `chatId` is BIGINT because a Telegram chat id may exceed 32 bits. Only
-- the code's SHA-256 hash is stored, never the plain code.
-- Rollback (after reverting the code units):
--   DROP TABLE "CodigoVinculoTelegram";
--   DROP TABLE "VinculoTelegram";

-- CreateTable
CREATE TABLE "VinculoTelegram" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "vinculadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VinculoTelegram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoVinculoTelegram" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "venceEn" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoVinculoTelegram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VinculoTelegram_tenantId_key" ON "VinculoTelegram"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CodigoVinculoTelegram_tenantId_key" ON "CodigoVinculoTelegram"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CodigoVinculoTelegram_codigoHash_key" ON "CodigoVinculoTelegram"("codigoHash");

-- AddForeignKey
ALTER TABLE "VinculoTelegram" ADD CONSTRAINT "VinculoTelegram_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoVinculoTelegram" ADD CONSTRAINT "CodigoVinculoTelegram_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
