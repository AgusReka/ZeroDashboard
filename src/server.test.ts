import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { describe, test } from 'node:test';

/**
 * CH-14 task 5.10: `src/server.ts` builds the SMTP notifier at boot (DEC-86 and its
 * addendum). The file is the process entry point, so it is exercised as one: a child
 * process runs it and the test reads what it prints.
 *
 * The child's database is a closed port on purpose. Nothing at boot dials it, and a
 * scheduler tick that fires before the child is stopped fails to connect, so no suite's
 * live automation can be run (or mailed) from here.
 */
const DATABASE_URL_CERRADA = 'postgresql://nadie:nadie@127.0.0.1:1/nadie';
const CLAVE_PRUEBAS = 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';
const LIMITE_ARRANQUE_MS = 30_000;

interface Arranque {
  /** `null` while the child was still running when it was stopped. */
  codigo: number | null;
  escucho: boolean;
  /** Every stdout line pino wrote, parsed. */
  lineas: Record<string, unknown>[];
  /** stdout and stderr together, to search for anything that should never be printed. */
  salida: string;
}

function puertoLibre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address() as net.AddressInfo;
      servidor.close(() => resolve(port));
    });
  });
}

/**
 * Boots `src/server.ts` with `smtp` as its only `SMTP_*` variables and stops it as soon as
 * it listens or exits on its own.
 */
async function arrancar(smtp: Record<string, string>): Promise<Arranque> {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const nombre of Object.keys(env)) {
    if (nombre.startsWith('SMTP_')) delete env[nombre];
  }
  Object.assign(env, smtp, {
    APP_PORT: String(await puertoLibre()),
    DATABASE_URL: DATABASE_URL_CERRADA,
    CREDENTIAL_MASTER_KEY: CLAVE_PRUEBAS,
  });

  const hijo = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { env });
  let salida = '';
  let escucho = false;
  const lineas: Record<string, unknown>[] = [];
  let pendiente = '';

  const codigo = await new Promise<number | null>((resolve) => {
    const limite = setTimeout(() => hijo.kill(), LIMITE_ARRANQUE_MS);
    hijo.stdout.on('data', (trozo: Buffer) => {
      salida += trozo.toString();
      pendiente += trozo.toString();
      const partes = pendiente.split('\n');
      pendiente = partes.pop() ?? '';
      for (const parte of partes) {
        try {
          const linea = JSON.parse(parte) as Record<string, unknown>;
          lineas.push(linea);
          if (String(linea.msg).startsWith('Server listening')) {
            escucho = true;
            hijo.kill();
          }
        } catch {
          // Not a pino line: kept in `salida` only.
        }
      }
    });
    hijo.stderr.on('data', (trozo: Buffer) => {
      salida += trozo.toString();
    });
    hijo.once('exit', (codigoSalida) => {
      clearTimeout(limite);
      resolve(escucho ? null : codigoSalida);
    });
  });
  return { codigo, escucho, lineas, salida };
}

describe('server boot — SMTP notifier wiring (CH-14 5.10, DEC-86)', { timeout: 3 * LIMITE_ARRANQUE_MS }, () => {
  test('SMTP_HOST empty: boots, listens, and logs only correo no-configurado', async () => {
    const arranque = await arrancar({ SMTP_HOST: '', SMTP_PORT: 'basura-ignorada' });

    assert.ok(arranque.escucho, arranque.salida);
    const correo = arranque.lineas.filter((l) => 'correo' in l).map((l) => l.correo);
    assert.deepEqual(correo, ['no-configurado']);
  });

  test('valid SMTP settings: boots, logs correo configurado, and prints no SMTP value', async () => {
    const arranque = await arrancar({
      SMTP_HOST: 'host-secreto.example',
      SMTP_PORT: '2525',
      SMTP_FROM: 'remitente-secreto@example.com',
    });

    assert.ok(arranque.escucho, arranque.salida);
    const correo = arranque.lineas.filter((l) => 'correo' in l).map((l) => l.correo);
    assert.deepEqual(correo, ['configurado']);
    for (const secreto of ['host-secreto', 'remitente-secreto']) {
      assert.ok(!arranque.salida.includes(secreto), `boot output carries ${secreto}`);
    }
  });

  test('SMTP_HOST present with an invalid port: boot fails naming the variable, never its value', async () => {
    const arranque = await arrancar({
      SMTP_HOST: 'host-secreto.example',
      SMTP_PORT: 'puerto-secreto',
      SMTP_FROM: 'remitente@example.com',
    });

    assert.equal(arranque.escucho, false, 'the server listened with an invalid SMTP_PORT');
    assert.notEqual(arranque.codigo, 0);
    assert.match(arranque.salida, /SMTP_PORT/);
    assert.ok(!arranque.salida.includes('puerto-secreto'), arranque.salida);
  });
});
