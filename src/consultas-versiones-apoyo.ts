import net from 'node:net';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { registerConsultaGuardadaRoutes } from './consultas-guardadas.js';
import { registrarContextoTenant } from './contexto-tenant.js';

/**
 * CH-25: the setup the saved-query edit and history route tests share (a live PostgreSQL
 * target, an app with the saved-query routes, two tenants and the request helpers), kept in
 * one place so the two test files do not repeat it. Same target and variables as
 * `src/consultas-guardadas.test.ts` (see `src/aislamiento.test.ts`). Not a test file.
 */
const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};
const databaseUrl =
  `postgresql://${encodeURIComponent(objetivo.user)}:${encodeURIComponent(objetivo.password)}` +
  `@${objetivo.host}:${objetivo.port}/${objetivo.database}`;

function esAlcanzable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const cerrar = (alcanzable: boolean): void => {
      socket.destroy();
      resolve(alcanzable);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => cerrar(true));
    socket.once('timeout', () => cerrar(false));
    socket.once('error', () => cerrar(false));
  });
}

export const alcanzable = await esAlcanzable(objetivo.host, objetivo.port, 1000);
export const motivoSkip =
  `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — ` +
  'bring up the Compose db service and set TEST_DB_* (see src/aislamiento.test.ts)';

/** A saved query as the create and the edit answer it. */
export interface Consulta {
  id: string;
  nombre: string;
  descripcion: string | null;
  sql: string;
  parametros: Array<{ nombre: string; tipo: string }>;
  version: number;
  nota: string | null;
}

/** The content the helpers save by default; a test overrides what it needs. */
export const contenido = {
  nombre: 'Stock',
  descripcion: 'Productos',
  sql: 'SELECT :a',
  parametros: [{ nombre: 'a', tipo: 'numero' }],
};

/** Connects, builds the app and creates two tenants. Call from `before`; `cerrar` from `after`. */
export async function montarEntorno() {
  const marca = `CH-25 ${Date.now()}`;
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const app: FastifyInstance = Fastify({ logger: false });
  const aislado = extenderConAislamiento(db);
  registrarContextoTenant(app, aislado);
  registerConsultaGuardadaRoutes(app, aislado);
  await app.ready();

  const tenantIds: string[] = [];
  async function tenant(etiqueta: string): Promise<string> {
    const fila = await db.tenant.create({ data: { nombre: `${marca} ${etiqueta}` } });
    tenantIds.push(fila.id);
    return fila.id;
  }
  const a = await tenant('A');
  const b = await tenant('B');

  const cabecera = (tenantId: string): Record<string, string> => ({ 'x-tenant-id': tenantId });

  return {
    db,
    app,
    a,
    b,
    cabecera,

    /** Saves a query through the real create route and returns it. */
    async crear(tenantId: string, extra: Record<string, unknown> = {}): Promise<Consulta> {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/consultas-guardadas',
        headers: cabecera(tenantId),
        payload: { ...contenido, ...extra },
      });
      if (respuesta.statusCode !== 201) {
        throw new Error(`el alta falló: ${respuesta.statusCode} ${respuesta.body}`);
      }
      return (respuesta.json() as { consultaGuardada: Consulta }).consultaGuardada;
    },

    editar(tenantId: string, id: string, payload: unknown) {
      return app.inject({
        method: 'PUT',
        url: `/consultas-guardadas/${encodeURIComponent(id)}`,
        headers: cabecera(tenantId),
        payload: payload as object,
      });
    },

    versiones(tenantId: string, id: string) {
      return app.inject({
        method: 'GET',
        url: `/consultas-guardadas/${encodeURIComponent(id)}/versiones`,
        headers: cabecera(tenantId),
      });
    },

    version(tenantId: string, id: string, numero: string) {
      return app.inject({
        method: 'GET',
        url: `/consultas-guardadas/${encodeURIComponent(id)}/versiones/${encodeURIComponent(numero)}`,
        headers: cabecera(tenantId),
      });
    },

    restaurar(tenantId: string, id: string, numero: string, payload?: unknown) {
      return app.inject({
        method: 'POST',
        url: `/consultas-guardadas/${encodeURIComponent(id)}/versiones/${encodeURIComponent(numero)}/restaurar`,
        headers: cabecera(tenantId),
        ...(payload === undefined ? {} : { payload: payload as object }),
      });
    },

    fila: (id: string) => db.consultaGuardada.findUniqueOrThrow({ where: { id } }),

    historial: (id: string) =>
      db.consultaGuardadaVersion.findMany({ where: { consultaGuardadaId: id }, orderBy: { version: 'asc' } }),

    async cerrar(): Promise<void> {
      if (tenantIds.length > 0) {
        await db.consultaGuardadaVersion.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await db.consultaGuardada.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      }
      await db.$disconnect();
      await app.close();
    },
  };
}

export type Entorno = Awaited<ReturnType<typeof montarEntorno>>;
