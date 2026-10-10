-- CH-29: console operators and their sessions (DEC-151). Additive.
--
-- Two new tables with no tenant column: an operator works across every tenant and the
-- tenant still arrives on each request (DEC-15). No existing table changes, so every
-- earlier code path stays valid on rollback. Only the SHA-256 hash of a session token is
-- stored; a session is deleted with its operator (CASCADE).
-- Rollback (after reverting the code units):
--   DROP TABLE "SesionConsola";
--   DROP TABLE "Operador";

-- CreateTable
CREATE TABLE "Operador" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "claveHash" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionConsola" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "operadorId" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionConsola_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Operador_nombre_key" ON "Operador"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "SesionConsola_tokenHash_key" ON "SesionConsola"("tokenHash");

-- CreateIndex
CREATE INDEX "SesionConsola_operadorId_idx" ON "SesionConsola"("operadorId");

-- AddForeignKey
ALTER TABLE "SesionConsola" ADD CONSTRAINT "SesionConsola_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "Operador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

