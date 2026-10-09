-- CH-24: the tenant's declared replica freshness (DEC-143, DEC-144). Additive.
--
-- Two nullable columns and no default: null means "sin declarar", never "fresh", so every
-- pre-CH-24 row and every pre-CH-24 code path stays valid on rollback. The range of the
-- window (0 to 525600 minutes) is checked in the application, like
-- "Plantilla"."toleranciaFrescuraMinutos".
-- Rollback (after reverting the code units):
--   ALTER TABLE "Tenant" DROP COLUMN "replicaActualizadaEn";
--   ALTER TABLE "Tenant" DROP COLUMN "ventanaDesactualizacionMinutos";

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "replicaActualizadaEn" TIMESTAMP(3),
ADD COLUMN     "ventanaDesactualizacionMinutos" INTEGER;
