-- CH-14: the automation's recipient and each run's notification outcome (DEC-82, DEC-83).
--
-- Additive by construction: two nullable TEXT columns, no default, no constraint. Every
-- pre-CH-14 row reads "destinatario" and "notificacion" as NULL, which the application
-- treats as "no recipient" (the run records 'sin-destinatario') and "outcome unknown"
-- respectively, so reverting the application code leaves the data valid. The allowed
-- values of "notificacion" live in code, like "estado" and "fase".
-- Rollback drops both columns:
--   ALTER TABLE "Ejecucion" DROP COLUMN "notificacion";
--   ALTER TABLE "Automatizacion" DROP COLUMN "destinatario";

-- AlterTable
ALTER TABLE "Automatizacion" ADD COLUMN     "destinatario" TEXT;

-- AlterTable
ALTER TABLE "Ejecucion" ADD COLUMN     "notificacion" TEXT;
