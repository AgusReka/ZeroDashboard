import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Prisma } from './generated/prisma/client.js';
import { conTenantInyectado, type PrismaAislado } from './aislamiento-prisma.js';
import { camposInvalidos } from './conexiones.js';
import { hashearClave } from './crypto-auth.js';
import { LIMITE_LISTADO } from './listados.js';

/**
 * CH-28 (DEC-155 to DEC-158): the client administrators (P2) who log into the panel,
 * created and managed by the implementer (P1) from the console.
 *
 * Every route here sits behind the operator guard (DEC-152) and is tenant-scoped by the
 * `X-Tenant-Id` header (DEC-15): `Usuario` and `SesionPanel` are scoped models, so each
 * read and write is the header tenant's and another tenant's id answers like an unknown
 * one. The panel never calls these routes. No person ever types a panel password: the
 * system generates it and it appears only in the response that generated it (DEC-155).
 */

/** 18 random bytes in base64url: 24 characters, 144 bits. A person types it, so no prefix. */
export function generarClavePanel(): string {
  return randomBytes(18).toString('base64url');
}

/**
 * The one email normalization, shared with the panel login (`src/panel-auth.ts`), so the
 * stored form and the looked-up form can never diverge: trimmed and lowercased.
 */
export function normalizarCorreo(texto: string): string {
  return texto.trim().toLowerCase();
}

/**
 * The email is an identifier here (DEC-157), nothing is ever sent to it, so this is
 * deliberately not an RFC check: 3 to 254 characters, no whitespace, exactly one `@` that
 * is neither the first nor the last character. Applied to the normalized form.
 */
export function correoValido(correo: string): boolean {
  if (correo.length < 3 || correo.length > 254 || /\s/.test(correo)) {
    return false;
  }
  const arroba = correo.indexOf('@');
  return arroba > 0 && arroba === correo.lastIndexOf('@') && arroba < correo.length - 1;
}

/**
 * The only projection any response reads from `Usuario`: `claveHash` and `tenantId` are
 * absent by construction, so no response can echo them.
 */
export const UsuarioPublico = {
  id: true,
  correo: true,
  nombre: true,
  activo: true,
  creadoEn: true,
} as const;

const LARGO_MAXIMO_NOMBRE = 120;

interface AltaBody {
  correo: string;
  nombre?: string;
}

/**
 * Strict body, `propertyNames` included for the reason `registroAutomatizacionSchema`
 * documents: under `removeAdditional` an unknown key (a `tenantId`, or a `clave` someone
 * wants to choose) would otherwise be stripped and the body accepted. The lengths here
 * are only an upper bound on what is read; the real rules run after trimming.
 */
const altaSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: { enum: ['correo', 'nombre'] },
  required: ['correo'],
  properties: {
    correo: { type: 'string', minLength: 1, maxLength: 300 },
    nombre: { type: 'string', maxLength: 200 },
  },
} as const;

/** `P2002` is Prisma's unique-constraint violation; here `Usuario_correo_key` raises it. */
function esViolacionDeUnicidad(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function registerUsuarioPanelRoutes(app: FastifyInstance, prisma: PrismaAislado): void {
  /**
   * Creates an active user in the header's tenant with a generated password (DEC-155),
   * answered once with `no-store`; only its `scrypt` hash is stored. The scoped client
   * cannot see another tenant's users, so the global uniqueness of `correo` (DEC-157) is
   * decided by the database: a `P2002` is the same `409` whatever tenant holds the email.
   */
  app.post<{ Body: AltaBody }>('/usuarios', { schema: { body: altaSchema }, attachValidation: true }, async (request, reply) => {
    if (request.validationError) {
      return reply.code(400).send({ error: 'solicitud-invalida', campos: camposInvalidos(request.validationError) });
    }
    const correo = normalizarCorreo(request.body.correo);
    const nombre = request.body.nombre === undefined ? '' : request.body.nombre.trim();
    const campos: string[] = [];
    if (!correoValido(correo)) {
      campos.push('/correo');
    }
    if (nombre.length > LARGO_MAXIMO_NOMBRE) {
      campos.push('/nombre');
    }
    if (campos.length > 0) {
      return reply.code(400).send({ error: 'solicitud-invalida', campos });
    }

    const clave = generarClavePanel();
    const claveHash = await hashearClave(clave);
    let usuario;
    try {
      usuario = await prisma.usuario.create({
        data: conTenantInyectado({ correo, nombre: nombre === '' ? null : nombre, claveHash, activo: true }),
        select: UsuarioPublico,
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        return reply.code(409).send({ error: 'correo-en-uso' });
      }
      throw error;
    }
    return reply.code(201).header('cache-control', 'no-store').send({ usuario, clave });
  });

  // The header tenant's users only (scoped model), by email, capped like every listing.
  app.get('/usuarios', async (_request, reply) => {
    const filas = await prisma.usuario.findMany({
      select: UsuarioPublico,
      orderBy: [{ correo: 'asc' }, { id: 'asc' }],
      take: LIMITE_LISTADO + 1,
    });
    const truncado = filas.length > LIMITE_LISTADO;
    return reply.code(200).send({ usuarios: truncado ? filas.slice(0, LIMITE_LISTADO) : filas, truncado });
  });
}
