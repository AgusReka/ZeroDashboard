-- CH-37: the client-facing title and description of a template (DEC-182, DEC-190). Additive.
--
-- Two nullable columns and no default: null means "no client text", and such a template
-- is simply not offered in the panel. Length and glossary are checked in the
-- application, like "Plantilla"."toleranciaFrescuraMinutos". The two UPDATEs write the
-- DEC-137 texts by slug, so every pre-CH-37 row the panel listed keeps its card; the
-- seeder never updates a row (DEC-125).
-- Rollback (after reverting the code units):
--   ALTER TABLE "Plantilla" DROP COLUMN "titulo";
--   ALTER TABLE "Plantilla" DROP COLUMN "descripcion";

-- AlterTable
ALTER TABLE "Plantilla" ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "titulo" TEXT;

-- Backfill
UPDATE "Plantilla"
SET "titulo" = 'Aviso de stock bajo',
    "descripcion" = 'Te avisamos por correo cuando un producto se está quedando sin stock.'
WHERE "automatizacion" = 'stock-fisico';

UPDATE "Plantilla"
SET "titulo" = 'Aviso de productos que ya casi no podés armar',
    "descripcion" = 'Te avisamos por correo cuando, con los insumos que tenés, ya casi no podés armar un producto.'
WHERE "automatizacion" = 'stock-producible';
