-- CH-22a: the client user (P2) and its panel sessions (DEC-133, DEC-134). Additive.
--
-- Two new tables and no change to any existing one: every pre-CH-22a row and every
-- pre-CH-22a code path stays valid on rollback, and `Usuario.activo` defaults to true
-- the way `Tenant.activo` does (DEC-14), so a provisioned user is active unless
-- deactivated on purpose. `correo` and `tokenHash` are unique indexes: a duplicate
-- email and a reused session token are refused by the database, not by the route.
-- Rollback (after reverting the code units):
--   DROP TABLE "SesionPanel";
--   DROP TABLE "Usuario";

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "claveHash" TEXT NOT NULL,
    "nombre" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionPanel" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionPanel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE INDEX "Usuario_tenantId_idx" ON "Usuario"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SesionPanel_tokenHash_key" ON "SesionPanel"("tokenHash");

-- CreateIndex
CREATE INDEX "SesionPanel_tenantId_idx" ON "SesionPanel"("tenantId");

-- CreateIndex
CREATE INDEX "SesionPanel_tokenHash_idx" ON "SesionPanel"("tokenHash");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionPanel" ADD CONSTRAINT "SesionPanel_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionPanel" ADD CONSTRAINT "SesionPanel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
