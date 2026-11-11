import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { conTenantInyectado, type PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { conTenantActivo } from '../aislamiento/contexto-tenant.js';
import { DURACION_CODIGO_MS, generarCodigo } from '../telegram/codigo-vinculo.js';
import { levantarSesionPanel } from './panel-auth.js';

/**
 * CH-43 (DEC-185, DEC-196): the panel's Telegram link API, behind the «Avisos por
 * Telegram» card. Three session-guarded rows of `RUTAS_PANEL_PUBLICAS`; the tenant comes
 * only from the session (DEC-135, rule 2) and every read and write goes through the scoped
 * client. No response carries the chat id, the code's hash or a tenant id.
 */

/**
 * What the routes need from the Telegram poller: the bot's username, or `null` while the
 * token is unset or `getMe` has not answered yet. `null` as a whole when the token is unset.
 */
export interface PuertoTelegram {
  bot(): string | null;
}

export interface DependenciasPanelTelegram {
  prisma: PrismaAislado;
  telegram: PuertoTelegram | null;
  /** The clock a code's expiry is read and written with. */
  ahora?: () => Date;
}

/** The link state `GET /api/panel/telegram` answers with. Dates are ISO UTC. */
export type EstadoTelegram =
  | { estado: 'no-disponible' }
  | { estado: 'sin-vincular'; bot: string }
  | { estado: 'codigo-pendiente'; bot: string; venceEn: string }
  | { estado: 'vinculado'; bot: string; vinculadoEn: string; venceEn?: string };

/**
 * The routes take no body and no query. The check is in the handler rather than in a schema
 * on purpose: under Fastify's `removeAdditional` a key that `properties` does not list is
 * stripped silently, and a route with nothing to list would then accept any body. Any key,
 * a `tenantId` included, is a `400`.
 */
function clavesSobrantes(request: FastifyRequest): string[] {
  const claves = (valor: unknown): string[] => {
    if (valor === undefined || valor === null) return [];
    if (typeof valor !== 'object' || Array.isArray(valor)) return [''];
    return Object.keys(valor);
  };
  return [...claves(request.body), ...claves(request.query)];
}

function rechazarSobrantes(request: FastifyRequest, reply: FastifyReply): boolean {
  const sobrantes = clavesSobrantes(request);
  if (sobrantes.length === 0) return false;
  void reply.code(400).send({ error: 'solicitud-invalida', campos: sobrantes.filter((c) => c !== '') });
  return true;
}

/** The bot's username, or `null` when Telegram is not available. */
function botDisponible(telegram: PuertoTelegram | null): string | null {
  return telegram === null ? null : telegram.bot();
}

/**
 * `GET /api/panel/telegram`, `POST /api/panel/telegram/codigo` and
 * `DELETE /api/panel/telegram/vinculo`. A code whose `venceEn` has passed is ignored, not
 * deleted: it can no longer link, and the next `POST` replaces it.
 */
export function registerPanelTelegramRoutes(app: FastifyInstance, deps: DependenciasPanelTelegram): void {
  const { prisma, telegram } = deps;
  const ahora = deps.ahora ?? (() => new Date());

  app.get('/api/panel/telegram', { preHandler: [levantarSesionPanel(prisma)] }, async (request, reply) => {
    const sesion = request.sesionPanel!;
    if (rechazarSobrantes(request, reply)) return reply;
    const bot = botDisponible(telegram);
    if (bot === null) {
      return reply.code(200).send({ estado: 'no-disponible' } satisfies EstadoTelegram);
    }
    const estado = await conTenantActivo(
      { id: sesion.tenantId, nombre: sesion.tenantNombre },
      async (): Promise<EstadoTelegram> => {
        const vinculo = await prisma.vinculoTelegram.findFirst({ select: { vinculadoEn: true } });
        const codigo = await prisma.codigoVinculoTelegram.findFirst({ select: { venceEn: true } });
        const vigente = codigo !== null && codigo.venceEn.getTime() > ahora().getTime() ? codigo : null;
        if (vinculo !== null) {
          return {
            estado: 'vinculado',
            bot,
            vinculadoEn: vinculo.vinculadoEn.toISOString(),
            ...(vigente === null ? {} : { venceEn: vigente.venceEn.toISOString() }),
          };
        }
        return vigente === null
          ? { estado: 'sin-vincular', bot }
          : { estado: 'codigo-pendiente', bot, venceEn: vigente.venceEn.toISOString() };
      },
    );
    return reply.code(200).send(estado);
  });

  app.post('/api/panel/telegram/codigo', { preHandler: [levantarSesionPanel(prisma)] }, async (request, reply) => {
    const sesion = request.sesionPanel!;
    if (rechazarSobrantes(request, reply)) return reply;
    const bot = botDisponible(telegram);
    if (bot === null) {
      return reply.code(409).send({ error: 'telegram-no-disponible' });
    }
    const { codigo, codigoHash } = generarCodigo();
    const venceEn = new Date(ahora().getTime() + DURACION_CODIGO_MS);
    // `aplicarAlcance` refuses `upsert` on purpose: the replace is a scoped `deleteMany`
    // and a scoped `create` in one transaction, inside the session tenant's context.
    await conTenantActivo({ id: sesion.tenantId, nombre: sesion.tenantNombre }, async () => {
      await prisma.$transaction(async (tx) => {
        await tx.codigoVinculoTelegram.deleteMany({});
        await tx.codigoVinculoTelegram.create({ data: conTenantInyectado({ codigoHash, venceEn }) });
      });
    });
    request.log.info({ evento: 'telegram-codigo', tenantId: sesion.tenantId }, 'telegram code created');
    return reply.code(201).send({
      codigo,
      // P-05 (UX review): the bot's public username, so the person can find it without the link.
      bot,
      enlace: `https://t.me/${bot}?start=${codigo}`,
      venceEn: venceEn.toISOString(),
    });
  });

  app.delete('/api/panel/telegram/vinculo', { preHandler: [levantarSesionPanel(prisma)] }, async (request, reply) => {
    const sesion = request.sesionPanel!;
    if (rechazarSobrantes(request, reply)) return reply;
    await conTenantActivo({ id: sesion.tenantId, nombre: sesion.tenantNombre }, async () => {
      await prisma.vinculoTelegram.deleteMany({});
    });
    request.log.info({ evento: 'telegram-desvinculo', tenantId: sesion.tenantId }, 'telegram unlinked');
    return reply.code(204).send();
  });
}
