-- CH-17b: the number of connection attempts each run made (DEC-98, DEC-103).
--
-- Additive by construction: one nullable INTEGER column, no default, no constraint, no
-- backfill. Every pre-CH-17b row reads "intentos" as NULL, which the application treats
-- as "not applicable or not recorded", never as one attempt; runs that never dialled
-- ('omitida', 'interrumpida', a refusal before connecting) also keep it NULL. Reverting
-- the application code leaves the data valid, because older code ignores the column.
-- Rollback drops the column:
--   ALTER TABLE "Ejecucion" DROP COLUMN "intentos";

-- AlterTable
ALTER TABLE "Ejecucion" ADD COLUMN     "intentos" INTEGER;
