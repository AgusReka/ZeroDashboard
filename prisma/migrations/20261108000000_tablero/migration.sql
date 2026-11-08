-- CH-46: the tenant dashboard (DEC-199). Additive.
--
-- One new table and no change to any existing one. Each tenant has at most one dashboard
-- (`tenantId` unique). `reportes` holds report ids in display order and has no foreign key:
-- reports are never deleted (DEC-68), and the save checks that each id exists. Both foreign
-- keys RESTRICT deletes, so neither the tenant nor the connection can vanish under a dashboard.
-- No data is copied.
-- Rollback (after reverting the code units; reports on a dashboard become editable again):
--   DROP TABLE "Tablero";

-- CreateTable
CREATE TABLE "Tablero" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conexionId" TEXT NOT NULL,
    "reportes" TEXT[],

    CONSTRAINT "Tablero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tablero_tenantId_key" ON "Tablero"("tenantId");

-- AddForeignKey
ALTER TABLE "Tablero" ADD CONSTRAINT "Tablero_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tablero" ADD CONSTRAINT "Tablero_conexionId_fkey" FOREIGN KEY ("conexionId") REFERENCES "Conexion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
