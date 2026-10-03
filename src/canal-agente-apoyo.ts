import { once } from 'node:events';
import net from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import { CanalAgente, type PuertoDeSesion, type SolicitudSesion } from './canal-agente.js';

/** Shared fixtures of the `CanalAgente` suites (CH-19c1). Not a test file: it registers nothing. */
export const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};
// `ejecutarConsulta` reads its budgets through `loadConfig()`, which demands these.
process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= `postgresql://u:p@${objetivo.host}:${objetivo.port}/${objetivo.database}`;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/** Nobody listens on port 1, so a destination that pg actually dialled would fail. */
export const SIN_DIAL = { host: '127.0.0.1', port: 1, database: 'x', user: 'x', password: 'x' };
export const SOLICITUD: SolicitudSesion = { agenteId: 'agente-a', tenantId: 'tenant-a', host: '127.0.0.1', puerto: 1 };
export const TECHO_MS = 2500;

const servidor = new WebSocketServer({ host: '127.0.0.1', port: 0, perMessageDeflate: false });
await once(servidor, 'listening');

/** To be called from the suite's `after`. */
export function cerrarServidor(): void {
  for (const socket of servidor.clients) socket.terminate();
  servidor.close();
}

/** One real ws pair over the loopback server. */
export async function par(): Promise<{ motor: WebSocket; agente: WebSocket }> {
  const { port } = servidor.address() as net.AddressInfo;
  const agente = new WebSocket(`ws://127.0.0.1:${port}`);
  const [[motor]] = await Promise.all([once(servidor, 'connection'), once(agente, 'open')]);
  return { motor, agente };
}

/** A session port that records its calls and runs `alPedir` on each request. */
export function puerto(alPedir: (canal: CanalAgente) => void = () => {}) {
  const abiertos: CanalAgente[] = [];
  const pedidos: CanalAgente[] = [];
  const soltados: CanalAgente[] = [];
  const p: PuertoDeSesion = {
    pedirSesion: (canal) => {
      pedidos.push(canal);
      alPedir(canal);
    },
    soltarSesion: (canal) => void soltados.push(canal),
  };
  const abrir = (): CanalAgente => {
    const canal = new CanalAgente(SOLICITUD, p);
    abiertos.push(canal);
    return canal;
  };
  return { abrir, abiertos, pedidos, soltados };
}

export const tic = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** Rejects after `ms`, so a hang fails the case instead of the whole run. */
export const techo = (ms: number): Promise<never> =>
  new Promise((_, rechazar) => setTimeout(() => rechazar(new Error(`no answer within ${ms} ms`)), ms).unref());
