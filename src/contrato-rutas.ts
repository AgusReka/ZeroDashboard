import type { FastifyInstance } from 'fastify';
import { CONTRATO_CANONICO } from './contrato.js';

/**
 * `GET /contrato` — the read-only projection of the canonical contract (M1).
 *
 * The handler serves `CONTRATO_CANONICO` exactly as `src/contrato.ts` declares it. No
 * per-request reshaping, no filtering, no ordering of its own: the module is the source
 * of truth (DEC-21), and copying its content into a response literal here would create a
 * second definition free to drift away from the first one silently.
 *
 * **The registrar takes the app and nothing else**, unlike the four registrars that
 * receive the extended client. That asymmetry is deliberate and load-bearing: it is the
 * structural proof that this handler reads no database, which is the premise DEC-24's
 * tenant-header exemption rests on. A route that cannot reach a scoped model cannot leak
 * one tenant's rows to another, whatever a future edit to the handler body attempts.
 * `src/contrato-rutas.test.ts` pins the signature so the capability cannot be handed
 * back in later by accident.
 *
 * The answer is wrapped in `{ contrato: { entidades } }` rather than returned as a bare
 * array, matching the single-named-key shape of `{ consultaGuardada }` and
 * `{ consultasGuardadas, truncado }`. The inner `entidades` envelope leaves room for
 * CH-12 to add catalog-level metadata without changing the shape clients already read.
 *
 * No body or params schema is declared: there is nothing to validate on a route that
 * takes no input. No `truncado` either — the catalog is static and uncapped, so unlike
 * the saved-query list there is no ceiling for a response to have hit.
 */
export function registerContratoRoutes(app: FastifyInstance): void {
  app.get('/contrato', async (_request, reply) => {
    return reply.code(200).send({ contrato: { entidades: CONTRATO_CANONICO } });
  });
}
