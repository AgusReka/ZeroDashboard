import type { PrismaClient } from './generated/prisma/client.js';
import { exigirTenantActivo } from './contexto-tenant.js';

/**
 * DEC-13's structural half: a Prisma Client Extension that injects the active tenant
 * into every query against a scoped model, so no route ever writes `where: { tenantId }`
 * by hand and no route added later can forget to.
 *
 * Two properties make this load-bearing rather than defensive:
 *
 *  - **No context is a thrown error, never an unfiltered query.** `exigirTenantActivo()`
 *    runs before `query(args)` is ever reached.
 *  - **An unanticipated operation is also a thrown error.** The map below is *closed*,
 *    so a future contributor's `upsert` fails in their first test run instead of
 *    quietly crossing tenants in production.
 *
 * **Known limits, stated rather than prevented.** `$queryRaw` / `$executeRaw` bypass
 * model-level extensions (`src/health.ts` uses one, on no scoped model). Nested writes
 * through a relation are likewise unreached; no route uses them. Both are the residual
 * surface of the single point of failure DEC-13 knowingly accepted.
 * `src/consulta-ejecucion.ts` is outside this boundary altogether — it talks to the
 * *tenant's* replica through `pg`, which is a different database.
 *
 * CH-13 adds `Automatizacion` and `Ejecucion` (DEC-74, X2). Both are tenant data with a
 * direct `tenantId`, and the scheduler reaches them only through this same extension,
 * inside a context entered from the tenant's own `Tenant` row — it never writes
 * `tenantId` into a `where` itself.
 *
 * CH-19b adds `Agente` (DEC-121). Every route reaches it through this extension like
 * any other tenant model. Its one exception is `agente.buscarPorTokenHash` below: an
 * agent's token is resolved before any tenant context exists, so that single typed
 * lookup runs on the raw client and returns only `id`, `tenantId` and the tenant's
 * state. It is the only unscoped read of a scoped model in this module, by design.
 *
 * CH-22a adds `Usuario` and `SesionPanel` (DEC-133, DEC-134). Both carry a direct
 * `tenantId` and both are tenant data; the panel's session resolution (DEC-135) runs
 * before any tenant context exists and gets the same treatment the agent token got —
 * an explicit audited lookup, added with the routes, never a pass-through here.
 */
const MODELOS_AISLADOS = new Set([
  'Conexion',
  'ConsultaGuardada',
  'VistaCanonica',
  'Automatizacion',
  'Ejecucion',
  'Agente',
  'Usuario',
  'SesionPanel',
]);

/**
 * Operations whose `where` is a filter. The injected predicate is **conjoined**, never
 * spread: a caller-supplied `tenantId` — or an `OR` that would widen the filter —
 * cannot displace it, because `AND` applies at the top level whatever the inner
 * object says.
 */
const OPERACIONES_FILTRO = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

/**
 * Operations whose `where` is a unique selector. Adding a non-unique field to it is
 * legal since Prisma 5 widened `WhereUniqueInput`, and this project is on 7.10. A
 * supplied `tenantId` is overwritten rather than conjoined because there is no
 * combinator in a unique selector to hide behind.
 */
const OPERACIONES_UNICO = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete']);

/**
 * Raised for an operation the map below does not list — `upsert`, `aggregateRaw`, and
 * anything a future Prisma release adds. `upsert` in particular needs both a scoped
 * `where` and a scoped `create`, and no route uses it; the day one does, it gets a
 * deliberate line here rather than an accidental pass-through.
 */
export class ErrorAislamientoNoSoportado extends Error {
  constructor(operacion: string) {
    super(
      `La operación "${operacion}" no está contemplada por el aislamiento por tenant. ` +
        'Agregue un caso explícito en aplicarAlcance() antes de usarla.',
    );
    this.name = 'ErrorAislamientoNoSoportado';
  }
}

type Argumentos = Record<string, unknown>;

function comoObjeto(valor: unknown): Argumentos {
  return typeof valor === 'object' && valor !== null ? (valor as Argumentos) : {};
}

/**
 * The closed map itself, exported so it can be unit-tested per operation without a
 * database. Returns a new `args`; the caller's object is never mutated.
 */
export function aplicarAlcance(
  operacion: string,
  args: Argumentos,
  tenantId: string,
): Argumentos {
  if (operacion === 'create') {
    return { ...args, data: { ...comoObjeto(args.data), tenantId } };
  }

  if (operacion === 'createMany' || operacion === 'createManyAndReturn') {
    const datos = args.data;
    // Prisma accepts either a single entry or an array here; the shape is preserved
    // so the injection is invisible to the caller.
    if (Array.isArray(datos)) {
      return { ...args, data: datos.map((entrada) => ({ ...comoObjeto(entrada), tenantId })) };
    }
    return { ...args, data: { ...comoObjeto(datos), tenantId } };
  }

  if (OPERACIONES_FILTRO.has(operacion)) {
    return { ...args, where: { AND: [comoObjeto(args.where), { tenantId }] } };
  }

  if (OPERACIONES_UNICO.has(operacion)) {
    return { ...args, where: { ...comoObjeto(args.where), tenantId } };
  }

  throw new ErrorAislamientoNoSoportado(operacion);
}

/**
 * Wraps a client so every query on a scoped model carries the active tenant.
 *
 * `src/server.ts` keeps only the return value: the raw client is not held in scope, so
 * there is no un-scoped handle for a handler to reach for. `Tenant` is deliberately
 * absent from `MODELOS_AISLADOS`, which is what lets the resolution hook and
 * `src/tenants.ts` use this same client with no escape hatch.
 */
