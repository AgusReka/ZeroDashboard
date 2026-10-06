import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { conTenantActivo } from './contexto-tenant.js';
import { conTenantInyectado, type PrismaAislado } from './aislamiento-prisma.js';
import { generarTokenSesion, hashTokenSesion, verificarClave } from './crypto-auth.js';
import { camposInvalidos } from './conexiones.js';

/**
 * CH-22a (DEC-133, DEC-134, DEC-135, DEC-136): the client-panel authentication
 * surface — login, logout and session state — plus the session-resolution hook every
 * authenticated `/api/panel/*` route runs through.
 *
 * Two properties make this module's shape load-bearing:
 *
 *  - **The cookie is the only credential carrier.** There is no `Authorization`
 *    header, no query token: the `HttpOnly` cookie (DEC-134) is read by the hook and
 *    nothing else, and the database holds only the SHA-256 hash of its token. The
 *    three routes below are exempt from the `X-Tenant-Id` header hooks (the closed
 *    allowlist in `src/contexto-tenant.ts`), because the tenant on the panel never
 *    comes from the request at all.
 *  - **The tenant enters from the session row, never from the client (rule 2,
 *    DEC-135).** `levantarSesionPanel` resolves the token through the audited
 *    unscoped lookups in `src/aislamiento-prisma.ts` (the same treatment the agent
 *    token got), and each handler runs inside `conTenantActivo(sesion.tenant.…)` — the
 *    exact mechanism DEC-135 names (`entrarContextoTenant`), under the name this
 *    repository actually exports. A client-supplied `X-Tenant-Id` on a panel route is
 *    ignored because the header hooks never even read it there.
 *
 * The login route is the one place a user is found before any tenant exists: the
 * credentials name no tenant (rule 2), so the lookup runs by unique `correo` on the
 * raw client, one audited exception like the agent token. Everything after the login
 * — every session read, every session write — is tenant-scoped by the extension.
 */

/** The one cookie that carries the session token (DEC-134, design.md). */
const NOMBRE_COOKIE = 'zd_panel_session';

/** 30 days, fixed: the `Max-Age` the cookie header says and the TTL `expiraEn` stores. */
const SEGUNDOS_VIDA_SESION = 60 * 60 * 24 * 30;
const MILISEGUNDOS_VIDA_SESION = SEGUNDOS_VIDA_SESION * 1000;

/** The resolved session the hook attaches to a request, as the lookup returns it. */
export interface SesionResuelta {
  id: string;
  usuarioId: string;
  tenantId: string;
  tenantNombre: string;
  expiraEn: Date;
  usuarioActivo: boolean;
  tenantActivo: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `levantarSesionPanel`; a handler without it is a programmer error. */
    sesionPanel?: SesionResuelta;
  }
}

interface IngresarBody {
  correo: string;
  clave: string;
}

/**
 * Strict body, `propertyNames` included for the reason `registroAutomatizacionSchema`
 * documents: under Fastify's `removeAdditional` an unknown key would otherwise be
 * stripped and the body accepted. So a `tenantId` — or any other stray property — in
 * the login body is a `400`, never a silent drop (rule 2: the route takes no tenant
 * from the client in any form).
 */
const ingresarSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: { enum: ['correo', 'clave'] },
  required: ['correo', 'clave'],
  properties: {
    correo: { type: 'string', minLength: 1, maxLength: 254 },
    clave: { type: 'string', minLength: 1 },
  },
} as const;

/** Serializes the session cookie with every DEC-134 attribute. */
function cookieDeSesion(tokenPlano: string): string {
  return (
    `${NOMBRE_COOKIE}=${tokenPlano}; HttpOnly; Path=/; ` +
    `Max-Age=${SEGUNDOS_VIDA_SESION}; SameSite=Lax; Secure`
  );
}

/** The logout twin: same shape, empty value, expired immediately. */
function cookieVacia(): string {
  return `${NOMBRE_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure`;
}

/**
 * One cookie value out of a `Cookie` request header, by name. Hand-rolled on purpose:
 * the panel surface needs exactly one cookie, and the project adds no dependency for a
 * single fixed pair. A repeated cookie name yields the first one, which is all the
 * hook needs — the token is validated against the database, not trusted by shape.
 */
function leerCookie(cabecera: string | undefined, nombre: string): string | null {
  if (cabecera === undefined) {
    return null;
  }
  for (const parte of cabecera.split(';')) {
    const recortada = parte.trim();
    const igual = recortada.indexOf('=');
    if (igual === -1) {
      continue;
    }
    if (recortada.slice(0, igual) === nombre) {
      return recortada.slice(igual + 1);
    }
  }
  return null;
}

/**
 * The panel route pre-handler hook: resolves the session cookie against `SesionPanel`
 * and attaches the row to `request.sesionPanel`. Every refusal below returns a reply
 * before the handler — unknown token, expired row (cleaned up on use, per the spec),
 * deactivated tenant, deactivated user — and a request that passes attaches the
 * session whose `tenantId` the handlers then enter context with (DEC-135).
 *
 * Route-level `preHandler`, not a global hook: the header-based tenant hooks already
 * run for every route, and only routes that opt into panel authentication apply this
 * one — the same closed, explicit style as the exemption allowlist.
 */
