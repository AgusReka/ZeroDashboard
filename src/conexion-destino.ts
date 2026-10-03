import type { PrismaAislado } from './aislamiento-prisma.js';
import type { DestinoPostgres } from './db-probe.js';
import { descifrarCredencial } from './cripto-credencial.js';
import { SIN_AGENTES, type AbridorDeCanales } from './canal-agente.js';
import { exigirTenantActivo } from './contexto-tenant.js';

/**
 * The **only** place in the codebase that reads `credencial` out of the own database.
 *
 * CH-03 kept "no response can echo the credential" as a structural guarantee: the
 * `ConexionPublica` projection simply does not list the column, so a response path
 * never even fetches it. CH-07 has to hand a *deciphered* credential to the two paths
 * that dial a target, and doing that transparently — a Prisma extension that deciphers
 * results, in the manner of DEC-13 — would undo that guarantee: plaintext would appear
 * wherever `credencial` happened to be selected, turning a compile-time absence into a
 * runtime hope. It could not fail closed either, because it would have to tolerate
 * every row where the column was not selected.
 *
 * So the single-point property is kept, just not by an extension. `credencial: true`
 * appears here and nowhere else, which makes it a grep-checkable invariant rather than
 * a convention each new route has to remember (CH-07 task 2.8 asserts exactly that).
 *
 * The deciphered value exists only inside the returned object, for the duration of the
 * caller's dial. It is never persisted, never logged and never serialized into a
 * response — the routes read `host`/`puerto` off this object and the rest goes to `pg`.
 */
export async function destinoDeConexion(
  prisma: PrismaAislado,
  id: string,
  canales: AbridorDeCanales = SIN_AGENTES,
): Promise<(DestinoPostgres & { id: string }) | null> {
  // Tenant-scoped by the CH-06 extension (DEC-13): a `Conexion` belonging to another
  // tenant resolves to `null` here, so the caller's 404 is reached before any envelope
  // is opened and before any socket is opened.
  const conexion = await prisma.conexion.findUnique({
    where: { id },
    select: {
      id: true,
      host: true,
      puerto: true,
      baseDeDatos: true,
      usuarioDb: true,
      credencial: true,
      agenteId: true,
    },
  });

  if (conexion === null) {
    return null;
  }

  // Throws `ErrorCredencialIlegible` on a tampered envelope, an envelope written under
  // another key, or a row registered before CH-07 that still holds plaintext (DEC-20).
  // The caller maps it to `409 credencial-ilegible`: the row fails legibly instead of
  // being dialled with whatever the column happened to contain.
  const destino = {
    id: conexion.id,
    host: conexion.host,
    port: conexion.puerto,
    database: conexion.baseDeDatos,
    user: conexion.usuarioDb,
    password: descifrarCredencial(conexion.credencial),
  };
  if (conexion.agenteId === null) {
    return destino;
  }
  // CH-19c1 (DEC-115, DEC-122): an agent-bound row is never dialled directly. Its host and
  // port are as the agent sees them, and the inert factory asks for a session only on
  // `connect()`. The tenant comes from the active context, never from the request, and the
  // registry checks it against the agent's token row at use; with no registry, or no live
  // agent, the session fails asynchronously with `ESINAGENTE`.
  const canal = canales.canalPara({
    agenteId: conexion.agenteId,
    tenantId: exigirTenantActivo().id,
    host: conexion.host,
    puerto: conexion.puerto,
  });
  return { ...destino, canal };
}

/**
 * CH-19a: the one copy of a destination's connection fields that the callers spread into
 * a probe or an execution. `canal` passes through as the same reference and is never
 * branched on, so no caller inspects it; `id` is left out because the engine never reads it.
 */
export function camposDeDestino(destino: DestinoPostgres): DestinoPostgres {
  return {
    host: destino.host,
    port: destino.port,
    database: destino.database,
    user: destino.user,
    password: destino.password,
    canal: destino.canal,
  };
}
