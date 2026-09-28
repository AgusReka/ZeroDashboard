-- CH-12: the global automation-template catalog (DEC-61, DEC-73).
--
-- Additive by construction: one new table, nothing else. No existing table or column is
-- touched. "Plantilla" has no "tenantId" column and no foreign key to "Tenant" — it is a
-- catalog shared by every tenant, not tenant data — and no index beyond its primary key.
-- "parametros" carries the same '[]' default as "ConsultaGuardada"."parametros".
-- Rollback drops the table: DROP TABLE "Plantilla";

-- CreateTable
CREATE TABLE "Plantilla" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "parametros" JSONB NOT NULL DEFAULT '[]',
    "entidades" JSONB NOT NULL,
    "automatizacion" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "toleranciaFrescuraMinutos" INTEGER NOT NULL,

    CONSTRAINT "Plantilla_pkey" PRIMARY KEY ("id")
);
