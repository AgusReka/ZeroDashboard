-- CH-44: the automation's channel and the channel of each run (DEC-185, DEC-197). Additive.
--
-- Plain TEXT with its values in code, like `notificacion`. Existing automations read
-- 'correo' and keep sending email; existing runs read null, which means 'correo'. No chat
-- id is stored on either table (regla 5).
-- Rollback (after reverting the code units):
--   ALTER TABLE "Ejecucion" DROP COLUMN "canal";
--   ALTER TABLE "Automatizacion" DROP COLUMN "canal";
--   (a Telegram automation goes back to email at its stored recipients)

-- AlterTable
ALTER TABLE "Automatizacion" ADD COLUMN "canal" TEXT NOT NULL DEFAULT 'correo';

-- AlterTable
ALTER TABLE "Ejecucion" ADD COLUMN "canal" TEXT;
