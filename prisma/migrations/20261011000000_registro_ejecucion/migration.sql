-- CH-20: the console execution audit (DEC-159 to DEC-162). Additive.
--
-- One new table, scoped by "tenantId" in the application, with no foreign keys on purpose:
-- the triggers at the end refuse UPDATE, DELETE and TRUNCATE (DEC-162), so a foreign key
-- to "Tenant" would make deleting a tenant fail. `prisma migrate diff` does not model
-- triggers or functions: a drift check compares the table only, which is expected.
-- Rollback (after reverting the code units):
--   DROP TABLE "RegistroEjecucion";
--   DROP FUNCTION registro_ejecucion_inmutable();

-- CreateTable
CREATE TABLE "RegistroEjecucion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantNombre" TEXT NOT NULL,
    "operadorId" TEXT NOT NULL,
    "operadorNombre" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "conexionId" TEXT NOT NULL,
    "consultaGuardadaId" TEXT,
    "consultaVersion" INTEGER,
    "consultaNombre" TEXT,
    "plantillaId" TEXT,
    "sql" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "fase" TEXT,
    "categoria" TEXT,
    "codigo" TEXT,
    "filas" INTEGER,
    "duracionMs" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroEjecucion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistroEjecucion_tenantId_creadoEn_idx" ON "RegistroEjecucion"("tenantId", "creadoEn");


-- The record cannot be changed (DEC-162): no route edits or deletes, and the database
-- refuses it too, whoever asks.
CREATE FUNCTION registro_ejecucion_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'RegistroEjecucion es inmutable (DEC-162)';
END
$$;

CREATE TRIGGER registro_ejecucion_sin_cambios BEFORE UPDATE OR DELETE ON "RegistroEjecucion"
  FOR EACH ROW EXECUTE FUNCTION registro_ejecucion_inmutable();

CREATE TRIGGER registro_ejecucion_sin_truncar BEFORE TRUNCATE ON "RegistroEjecucion"
  FOR EACH STATEMENT EXECUTE FUNCTION registro_ejecucion_inmutable();