export function extenderConAislamiento(prisma: PrismaClient) {
  return prisma.$extends({
    model: {
      agente: {
        /**
         * CH-19b (DEC-121): the single audited unscoped read of a scoped model. An agent
         * presents its token before any tenant context exists, so the tenant comes from
         * the matched row and never from the request (rule 2). It takes the hash, never
         * the token, finds only non-revoked agents, and returns the minimum: no hash and
         * no other column. `tenantActivo` is returned rather than filtered here so the
         * caller (19c1) can refuse a deactivated tenant explicitly.
         *
         * It runs on the raw client this function closes over, not on the extended one:
         * through the extended client the read would reach `$allOperations` below and
         * fail closed for want of a context. Every other `Agente` operation still does.
         */
        async buscarPorTokenHash(
          tokenHash: string,
        ): Promise<{ id: string; tenantId: string; tenantActivo: boolean } | null> {
          const fila = await prisma.agente.findUnique({
            where: { tokenHash, revocadoEn: null },
            select: { id: true, tenantId: true, tenant: { select: { activo: true } } },
          });
          return fila === null
            ? null
            : { id: fila.id, tenantId: fila.tenantId, tenantActivo: fila.tenant.activo };
        },
      },
      usuario: {
        /**
         * CH-22a (DEC-133, DEC-135): the login's single audited unscoped read. The panel
         * login happens before any tenant context exists (the credentials do not name a
         * tenant — rule 2), so the user is found by its unique `correo` on the raw
         * client, exactly like the agent token above, and the tenant comes from the
         * matched row. It takes the email, never a tenant, and returns what the login
         * route needs and nothing it may derivate from the request: the credentials to
         * verify, the user's own state, and the owning tenant's identity and state.
         * Every other `Usuario` operation stays scoped through `$allOperations`.
         */
        async buscarPorCorreo(
          correo: string,
        ): Promise<{
          id: string;
          correo: string;
          nombre: string | null;
          activo: boolean;
          claveHash: string;
          tenantId: string;
          tenantNombre: string;
          tenantActivo: boolean;
        } | null> {
          const fila = await prisma.usuario.findUnique({
            where: { correo },
            select: {
              id: true,
              correo: true,
              nombre: true,
              activo: true,
              claveHash: true,
              tenant: { select: { id: true, nombre: true, activo: true } },
            },
          });
          return fila === null
            ? null
            : {
                id: fila.id,
                correo: fila.correo,
                nombre: fila.nombre,
                activo: fila.activo,
                claveHash: fila.claveHash,
                tenantId: fila.tenant.id,
                tenantNombre: fila.tenant.nombre,
                tenantActivo: fila.tenant.activo,
              };
        },
      },
      sesionPanel: {
        /**
         * CH-22a (DEC-134, DEC-135): the session hook's single audited unscoped read,
         * the panel's mirror of `buscarPorTokenHash` above. A panel request presents its
         * cookie token before any tenant context exists, so the session is found by its
         * token hash on the raw client and the tenant comes from the session row — the
         * exact property DEC-135 makes load-bearing (the client's `X-Tenant-Id` is never
         * even read). It returns the minimum the hook needs to validate and enter the
         * context: the row's identity, its owner, expiry, and the state of both bound
         * rows. Every other `SesionPanel` operation stays scoped.
         */
        async buscarPorTokenHash(
          tokenHash: string,
        ): Promise<{
          id: string;
          usuarioId: string;
          tenantId: string;
          tenantNombre: string;
          expiraEn: Date;
          usuarioActivo: boolean;
          tenantActivo: boolean;
        } | null> {
          const fila = await prisma.sesionPanel.findUnique({
            where: { tokenHash },
            select: {
              id: true,
              usuarioId: true,
              tenantId: true,
              expiraEn: true,
              usuario: { select: { activo: true } },
              tenant: { select: { nombre: true, activo: true } },
            },
          });
          return fila === null
            ? null
            : {
                id: fila.id,
                usuarioId: fila.usuarioId,
                tenantId: fila.tenantId,
                tenantNombre: fila.tenant.nombre,
                expiraEn: fila.expiraEn,
                usuarioActivo: fila.usuario.activo,
                tenantActivo: fila.tenant.activo,
              };
        },
      },
    },
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!MODELOS_AISLADOS.has(model)) {
            return query(args);
          }
          // Before `query(args)`, always: there is no path from here to an unfiltered
          // read of a scoped model.
          const { id: tenantId } = exigirTenantActivo();
          return query(aplicarAlcance(operation, comoObjeto(args), tenantId));
        },
      },
    },
  });
}

/**
 * The extended client's type, propagated rather than cast away. The route modules take
 * this instead of `PrismaClient` so the mechanism this change adds stays visible in
 * every signature that depends on it.
 */
export type PrismaAislado = ReturnType<typeof extenderConAislamiento>;

/**
 * Declares that the isolation extension will supply `tenantId` for this `create`.
 *
 * A Prisma Client Extension rewrites *arguments* at runtime; it cannot rewrite the
 * generated delegate's input types, which still require the `tenant` relation. Both
 * alternatives are worse: writing `tenantId` by hand in the route is the exact thing
 * DEC-13 removes, and a bare `as` at each call site leaves an unexplained cast in
 * three files. One named function keeps the gap in the module that causes it, so a
 * reviewer finds it in one place and the route reads as the intent it has.
 *
 * It is a type-level statement only — it adds nothing at runtime, so it cannot be the
 * thing that makes a query scoped. `$allOperations` above is.
 */
export function conTenantInyectado<T extends object>(datos: T): T & { tenantId: string } {
  return datos as T & { tenantId: string };
}
