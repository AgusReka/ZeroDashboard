import { Writable } from 'node:stream';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { registerPanelAuthRoutes } from './panel-auth.js';
import { registerUsuarioPanelRoutes } from './usuarios-panel.js';
import { databaseUrl } from './consola-auth-apoyo.js';

export { alcanzable, motivoSkip } from './consola-auth-apoyo.js';

process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/**
 * CH-28 shared setup for the live-database panel-user suites: an app with the tenant
 * hooks, the user routes and the panel login, so a test can create a user from the
 * "console" and log into the panel with the generated password in the same app. The
 * operator guard is left out on purpose: `src/rutas.test.ts` proves it covers these
 * routes. The logger writes to a buffer so a suite can assert a password never reached it.
 */
export interface Montaje {
  app: FastifyInstance;
  db: PrismaClient;
  prisma: PrismaAislado;
  /** Two active tenants, created for the suite and deleted by `desmontar`. */
  tenantA: string;
  tenantB: string;
  /** Everything the app logged, as text. */
  log: () => string;
}

export async function montar(etiqueta: string): Promise<Montaje> {
  const partes: string[] = [];
  const stream = new Writable({
    write(trozo, _codificacion, listo) {
      partes.push(String(trozo));
      listo();
    },
  });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const prisma = extenderConAislamiento(db);
  const app = Fastify({ logger: { level: 'trace', stream } });
  registrarContextoTenant(app, prisma);
  registerUsuarioPanelRoutes(app, prisma);
  registerPanelAuthRoutes(app, prisma);
  await app.ready();
  const marca = `${etiqueta} ${Date.now()}`;
  const tenantA = (await db.tenant.create({ data: { nombre: `CH-28 A ${marca}` } })).id;
  const tenantB = (await db.tenant.create({ data: { nombre: `CH-28 B ${marca}` } })).id;
  return { app, db, prisma, tenantA, tenantB, log: () => partes.join('') };
}

export async function desmontar(m: Montaje): Promise<void> {
  const tenants = [m.tenantA, m.tenantB];
  // `SesionPanel.usuario` cascades; the tenant foreign keys are RESTRICT, so users go first.
  await m.db.usuario.deleteMany({ where: { tenantId: { in: tenants } } });
  await m.db.tenant.deleteMany({ where: { id: { in: tenants } } });
  await m.db.$disconnect();
  await m.app.close();
}

/** A unique, lowercase email per call, so parallel suites and reruns never collide. */
export function correoUnico(prefijo: string): string {
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@prueba.test`;
}

export function crear(m: Montaje, tenant: string, cuerpo: unknown) {
  return m.app.inject({ method: 'POST', url: '/usuarios', headers: { 'x-tenant-id': tenant }, payload: cuerpo as object });
}

export function accion(m: Montaje, tenant: string, id: string, verbo: 'clave' | 'desactivar' | 'reactivar') {
  return m.app.inject({ method: 'POST', url: `/usuarios/${id}/${verbo}`, headers: { 'x-tenant-id': tenant } });
}

export function ingresarPanel(m: Montaje, correo: string, clave: string) {
  return m.app.inject({ method: 'POST', url: '/api/panel/auth/ingresar', payload: { correo, clave } });
}

/** The panel cookie a successful panel login set, as a `Cookie` header value. */
export function cookiePanel(setCookie: string | string[] | undefined): string {
  const linea = (Array.isArray(setCookie) ? setCookie : [setCookie ?? '']).find((l) => l.startsWith('zd_panel_session='));
  return (linea ?? '').split(';')[0];
}
