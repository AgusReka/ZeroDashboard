-- CH-19b: one agent per tenant and its token hash (DEC-114, DEC-115, DEC-121). Additive.
--
-- A new table and one nullable column with no default and no backfill: every existing
-- "Conexion" row reads "agenteId" as NULL (a direct connection), and older application
-- code ignores both. "Agente_tenantId_key" is a full unique index, not a partial one
-- (DEC-111). Both foreign keys are RESTRICT.
-- Rollback (after reverting units 2 and 1):
--   ALTER TABLE "Conexion" DROP CONSTRAINT "Conexion_agenteId_fkey";
--   ALTER TABLE "Conexion" DROP COLUMN "agenteId";
--   DROP TABLE "Agente";

-- AlterTable
ALTER TABLE "Conexion" ADD COLUMN     "agenteId" TEXT;

-- CreateTable
CREATE TABLE "Agente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenEmitidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadoEn" TIMESTAMP(3),

    CONSTRAINT "Agente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agente_tenantId_key" ON "Agente"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Agente_tokenHash_key" ON "Agente"("tokenHash");

-- AddForeignKey
ALTER TABLE "Conexion" ADD CONSTRAINT "Conexion_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "Agente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agente" ADD CONSTRAINT "Agente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
