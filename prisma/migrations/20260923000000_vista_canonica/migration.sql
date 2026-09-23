-- CH-09: registered canonical view definitions, one per Conexion x canonical entity
-- (DEC-30 to DEC-34).
--
-- Additive by construction: one new table, its two indexes and two foreign keys. No
-- column of "Tenant" or "Conexion" is altered, so every pre-CH-09 code path keeps its
-- meaning and reverting the application code leaves the data valid; the table is
-- dropped by a follow-up migration only if the change is abandoned. Both foreign keys
-- are RESTRICT, so a Conexion or Tenant with registered definitions cannot be deleted
-- out from under them.

-- CreateTable
CREATE TABLE "VistaCanonica" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conexionId" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VistaCanonica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VistaCanonica_tenantId_idx" ON "VistaCanonica"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "VistaCanonica_conexionId_entidad_key" ON "VistaCanonica"("conexionId", "entidad");

-- AddForeignKey
ALTER TABLE "VistaCanonica" ADD CONSTRAINT "VistaCanonica_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VistaCanonica" ADD CONSTRAINT "VistaCanonica_conexionId_fkey" FOREIGN KEY ("conexionId") REFERENCES "Conexion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
