-- CH-11: the parameter declaration of a saved query (DEC-48, DEC-55).
--
-- Additive by construction: one column added to "ConsultaGuardada", nothing else. No
-- existing column is altered, so every row keeps its "sql" text unchanged. The NOT NULL
-- column carries a default, which backfills every pre-CH-11 row as declaring no
-- parameter. Rollback drops the column: ALTER TABLE "ConsultaGuardada" DROP COLUMN "parametros";

-- AlterTable
ALTER TABLE "ConsultaGuardada" ADD COLUMN     "parametros" JSONB NOT NULL DEFAULT '[]';
