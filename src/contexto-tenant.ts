import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyInstance } from 'fastify';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { RUTAS_ESTILOS } from './estilos-rutas.js';

/**
 * The per-request active tenant (DEC-13 + DEC-15), and the two `onRequest` hooks that
 * put it there.
 *
 * This is the first request-context mechanism in the project. It exists so route
 * handlers stop mentioning tenants at all: the tenant enters through one header, is
 * validated once, and is read back by `src/aislamiento-prisma.ts` on every query
 * against a scoped model. Nothing else is allowed to resolve a tenant.
 *
 * `node:async_hooks` is built into Node, so this adds no dependency.
 */

export interface TenantActivo {
  readonly id: string;
  readonly nombre: string;
}

/**
 * The store is a **mutable box**, not the tenant itself, because the two halves have
 * different timing: the context has to be entered *synchronously* (hook 1, so every
 * later continuation inherits it) while resolving the tenant is asynchronous (hook 2,
 * which reads the database). A box lets hook 2 fill in what hook 1 could not yet know.
 */
interface Portador {
  tenant: TenantActivo | null;
}

const almacen = new AsyncLocalStorage<Portador>();

/** The one header that carries the active tenant. Node lowercases incoming names. */
const ENCABEZADO_TENANT = 'x-tenant-id';

/**
 * Not a `4xx`. Reaching this means a scoped query ran outside the hook chain — a
 * programmer error, not a malformed request — so it surfaces as a `500`, loudly.
 * A silently unfiltered query is the exact cross-tenant leak this change exists to
 * prevent, which is why the absence of a context can never be a pass-through.
 */
export class ErrorSinTenantActivo extends Error {
  constructor() {
    super(
      'No hay tenant activo en el contexto de la solicitud: ' +
        'la consulta se ejecutó fuera de los hooks de contexto de tenant.',
    );
    this.name = 'ErrorSinTenantActivo';
  }
}

/** Reads the active tenant without demanding one. Tests and diagnostics only. */
export function tenantActivoOpcional(): TenantActivo | null {
  return almacen.getStore()?.tenant ?? null;
}

/** The enforcing read. Throws `ErrorSinTenantActivo` outside a tenant-bearing request. */
export function exigirTenantActivo(): TenantActivo {
  const tenant = tenantActivoOpcional();
  if (tenant === null) {
    throw new ErrorSinTenantActivo();
  }
  return tenant;
}

/**
 * Runs `fn` inside a context naming `tenant`. There is deliberately no exported way to
 * mutate an existing context from a handler.
 *
 * Production has exactly two entries into a tenant context: the request hooks below,
 * and — since CH-13 (design-level resolution under DEC-13/DEC-14) — the scheduler in
 * `src/planificador.ts`, which has no request to read a header from. The scheduler
 * derives `tenant` only from own-database `Tenant` rows with `activo = true`, never from
 * any externally supplied value (regla 2), and runs one tenant's automations per
 * context. Its boot sweep (CH-17a, DEC-99) also enters deactivated tenants, from the same
 * rows, only to close their `en-curso` runs; it runs nothing there. Tests and seeds use
 * it too.
 *
 * Queries must start inside `fn`: a Prisma query is a lazy thenable that runs only when
 * awaited, so one returned bare from a non-`async` `fn` runs after this context has been
 * left, where it fails closed. `await` it inside `fn`.
 */
export function conTenantActivo<T>(tenant: TenantActivo, fn: () => Promise<T>): Promise<T> {
  return almacen.run({ tenant }, fn);
}

