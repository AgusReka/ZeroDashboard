import type { PrismaAislado } from './aislamiento-prisma.js';
import { ESTILOS_EXENTOS, RUTAS_PANEL_PUBLICAS } from './contexto-tenant.js';
import { leerCookie } from './cookies.js';
import { hashTokenSesion } from './crypto-auth.js';

/**
 * CH-29 (DEC-151 to DEC-154): the console operator's session — its cookie, its
 * resolution and the closed list of routes that need none.
 *
 * It mirrors the panel's mechanism (`src/panel-auth.ts`, DEC-133, DEC-134) without the
 * tenant: an operator works across every tenant, and the tenant still arrives
 * explicitly on each request (DEC-15). So nothing here enters a tenant context, and
 * `Operador` and `SesionConsola` are read through the extended client untouched, like
 * `Tenant` (they are absent from `MODELOS_AISLADOS`).
 */

/** The console's own cookie, named apart from the panel's `zd_panel_session`. */
export const NOMBRE_COOKIE_CONSOLA = 'zd_consola_session';

/**
 * 12 hours, fixed: a constant, not configuration. Shorter than the panel's 30 days
 * because this session reaches every tenant.
 */
export const SEGUNDOS_VIDA_SESION_CONSOLA = 12 * 60 * 60;
export const MILISEGUNDOS_VIDA_SESION_CONSOLA = SEGUNDOS_VIDA_SESION_CONSOLA * 1000;

/** Serializes the session cookie with the panel's attributes (DEC-134) and its own name. */
export function cookieDeSesionConsola(tokenPlano: string): string {
  return (
    `${NOMBRE_COOKIE_CONSOLA}=${tokenPlano}; HttpOnly; Path=/; ` +
    `Max-Age=${SEGUNDOS_VIDA_SESION_CONSOLA}; SameSite=Lax; Secure`
  );
}

/** The logout twin: same shape, empty value, expired immediately. */
export function cookieVaciaConsola(): string {
  return `${NOMBRE_COOKIE_CONSOLA}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure`;
}

/**
 * The closed exemption list of the operator guard (DEC-152), as `"METHOD /pattern"`
 * rows matched on the route pattern, like the tenant header list. It is NOT that list:
 * `/tenants*`, `/contrato` and `/plantillas` are exempt from the header but belong to
 * the console, so they need an operator. What is exempt here is what is not the console
 * (liveness, the shared stylesheet, the client panel, whose own session guards it) and
 * the two console rows a browser must reach before it has a session. The stylesheet and
 * panel rows come from their own sets, so a new row there is exempt here too.
 */
export const EXENCIONES_OPERADOR: ReadonlySet<string> = new Set([
  'GET /health',
  'GET /consola',
  'POST /consola/ingresar',
  'GET /panel',
  ...ESTILOS_EXENTOS,
  ...RUTAS_PANEL_PUBLICAS,
]);

/**
 * True when the request needs a console session. A request that matched no route
 * (`patron` undefined) needs one too: an unmatched URL without a session is a `401`,
 * not a `404`, fail-closed like the tenant hooks.
 */
export function requiereOperador(metodo: string, patron: string | undefined): boolean {
  if (patron === undefined) {
    return true;
  }
  return !EXENCIONES_OPERADOR.has(`${metodo} ${patron}`);
}

/** The operator a valid session names, as the guard attaches it to the request. */
export interface OperadorAutenticado {
  id: string;
  nombre: string;
}

/** Why a console cookie did or did not resolve, without replying (the caller decides). */
export type DesenlaceSesionConsola =
  | { operador: OperadorAutenticado; sesionId: string; motivo: 'valida' }
  | { operador: null; sesionId: null; motivo: 'sin-cookie' | 'token-desconocido' | 'expirada' };

/**
 * The one resolution path the guard and `GET /consola` share, for the panel's reason:
 * two copies of the check would be two places a hole could hide. Reads the cookie,
 * looks the token up by its SHA-256 hash (the plain token is never stored), and deletes
 * an expired row on use.
 */
export async function resolverSesionConsola(
  prisma: PrismaAislado,
  cabeceraCookie: string | undefined,
): Promise<DesenlaceSesionConsola> {
  const token = leerCookie(cabeceraCookie, NOMBRE_COOKIE_CONSOLA);
  if (token === null || token === '') {
    return { operador: null, sesionId: null, motivo: 'sin-cookie' };
  }
  const sesion = await prisma.sesionConsola.findUnique({
    where: { tokenHash: hashTokenSesion(token) },
    select: { id: true, expiraEn: true, operador: { select: { id: true, nombre: true } } },
  });
  if (sesion === null) {
    return { operador: null, sesionId: null, motivo: 'token-desconocido' };
  }
  if (sesion.expiraEn.getTime() <= Date.now()) {
    await prisma.sesionConsola.deleteMany({ where: { id: sesion.id } });
    return { operador: null, sesionId: null, motivo: 'expirada' };
  }
  return { operador: sesion.operador, sesionId: sesion.id, motivo: 'valida' };
}
