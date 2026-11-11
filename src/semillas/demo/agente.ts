import { hashTokenAgente } from '../../agente/agente-token.js';
import type { ClienteSemilla, TenantDemo } from './comun.js';
import { sembrarFilaTenant } from './tenant.js';

/**
 * CH-49 (d, DEC-207): Food Store's agent, so the demo's connection can go through it and the
 * provoked failure (`docker compose stop agente`) has something to stop.
 *
 * Only the token's hash is stored, never the token (DEC-114): `hashTokenAgente` is the same
 * function the engine uses to look an agent up. The token comes from the environment and reaches
 * neither the log (`creadas` only holds the label `agente`) nor an error message. An agent the
 * tenant already has, whatever its token, is left as it is: the tenant allows one (DEC-115) and
 * the service, started with another token, then exits with code 2.
 *
 * The agent's row needs the tenant's, so the tenant is created here first; `sembrarTenant`
 * finds it and goes on with the connection, which it creates bound to the agent this returns.
 * The probe of the views stays direct: this module never touches the replica.
 */
export const ID_AGENTE_DEMO = '49d00000-0000-4000-8000-000000000071';

/**
 * Same format as `FORMATO_TOKEN` in `src/agente-proceso/limites.ts`: `zda_` plus 32 random bytes
 * in base64url. Re-declared, not imported, because the agent's files must not share engine code.
 */
export const FORMATO_TOKEN_AGENTE = /^zda_[A-Za-z0-9_-]{43}$/;

type ClienteAgente = Pick<ClienteSemilla, 'tenant' | 'agente'>;

/** Creates the tenant row and, when the tenant has no agent, the agent; returns the tenant's agent id. */
export async function sembrarAgente(
  prisma: ClienteAgente,
  tenant: TenantDemo,
  token: string,
  creadas: string[],
): Promise<string> {
  await sembrarFilaTenant(prisma, tenant, creadas);

  const tenantId = tenant.ids.tenant;
  const existente = await prisma.agente.findUnique({ where: { tenantId }, select: { id: true } });
  if (existente !== null) {
    return existente.id;
  }

  await prisma.agente.create({ data: { id: ID_AGENTE_DEMO, tenantId, tokenHash: hashTokenAgente(token) } });
  creadas.push(`${tenant.prefijoEtiqueta}agente`);
  return ID_AGENTE_DEMO;
}
