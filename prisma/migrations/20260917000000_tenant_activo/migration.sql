-- CH-06: logical deactivation flag for a tenant (DEC-14).
--
-- Additive by construction: the NOT NULL column carries a `true` DEFAULT, so
-- every row already in the table backfills as active in the same statement and no
-- pre-CH-06 code path changes meaning. Reverting the application code therefore
-- leaves the data valid; the column is dropped by a follow-up migration only if
-- the change is abandoned.

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;
