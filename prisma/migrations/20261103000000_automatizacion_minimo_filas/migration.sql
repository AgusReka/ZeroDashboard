-- CH-40: the minimum rows an automation needs before it notifies (DEC-186, DEC-193). Additive.
--
-- One non-null integer column with DEFAULT 1, which fills every existing row: 1 is
-- today's behaviour (a run with rows notifies), so there is no backfill. The range,
-- 1 to the engine's row cap (MAX_FILAS_CONSULTA), is checked in the application: the
-- cap is runtime configuration, so a check constraint could only hold the lower bound.
-- Rollback (after reverting the code units):
--   ALTER TABLE "Automatizacion" DROP COLUMN "minimoFilas";

-- AlterTable
ALTER TABLE "Automatizacion" ADD COLUMN     "minimoFilas" INTEGER NOT NULL DEFAULT 1;
