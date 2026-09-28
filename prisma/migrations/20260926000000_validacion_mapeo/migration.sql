-- CH-10: the latest structural validation result of each registered canonical view
-- (DEC-40, DEC-41, DEC-44).
--
-- Additive by construction: three columns added to "VistaCanonica", nothing else. No
-- existing column is altered, so every row keeps its "sql" text unchanged. The NOT NULL
-- status column carries a default, which backfills every pre-CH-10 row as never
-- validated; the diagnostic and the timestamp stay NULL until a validation runs.
-- Rollback drops the three columns.

-- AlterTable
ALTER TABLE "VistaCanonica" ADD COLUMN     "diagnosticoValidacion" JSONB,
ADD COLUMN     "estadoValidacion" TEXT NOT NULL DEFAULT 'no-validado',
ADD COLUMN     "validadaEn" TIMESTAMP(3);