export function levantarSesionPanel(prisma: PrismaAislado) {
  return async function sesionDeLaCookie(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = leerCookie(request.headers.cookie, NOMBRE_COOKIE);
    if (token === null) {
      return reply.code(401).send({ error: 'sesion-invalida' });
    }
    const sesion = await prisma.sesionPanel.buscarPorTokenHash(hashTokenSesion(token));
    if (sesion === null) {
      return reply.code(401).send({ error: 'sesion-invalida' });
    }
    if (sesion.expiraEn.getTime() <= Date.now()) {
      // Spec: the expired row is cleaned up when it is used, from the session's own
      // tenant — a scoped delete through the same extension every handler relies on.
      await conTenantActivo({ id: sesion.tenantId, nombre: sesion.tenantNombre }, async () => {
        await prisma.sesionPanel.deleteMany({ where: { id: sesion.id } });
      });
      return reply.code(401).send({ error: 'sesion-expirada' });
    }
    if (!sesion.tenantActivo) {
      return reply.code(409).send({ error: 'tenant-desactivado' });
    }
    if (!sesion.usuarioActivo) {
      return reply.code(401).send({ error: 'sesion-invalida' });
    }
    request.sesionPanel = sesion;
  };
}

/**
 * The three auth endpoints (DEC-136). `ingresar` is public; `salir` and `sesion` run
 * through `levantarSesionPanel`. All three are on the exemption allowlist in
 * `src/contexto-tenant.ts` (task 2.4): the panel surface never resolves a tenant from
 * a header.
 */
export function registerPanelAuthRoutes(app: FastifyInstance, prisma: PrismaAislado): void {
  app.post<{ Body: IngresarBody }>(
    '/api/panel/auth/ingresar',
    // Wrapped in `{ body }` like `registroAutomatizacionSchema`: a route schema
    // passed bare is not applied to the body at all by Fastify, so the strict
    // shape above would silently not exist.
    { schema: { body: ingresarSchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }
      const { correo, clave } = request.body;
      // The login's one audited unscoped read (DEC-133, DEC-135): found by unique
      // email, tenant from the row. Every failure below is the same generic `401`
      // (spec: "correo o clave incorrectos") except the deactivated tenant, which the
      // spec pins as `409 tenant-desactivado` — the row is real and its tenant is
      // known dead, the same answer the header hooks give a deactivated tenant.
      const usuario = await prisma.usuario.buscarPorCorreo(correo);
      if (usuario === null || !usuario.activo) {
        return reply.code(401).send({ error: 'correo-o-clave-incorrectos' });
      }
      if (!usuario.tenantActivo) {
        return reply.code(409).send({ error: 'tenant-desactivado' });
      }
      const claveValida = await verificarClave(clave, usuario.claveHash);
      if (!claveValida) {
        return reply.code(401).send({ error: 'correo-o-clave-incorrectos' });
      }

      const { tokenPlano, tokenHash } = generarTokenSesion();
      const expiraEn = new Date(Date.now() + MILISEGUNDOS_VIDA_SESION);
      // The tenant enters from the user's own row (rule 2) and the extension injects
      // it into the create (DEC-13); the client never names one. Only the token's hash
      // reaches the database (DEC-134).
      await conTenantActivo({ id: usuario.tenantId, nombre: usuario.tenantNombre }, async () => {
        await prisma.sesionPanel.create({
          data: conTenantInyectado({ tokenHash, usuarioId: usuario.id, expiraEn }),
        });
      });
      reply.header('set-cookie', cookieDeSesion(tokenPlano));
      return reply.code(200).send({
        usuario: { id: usuario.id, correo: usuario.correo, nombre: usuario.nombre },
        tenant: { id: usuario.tenantId, nombre: usuario.tenantNombre },
      });
    },
  );

  app.post(
    '/api/panel/auth/salir',
    { preHandler: [levantarSesionPanel(prisma)] },
    async (request, reply) => {
      const sesion = request.sesionPanel!;
      // A scoped delete inside the session's own tenant: the row goes, the cookie is
      // cleared, and the same token is 401 from then on (spec).
      await conTenantActivo({ id: sesion.tenantId, nombre: sesion.tenantNombre }, async () => {
        await prisma.sesionPanel.delete({ where: { id: sesion.id } });
      });
      reply.header('set-cookie', cookieVacia());
      return reply.code(200).send({ ok: true });
    },
  );

  app.get(
    '/api/panel/auth/sesion',
    { preHandler: [levantarSesionPanel(prisma)] },
    async (request, reply) => {
      const sesion = request.sesionPanel!;
      // The handler runs inside the context entered with the session's tenantId
      // (DEC-135), so this user read is scoped by the extension — the point the
      // two-tenant isolation test leans on. The tenant name comes from the session
      // row itself, so the answer needs no second unscoped read.
      return conTenantActivo({ id: sesion.tenantId, nombre: sesion.tenantNombre }, async () => {
        const usuario = await prisma.usuario.findUnique({
          where: { id: sesion.usuarioId },
          select: { id: true, correo: true, nombre: true },
        });
        if (usuario === null) {
          // The hook validated the row moments ago; a null here means the user
          // vanished between lookup and handler — fail closed like an invalid token.
          reply.code(401);
          return { error: 'sesion-invalida' };
        }
        return {
          usuario,
          tenant: { id: sesion.tenantId, nombre: sesion.tenantNombre },
        };
      });
    },
  );
}