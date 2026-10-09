-- CH-25: versioning of saved queries (DEC-146 to DEC-148). Additive.
--
-- Two columns with a default or null on "ConsultaGuardada" and one new table: every earlier
-- row is valid with no backfill (version 1, no note, empty history) and every earlier code
-- path stays valid on rollback. The unique pair ("consultaGuardadaId", "version") is what
-- turns a concurrent double edit into a conflict instead of a forked history. Every foreign
-- key is RESTRICT, so nothing the history references can be deleted from under it.
-- Rollback (after reverting the code units):
--   DROP TABLE "ConsultaGuardadaVersion";
--   ALTER TABLE "ConsultaGuardada" DROP COLUMN "nota";
--   ALTER TABLE "ConsultaGuardada" DROP COLUMN "version";

-- AlterTable
ALTER TABLE "ConsultaGuardada" ADD COLUMN     "nota" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ConsultaGuardadaVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consultaGuardadaId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "sql" TEXT NOT NULL,
    "parametros" JSONB NOT NULL,
    "nota" TEXT,
    "desde" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultaGuardadaVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultaGuardadaVersion_tenantId_idx" ON "ConsultaGuardadaVersion"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultaGuardadaVersion_consultaGuardadaId_version_key" ON "ConsultaGuardadaVersion"("consultaGuardadaId", "version");

-- AddForeignKey
ALTER TABLE "ConsultaGuardadaVersion" ADD CONSTRAINT "ConsultaGuardadaVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultaGuardadaVersion" ADD CONSTRAINT "ConsultaGuardadaVersion_consultaGuardadaId_fkey" FOREIGN KEY ("consultaGuardadaId") REFERENCES "ConsultaGuardada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

