import { Prisma } from '../generated/prisma/client.js';
import { conTenantInyectado, type PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { conTenantActivo } from '../aislamiento/contexto-tenant.js';
import type { Reloj } from '../automatizaciones/planificador.js';

/**
 * CH-43 (DEC-185, DEC-196): stores a tenant's Telegram link from a received code. The tenant
 * comes only from the code row that `codigoVinculoTelegram.buscarPorHash` returns, never
 * from any field of the update (rule 2), and that is the only tenant context entered.
 */

/** `tenantId` is for the poller's log line; `tenantNombre` is for the bot's answer. */
export type ResultadoVinculo = { vinculado: true; tenantId: string; tenantNombre: string } | { vinculado: false };

/** The code was consumed or replaced between the lookup and the transaction. */
class CodigoConsumido extends Error {}

/** `P2002` is Prisma's unique-constraint violation; here `VinculoTelegram_tenantId_key` raises it. */
function esViolacionDeUnicidad(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function crearVincular(
  prisma: PrismaAislado,
  reloj: Pick<Reloj, 'ahora'>,
): (chatId: bigint, codigoHash: string) => Promise<ResultadoVinculo> {
  return async (chatId, codigoHash) => {
    const fila = await prisma.codigoVinculoTelegram.buscarPorHash(codigoHash);
    const ahora = reloj.ahora();
    // A deactivated tenant's code answers as "not valid", like the agent and panel lookups.
    if (fila === null || !fila.tenantActivo || fila.venceEn.getTime() <= ahora.getTime()) {
      return { vinculado: false };
    }
    try {
      await conTenantActivo({ id: fila.tenantId, nombre: fila.tenantNombre }, async () => {
        // `aplicarAlcance` refuses `upsert` on purpose: the replace is scoped `deleteMany`s and
        // a scoped `create` in one transaction. The code is deleted first, by its hash and
        // still live, so a code consumed or replaced since the lookup links nothing.
        await prisma.$transaction(async (tx) => {
          const borrados = await tx.codigoVinculoTelegram.deleteMany({ where: { codigoHash, venceEn: { gt: ahora } } });
          if (borrados.count !== 1) throw new CodigoConsumido();
          await tx.vinculoTelegram.deleteMany({});
          await tx.vinculoTelegram.create({ data: conTenantInyectado({ chatId }) });
        });
      });
    } catch (error) {
      // A concurrent link of the same tenant won the unique key; this one rolled back.
      if (error instanceof CodigoConsumido || esViolacionDeUnicidad(error)) return { vinculado: false };
      throw error;
    }
    return { vinculado: true, tenantId: fila.tenantId, tenantNombre: fila.tenantNombre };
  };
}
