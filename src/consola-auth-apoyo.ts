import net from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from './aislamiento-prisma.js';
import { generarTokenSesion, hashearClave } from './crypto-auth.js';

/**
 * CH-29 shared setup for the live-database console-auth suites, as
 * `src/consultas-versiones-apoyo.ts` is for CH-25: the `TEST_DB_*` target, the
 * reachability probe that turns an absent database into a skip, and operator and
 * session fixtures. Not a test file itself (no `.test.ts`), so the runner never
 * executes it on its own.
 */

export const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};

export const databaseUrl =
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
  'bring up the Compose db service and set TEST_DB_*';

export function crearCliente(): PrismaAislado {
  return extenderConAislamiento(new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) }));
}

/** A unique operator name per run, so parallel suites and reruns never collide. */
export function nombreUnico(prefijo: string): string {
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function crearOperador(prisma: PrismaAislado, nombre: string, clave: string) {
  return prisma.operador.create({ data: { nombre, claveHash: await hashearClave(clave) } });
}

/** A session row for `operadorId` and the plain token its cookie would carry. */
export async function crearSesion(prisma: PrismaAislado, operadorId: string, expiraEn: Date) {
  const { tokenPlano, tokenHash } = generarTokenSesion();
  const sesion = await prisma.sesionConsola.create({ data: { tokenHash, operadorId, expiraEn } });
  return { sesion, tokenPlano };
}

/** Deletes the operators a suite created; their sessions go with them (CASCADE). */
export async function borrarOperadores(prisma: PrismaAislado, nombres: readonly string[]): Promise<void> {
  await prisma.operador.deleteMany({ where: { nombre: { in: [...nombres] } } });
}