/**
 * The closed exemption allowlist, matched on the **route pattern**
 * (`request.routeOptions.url`) rather than on the raw URL, so `/consola-falsa` cannot
 * pose as `/consola`. Everything not listed here is scoped by default, including every
 * route added later and every URL that matches no route at all — an unmatched URL with
 * no header is refused before the `404`, which is fail-closed and leaks nothing.
 *
 * Only `GET` is exempt for `/health`, `/consola` and `/contrato`: the table in
 * `design.md` names the method, and widening it would be a decision, not an
 * implementation detail.
 *
 * `/contrato` joins the list under DEC-24. The canonical contract is not tenant data at
 * all: it is a static catalog, identical for every tenant, and tenant-agnostic by
 * construction rather than by filtering. Its handler holds no Prisma client — the
 * registrar in `src/contrato-rutas.ts` takes the app and nothing else — so the route has
 * no scoped model it could leak even if a later edit tried to reach for one. That
 * structural absence, not a promise about the handler's body, is what makes exempting it
 * safe.
 *
 * The template catalog joins under DEC-61 with four exact rows, each one a method paired
 * with a route pattern: `GET`/`POST /plantillas` and `GET`/`PUT /plantillas/:id`. A
 * template is a global catalog entry, not tenant data, and its registrar is handed the
 * `plantilla` delegate alone, so an exempt handler has no scoped model within reach.
 * The rows are exact on purpose, and a `/plantillas/` prefix would be wrong: it would
 * also exempt `POST /plantillas/:id/prueba`, which resolves a tenant-owned `Conexion`
 * and must stay scoped (DEC-62). `DELETE` and `PATCH` are not listed because a template
 * is replaced in place and never deleted (DEC-68).
 *
 * The shared stylesheet joins under DEC-124 with five exact `GET` rows, one per file,
 * built from `RUTAS_ESTILOS`: the same list `src/estilos-rutas.ts` registers the routes
 * from, so a route and its row cannot diverge and a new file inherits nothing. The assets
 * are identical for every tenant and their registrar receives no database client, the
 * DEC-24 argument again. There is no `/ui/` prefix row and no `HEAD` row: an unlisted
 * URL, a look-alike such as `/ui-falso/...`, and any other method stay scoped.
 */
const PLANTILLAS_EXENTAS: ReadonlySet<string> = new Set([
  'GET /plantillas',
  'POST /plantillas',
  'GET /plantillas/:id',
  'PUT /plantillas/:id',
]);

/**
 * The panel surface (CH-22a, DEC-135): exact rows, one per public endpoint of
 * `src/panel-auth.ts`, plus the read of CH-22b (DEC-137). The panel never resolves a tenant from the request — the login
 * reads the user by email before any tenant exists, and every authenticated route
 * derives the tenant exclusively from the session cookie (rule 2). These rows exist
 * so the header hooks above do not demand an `X-Tenant-Id` that the panel client has
 * no business sending; the session hook in `src/panel-auth.ts` is the only tenant
 * resolution the surface trusts. Rows are exact like every other entry here: a
 * look-alike path or a different method stays scoped and fails closed.
 *
 * Exported read-only so the console's operator guard (CH-29, DEC-152) builds its own
 * exemption list from this set: a new public panel row needs no console session either.
 */
export const RUTAS_PANEL_PUBLICAS: ReadonlySet<string> = new Set([
  'POST /api/panel/auth/ingresar',
  'POST /api/panel/auth/salir',
  'GET /api/panel/auth/sesion',
  'GET /api/panel/automatizaciones',
  'GET /api/panel/automatizaciones/:id/ajustes',
  'PUT /api/panel/automatizaciones/:id/ajustes',
]);

/**
 * The stylesheet rows (DEC-124 A3). Exported only so `src/estilos-rutas.test.ts` can
 * assert they equal the registered routes exactly; nothing else reads it.
 */
export const ESTILOS_EXENTOS: ReadonlySet<string> = new Set(
  RUTAS_ESTILOS.map((ruta) => 'GET ' + ruta),
);

