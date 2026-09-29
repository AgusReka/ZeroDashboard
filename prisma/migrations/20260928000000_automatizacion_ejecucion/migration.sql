-- CH-13: tenant automations and their run log (DEC-74, X2).
--
-- Additive by construction: two new tables, their indexes and foreign keys. No column of
-- "Tenant", "Conexion" or "Plantilla" is altered, so every pre-CH-13 code path keeps its
-- meaning and reverting the application code leaves the data valid. Both tables carry a
-- direct "tenantId" so the isolation extension scopes them like every other tenant model
-- (DEC-13). Every foreign key is RESTRICT, so a Tenant, Conexion, Plantilla or
-- Automatizacion that is referenced cannot be deleted out from under its dependents.
-- "iniciadaEn" has no default on purpose: the scheduler writes it from its own clock.
-- Rollback drops both tables: DROP TABLE "Ejecucion"; DROP TABLE "Automatizacion";

-- CreateTable
CREATE TABLE "Automatizacion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "conexionId" TEXT NOT NULL,
    "valores" JSONB NOT NULL DEFAULT '{}',
    "cron" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Automatizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ejecucion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "automatizacionId" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "iniciadaEn" TIMESTAMP(3) NOT NULL,
    "finalizadaEn" TIMESTAMP(3),
    "duracionMs" INTEGER,
    "filas" INTEGER,
    "corte" TEXT,
    "fase" TEXT,
    "error" TEXT,
    "codigoError" TEXT,

    CONSTRAINT "Ejecucion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Automatizacion_tenantId_idx" ON "Automatizacion"("tenantId");

-- CreateIndex
CREATE INDEX "Ejecucion_tenantId_idx" ON "Ejecucion"("tenantId");

-- CreateIndex
CREATE INDEX "Ejecucion_automatizacionId_iniciadaEn_idx" ON "Ejecucion"("automatizacionId", "iniciadaEn");

-- AddForeignKey
ALTER TABLE "Automatizacion" ADD CONSTRAINT "Automatizacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automatizacion" ADD CONSTRAINT "Automatizacion_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "Plantilla"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automatizacion" ADD CONSTRAINT "Automatizacion_conexionId_fkey" FOREIGN KEY ("conexionId") REFERENCES "Conexion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ejecucion" ADD CONSTRAINT "Ejecucion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ejecucion" ADD CONSTRAINT "Ejecucion_automatizacionId_fkey" FOREIGN KEY ("automatizacionId") REFERENCES "Automatizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
