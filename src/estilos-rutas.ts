import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';

/**
 * The shared stylesheet, served as five fixed files (CH-21a, DEC-124).
 *
 * `public/ui/` holds verbatim copies of the five CSS files of the `zerodashboard-design`
 * skill, in the skill's own layout, so the relative `@import` lines in `styles.css`
 * resolve against `/ui/styles.css` to the other four routes. The list below is closed:
 * a new file means editing it and its test, and it can never inherit an exemption.
 *
 * **Load and register are split on purpose.** `cargarEstilos` reads every file once, at
 * boot, and throws naming the first one that is missing or unreadable, so the process
 * stops before it listens (fail closed, like `loadConfig()`). `registerEstilosRoutes`
 * then adds one exact `GET` route per file, each handler closing over its own buffer.
 * No handler reads a path from the request, and a file edited on disk after boot is
 * never re-read.
 *
 * **The registrar takes the app and the loaded sheets, nothing else.** The assets are
 * identical for every tenant and no handler here holds a database handle, which is the
 * structural premise of their tenant-header exemption (DEC-124 A3, the DEC-24 argument).
 * `src/contexto-tenant.ts` builds those exempt rows from `RUTAS_ESTILOS`, the same list
 * that registers the routes, so the two cannot diverge. This module never imports that
 * one, so there is no import cycle, and it does no IO at the top level, so importing the
 * list reads no file. `src/estilos-rutas.test.ts` pins the signature and the absence of
 * any database client name in this source.
 *
 * Headers: `text/css; charset=utf-8` (the comments carry non-ASCII characters),
 * `Cache-Control: no-cache` and a strong `ETag` computed at boot. The file names carry
 * no fingerprint, so a `max-age` could mix old and new files across the `@import` chain
 * after a deploy; `no-cache` revalidates every load and a matching `If-None-Match`
 * costs a bodyless `304`.
 *
 * Re-copy procedure, when the skill's CSS changes (DEC-124 accepts drift until then).
 * Copy the files, never retype them, then check parity per file, from Git Bash at the
 * repository root:
 *
 *   for f in styles.css tokens/colors.css tokens/typography.css tokens/spacing.css \
 *     components/components.css; do
 *     cp ".claude/skills/zerodashboard-design/$f" "public/ui/$f"
 *   done
 *   for f in styles.css tokens/colors.css tokens/typography.css tokens/spacing.css \
 *     components/components.css; do
 *     diff -q ".claude/skills/zerodashboard-design/$f" "public/ui/$f" || exit 1
 *   done && echo PARITY-OK
 *
 * Nothing console-specific goes into `public/ui/`: page-local rules live in the page.
 */

/** The closed list (DEC-124 A3), relative to `public/ui/`. */
export const ARCHIVOS_ESTILOS = [
  'styles.css',
  'tokens/colors.css',
  'tokens/typography.css',
  'tokens/spacing.css',
  'components/components.css',
] as const;

type ArchivoEstilos = (typeof ARCHIVOS_ESTILOS)[number];

function rutaDe(archivo: ArchivoEstilos): string {
  return '/ui/' + archivo;
}

/** One exact route per file, mirroring the folder layout. */
export const RUTAS_ESTILOS: readonly string[] = ARCHIVOS_ESTILOS.map(rutaDe);

export interface HojaCargada {
  readonly contenido: Buffer;
  readonly etag: string;
}

export type EstilosCargados = ReadonlyMap<ArchivoEstilos, HojaCargada>;

/**
 * `src/` under tsx and `dist/` under node both sit one level below the repository root
 * (`rootDir: src` emits a flat `dist/`), so `../public/ui/` is the vendored folder in
 * development, in tests and in the image (`/app/public/ui`).
 */
const DIRECTORIO_ESTILOS = new URL('../public/ui/', import.meta.url);

/**
 * Reads the five files once. `dir` must end in `/` (tests pass a temp copy). Any missing
 * or unreadable file throws an error naming it, so boot fails before the server listens.
 */
export function cargarEstilos(dir: URL = DIRECTORIO_ESTILOS): EstilosCargados {
  const estilos = new Map<ArchivoEstilos, HojaCargada>();
  for (const archivo of ARCHIVOS_ESTILOS) {
    let contenido: Buffer;
    try {
      contenido = readFileSync(new URL(archivo, dir));
    } catch (error) {
      throw new Error(`Hoja de estilos ausente o ilegible: public/ui/${archivo}`, { cause: error });
    }
    const etag = `"${createHash('sha256').update(contenido).digest('base64url')}"`;
    estilos.set(archivo, { contenido, etag });
  }
  return estilos;
}

/**
 * One exact `GET` per listed file. `exposeHeadRoute: false` keeps Fastify from adding
 * the automatic `HEAD` twin, so the table holds `GET` routes only; a `HEAD` matches no
 * route and stays tenant-scoped (`400 tenant-no-indicado` without the header).
 */
export function registerEstilosRoutes(app: FastifyInstance, estilos: EstilosCargados): void {
  for (const archivo of ARCHIVOS_ESTILOS) {
    const hoja = estilos.get(archivo);
    if (hoja === undefined) {
      throw new Error(`Hoja de estilos no cargada: public/ui/${archivo}`);
    }
    const { contenido, etag } = hoja;
    app.get(rutaDe(archivo), { exposeHeadRoute: false }, async (request, reply) => {
      reply.header('cache-control', 'no-cache').header('etag', etag);
      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send();
      }
      return reply.code(200).type('text/css; charset=utf-8').send(contenido);
    });
  }
}