function esExenta(metodo: string, patron: string | undefined): boolean {
  if (patron === undefined) {
    return false;
  }
  // Liveness has no tenant and must answer before any tenant exists; the console page
  // *is* where the operator picks one, so needing a tenant to load it would deadlock;
  // and the contract describes what every tenant must expose, so demanding one in order
  // to read it would be asking the question backwards. `GET /panel` joins them under
  // DEC-135 for the mirror reason on the client surface: the panel never sends
  // `X-Tenant-Id` (rule 2), so demanding one would make the P-01 login screen
  // unreachable — an unauthenticated browser has no header to send. The row is NOT in
  // `RUTAS_PANEL_PUBLICAS` on purpose: unlike the three auth endpoints, the page's
  // tenant is resolved from the session row inside its handler (via the same
  // `levantarSesionPanel` hook), never from the request.
  if (
    metodo === 'GET' &&
    (patron === '/health' || patron === '/consola' || patron === '/contrato' || patron === '/panel')
  ) {
    return true;
  }
  // The template catalog is shared by every tenant (DEC-61); see PLANTILLAS_EXENTAS.
  if (PLANTILLAS_EXENTAS.has(`${metodo} ${patron}`)) {
    return true;
  }
  // The shared stylesheet is the same for every tenant (DEC-124); see ESTILOS_EXENTOS.
  if (ESTILOS_EXENTOS.has(`${metodo} ${patron}`)) {
    return true;
  }
  // The panel authenticates by session cookie, not by header (DEC-135); see
  // RUTAS_PANEL_PUBLICAS. The header hooks must not demand `X-Tenant-Id` there.
  if (RUTAS_PANEL_PUBLICAS.has(`${metodo} ${patron}`)) {
    return true;
  }
  // CH-29 (DEC-151, DEC-152): the console's login and logout name an operator, never a
  // tenant (DEC-15 is unchanged: tenant routes still carry the header). Exact POST rows;
  // the operator guard, not this list, decides who may call them.
  if (metodo === 'POST' && (patron === '/consola/ingresar' || patron === '/consola/salir')) {
    return true;
  }
  // Bootstrap: requiring a tenant in order to create the first tenant is unsatisfiable.
  // The exact match plus the slash-terminated prefix is what keeps `/tenants-falsos`
  // out — a bare `startsWith('/tenants')` would let it in.
  return patron === '/tenants' || patron.startsWith('/tenants/');
}

/**
 * Registers BOTH `onRequest` hooks. **MUST be called before any `register*Routes`**:
 * Fastify runs same-name hooks in registration order, and a route registered ahead of
 * these would run its handler with no store in place.
 */
export function registrarContextoTenant(app: FastifyInstance, prisma: PrismaAislado): void {
  // Hook 1 — enter the context synchronously and hand the rest of the lifecycle to
  // `done` from inside it. Callback-style `run(store, done)` in `onRequest` is the
  // mechanism `@fastify/request-context` itself uses: what is entered here propagates
  // through the remainder of Fastify's async chain.
  //
  // `onRequest`, not `preHandler`: `preHandler` runs after body validation, so a
  // scoped query from a future `preValidation` hook would escape the context entirely.
  app.addHook('onRequest', (_request, _reply, done) => {
    almacen.run({ tenant: null }, done);
  });

  // Hook 2 — resolve and validate. Every exit below returns a reply, so a rejected
  // request never reaches a handler, which is DEC-14's "rejected before any handler
  // logic" read literally.
  app.addHook('onRequest', async (request, reply) => {
    const portador = almacen.getStore();
    if (portador === undefined) {
      // Unreachable while hook 1 is registered first. If it ever is reachable, that is
      // the registration-order bug this file warns about, and it must not be silent.
      throw new ErrorSinTenantActivo();
    }

    if (esExenta(request.method, request.routeOptions.url)) {
      return;
    }

    const crudo = request.headers[ENCABEZADO_TENANT];
    // A repeated header arrives as an array, which is not an unambiguous declaration
    // of one active tenant — it falls into the same rejection as sending none.
    const id = typeof crudo === 'string' ? crudo.trim() : '';
    if (id === '') {
      return reply.code(400).send({ error: 'tenant-no-indicado' });
    }

    // `Tenant` is not a scoped model, so this lookup runs through the extended client
    // untouched — there is no un-scoped handle anywhere for a handler to reach for.
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, nombre: true, activo: true },
    });
    if (tenant === null) {
      return reply.code(404).send({ error: 'tenant-no-encontrado' });
    }
    if (!tenant.activo) {
      return reply.code(409).send({ error: 'tenant-desactivado' });
    }

    portador.tenant = { id: tenant.id, nombre: tenant.nombre };
  });
}
