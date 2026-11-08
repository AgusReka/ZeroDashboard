import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';

/**
 * The shared stylesheet and the vendored chart library, served as six fixed files
 * (CH-21a, DEC-124; CH-47, DEC-184, DEC-200).
 *
 * `public/ui/` holds verbatim copies of the five CSS files of the `zerodashboard-design`
 * skill, in the skill's own layout, so the relative `@import` lines in `styles.css`
 * resolve against `/ui/styles.css` to the other four routes. `public/ui/vendor/` holds
 * the Chart.js UMD build that the panel draws its charts with (CH-48). The list below is
 * closed: a new file means editing it and its test, and it can never inherit an
 * exemption.
 *
 * **Why the `estilos` names also hold a script.** DEC-200 adds the script as one more row
 * of this list instead of a second registrar, so one list still drives the routes, the
 * boot load and the tenant-header exemption, and the three cannot diverge. Each row
 * declares its own content type. The names `ARCHIVOS_ESTILOS`, `RUTAS_ESTILOS`,
 * `cargarEstilos` and `registerEstilosRoutes` stay as they are, so no caller changes.
 *
 * **Load and register are split on purpose.** `cargarEstilos` reads every file once, at
 * boot, and throws naming the first one that is missing or unreadable, so the process
 * stops before it listens (fail closed, like `loadConfig()`). `registerEstilosRoutes`
 * then adds one exact `GET` route per file, each handler closing over its own buffer.
 * No handler reads a path from the request, and a file edited on disk after boot is
 * never re-read.
 *
 * **The registrar takes the app and the loaded files, nothing else.** The assets are
 * identical for every tenant and no handler here holds a database handle, which is the
 * structural premise of their tenant-header exemption (DEC-124 A3, the DEC-24 argument).
 * `src/aislamiento/contexto-tenant.ts` builds those exempt rows from `RUTAS_ESTILOS`, the same list
 * that registers the routes, so the two cannot diverge. This module never imports that
 * one, so there is no import cycle, and it does no IO at the top level, so importing the
 * list reads no file. `src/compartido/estilos-rutas.test.ts` pins the signature and the absence of
 * any database client name in this source.
 *
 * Headers: the content type of each row (`text/css; charset=utf-8` for the stylesheets,
 * whose comments carry non-ASCII characters, and `text/javascript; charset=utf-8` for the
 * script), `Cache-Control: no-cache` and a strong `ETag` computed at boot. The file names
 * carry no fingerprint, so a `max-age` could mix old and new files across the `@import`
 * chain or across a library update after a deploy; `no-cache` revalidates every load and
 * a matching `If-None-Match` costs a bodyless `304`.
 *
 * Re-copy procedure for the stylesheets, when the skill's CSS changes (DEC-124 accepts
 * drift until then). Copy the files, never retype them, then check parity per file, from
 * Git Bash at the repository root:
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
 * Provenance of the vendored script (CH-47, DEC-184, DEC-200):
 *
 *   package:  chart.js 4.6.1 (npm registry)
 *   file:     dist/chart.umd.js -> public/ui/vendor/chart.umd.js, unmodified, 210,078 bytes,
 *             its trailing `sourceMappingURL` comment included (the `.map` is not shipped)
 *   sha256:   338399fb5bafe598d21cfc471b0590b61ceb321a985fade4f68499b151f67fbf
 *   license:  MIT, LICENSE.md -> public/ui/vendor/LICENSE-chartjs.md (shipped, not served)
 *
 * `.gitattributes` marks `public/ui/vendor/*` as `-text`, so a CRLF checkout keeps the
 * bytes. The hash is pinned in the test, not checked here at boot: the test is the gate,
 * as for the CSS parity. Re-copy procedure, from Git Bash at the repository root:
 *
 *   npm pack chart.js@4.6.1 --pack-destination "$TMP"
 *   tar -xzf "$TMP/chart.js-4.6.1.tgz" -C "$TMP" package/dist/chart.umd.js package/LICENSE.md
 *   cp "$TMP/package/dist/chart.umd.js" public/ui/vendor/chart.umd.js
 *   cp "$TMP/package/LICENSE.md" public/ui/vendor/LICENSE-chartjs.md
 *   sha256sum public/ui/vendor/chart.umd.js   # must equal the pinned hash
 *
 * Moving to a new version is its own change: copy the file again, then update the version
 * and the hash in the test and in this comment.
 *
 * Nothing console-specific goes into `public/ui/`: page-local rules live in the page.
 */

const CSS = 'text/css; charset=utf-8';
const JS = 'text/javascript; charset=utf-8';

/** The closed list (DEC-124 A3, DEC-200), relative to `public/ui/`. */
export const ARCHIVOS_ESTILOS = [
  { archivo: 'styles.css', tipo: CSS },
  { archivo: 'tokens/colors.css', tipo: CSS },
  { archivo: 'tokens/typography.css', tipo: CSS },
  { archivo: 'tokens/spacing.css', tipo: CSS },
  { archivo: 'components/components.css', tipo: CSS },
  // CH-47 (DEC-184, DEC-200): Chart.js 4.6.1, consumed by the panel in CH-48.
  { archivo: 'vendor/chart.umd.js', tipo: JS },
] as const;

type ArchivoEstilos = (typeof ARCHIVOS_ESTILOS)[number]['archivo'];

function rutaDe(archivo: ArchivoEstilos): string {
  return '/ui/' + archivo;
}

/** One exact route per file, mirroring the folder layout. */
export const RUTAS_ESTILOS: readonly string[] = ARCHIVOS_ESTILOS.map(({ archivo }) => rutaDe(archivo));

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
const DIRECTORIO_ESTILOS = new URL('../../public/ui/', import.meta.url);

/**
 * Reads the six files once. `dir` must end in `/` (tests pass a temp copy). Any missing
 * or unreadable file throws an error naming it, so boot fails before the server listens.
 */
export function cargarEstilos(dir: URL = DIRECTORIO_ESTILOS): EstilosCargados {
  const estilos = new Map<ArchivoEstilos, HojaCargada>();
  for (const { archivo } of ARCHIVOS_ESTILOS) {
    let contenido: Buffer;
    try {
      contenido = readFileSync(new URL(archivo, dir));
    } catch (error) {
      throw new Error(`Archivo de la interfaz ausente o ilegible: public/ui/${archivo}`, {
        cause: error,
      });
    }
    const etag = `"${createHash('sha256').update(contenido).digest('base64url')}"`;
    estilos.set(archivo, { contenido, etag });
  }
  return estilos;
}

/**
 * One exact `GET` per listed file, sent with the content type of its row.
 * `exposeHeadRoute: false` keeps Fastify from adding the automatic `HEAD` twin, so the
 * table holds `GET` routes only; a `HEAD` matches no route and stays tenant-scoped
 * (`400 tenant-no-indicado` without the header).
 */
export function registerEstilosRoutes(app: FastifyInstance, estilos: EstilosCargados): void {
  for (const { archivo, tipo } of ARCHIVOS_ESTILOS) {
    const hoja = estilos.get(archivo);
    if (hoja === undefined) {
      throw new Error(`Archivo de la interfaz no cargado: public/ui/${archivo}`);
    }
    const { contenido, etag } = hoja;
    app.get(rutaDe(archivo), { exposeHeadRoute: false }, async (request, reply) => {
      reply.header('cache-control', 'no-cache').header('etag', etag);
      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).send();
      }
      return reply.code(200).type(tipo).send(contenido);
    });
  }
}
