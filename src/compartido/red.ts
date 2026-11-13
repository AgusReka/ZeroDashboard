import net from 'node:net';

/**
 * Per-attempt connect timeout of Node's happy-eyeballs (`autoSelectFamily`), in milliseconds.
 * Node 22 gives each address 250 ms by default; from inside the Docker network the IPv4 connect
 * to `api.telegram.org` takes about 350 ms, so every attempt was cut and `fetch` failed with
 * ETIMEDOUT. One second lets that attempt finish without turning autoselection off.
 */
export const TIEMPO_POR_INTENTO_DE_CONEXION_MS = 1000;

/**
 * Raises the process-wide per-attempt timeout of the address autoselection. Call it once at
 * startup, before any outbound connection (Telegram, SMTP) is made.
 */
export function ajustarRedDelProceso(): void {
  net.setDefaultAutoSelectFamilyAttemptTimeout(TIEMPO_POR_INTENTO_DE_CONEXION_MS);
}
