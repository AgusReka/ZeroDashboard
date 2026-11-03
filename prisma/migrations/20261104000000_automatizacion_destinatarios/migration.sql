-- CH-41: several recipients per automation (DEC-187, DEC-194). Replaces a column.
--
-- `destinatarios` is a non-null TEXT[] with an empty default, at most 5 addresses; the
-- cap and the address syntax are checked in the application, as `destinatario` was
-- (DEC-82). The copy keeps every stored address as a list of one, and a null becomes the
-- empty list. A stored address already passed the application's rule, so the copy needs
-- no check.
-- Rollback (after reverting the code units):
--   ALTER TABLE "Automatizacion" ADD COLUMN "destinatario" TEXT;
--   UPDATE "Automatizacion" SET "destinatario" = "destinatarios"[1];
--   ALTER TABLE "Automatizacion" DROP COLUMN "destinatarios";
--   (the rollback keeps only the first address of each list)

-- AlterTable
ALTER TABLE "Automatizacion" ADD COLUMN "destinatarios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "Automatizacion" SET "destinatarios" = ARRAY["destinatario"] WHERE "destinatario" IS NOT NULL;
ALTER TABLE "Automatizacion" DROP COLUMN "destinatario";
