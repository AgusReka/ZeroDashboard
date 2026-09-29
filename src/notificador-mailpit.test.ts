import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, test } from 'node:test';
import { componerCorreo } from './correo.js';
import { crearNotificadorSmtp } from './notificador.js';

/**
 * Optional live check for CH-14 task 4.8: one real SMTP delivery into the Mailpit of the
 * `correo` Compose profile, read back through Mailpit's HTTP API.
 *
 * Bring it up with `docker compose --profile correo up -d mailpit`. The host ports are
 * `MAILPIT_SMTP_PORT` and `MAILPIT_UI_PORT` (defaults 1026 and 8026, as in
 * `docker-compose.yml`). Port 1025 is refused on purpose: it is every Mailpit's default,
 * and on a shared machine it may belong to another project's catcher. When the API is not
 * reachable, the suite skips with a reason.
 */
const HOST = '127.0.0.1';
const PUERTO_SMTP = Number(process.env.MAILPIT_SMTP_PORT || 1026);
const PUERTO_UI = Number(process.env.MAILPIT_UI_PORT || 8026);
const API = `http://${HOST}:${PUERTO_UI}/api/v1`;

async function apiAlcanzable(): Promise<boolean> {
  try {
    const r = await fetch(`${API}/info`, { signal: AbortSignal.timeout(1000) });
    return r.ok;
  } catch {
    return false;
  }
}

const motivoSkip =
  PUERTO_SMTP === 1025
    ? 'MAILPIT_SMTP_PORT=1025 is refused: it may be another project\'s Mailpit'
    : (await apiAlcanzable())
      ? false
      : `no Mailpit API at ${API} — run \`docker compose --profile correo up -d mailpit\``;

interface Direccion {
  Name: string;
  Address: string;
}
interface Resumen {
  ID: string;
  Subject: string;
  From: Direccion;
  To: Direccion[];
}

async function buscar(asunto: string): Promise<Resumen | undefined> {
  // Mailpit stores the message as it answers the DATA command; retry briefly anyway.
  for (let intento = 0; intento < 20; intento += 1) {
    const r = await fetch(`${API}/messages?limit=50`);
    const { messages } = (await r.json()) as { messages: Resumen[] };
    const hallado = messages.find((m) => m.Subject === asunto);
    if (hallado) return hallado;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return undefined;
}

describe('notificador — live delivery to the correo-profile Mailpit', { skip: motivoSkip }, () => {
  test('4.8 one message arrives with its sender, recipient, both parts and no attachment', async () => {
    const marcador = `zd-${randomUUID()}`;
    const para = `destino+${marcador}@ejemplo.test`;
    const correo = componerCorreo({
      nombre: `Stock bajo ${marcador}`,
      automatizacion: 'stock-fisico',
      columnas: ['producto', 'stock'],
      filas: [['Tornillo', 3]],
      hayMas: false,
      fecha: new Date(),
      zona: 'UTC',
    });
    const notificador = crearNotificadorSmtp(
      { timeoutMs: 5000 },
      { SMTP_HOST: HOST, SMTP_PORT: String(PUERTO_SMTP), SMTP_FROM: 'avisos@ejemplo.test' },
    );

    assert.deepEqual(await notificador?.enviar({ para, ...correo }), { resultado: 'enviada' });

    const resumen = await buscar(correo.asunto);
    assert.ok(resumen, 'the message reached Mailpit');
    try {
      assert.deepEqual(resumen.From, { Name: 'ZeroDashboard', Address: 'avisos@ejemplo.test' });
      assert.deepEqual(
        resumen.To.map((d) => d.Address),
        [para],
      );
      const r = await fetch(`${API}/message/${resumen.ID}`);
      const detalle = (await r.json()) as { HTML: string; Text: string; Attachments: unknown[] };
      assert.ok(detalle.HTML.includes('<td') && detalle.HTML.includes('Tornillo'));
      assert.ok(detalle.Text.includes('Tornillo'));
      assert.deepEqual(detalle.Attachments, []);
    } finally {
      await fetch(`${API}/messages`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ IDs: [resumen.ID] }),
      });
    }
  });
});
