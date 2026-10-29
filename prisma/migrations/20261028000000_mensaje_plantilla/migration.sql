-- CH-39: the message texts of a template and the run's fallback record (DEC-188, DEC-192). Additive.
--
-- Three nullable columns and no default. A template with null texts keeps the table, so
-- there is no backfill. "Ejecucion"."mensajeRespaldo" holds the column names a run's
-- message lacked when it fell back to the table; rows written before CH-39 read as null.
-- Pairing, caps, glossary and placeholders are checked in the application.
-- Rollback (after reverting the code units):
--   ALTER TABLE "Plantilla" DROP COLUMN "encabezadoMensaje";
--   ALTER TABLE "Plantilla" DROP COLUMN "lineaMensaje";
--   ALTER TABLE "Ejecucion" DROP COLUMN "mensajeRespaldo";

-- AlterTable
ALTER TABLE "Plantilla" ADD COLUMN     "encabezadoMensaje" TEXT,
ADD COLUMN     "lineaMensaje" TEXT;

-- AlterTable
ALTER TABLE "Ejecucion" ADD COLUMN     "mensajeRespaldo" JSONB;
