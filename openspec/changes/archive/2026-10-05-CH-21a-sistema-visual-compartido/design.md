# Design: CH-21a — Shared Visual System (skill stylesheet on the existing console)

## Technical Approach

DEC-124 option (b), delivered as three chained PRs. PR0 (the DEC) is already committed.

- **PR1, mechanism:** five verbatim files in `public/ui/`. One registrar module holds the closed file list. The routes and the exemption rows both derive from that list. Files are read once at boot and fail closed. The engine image gets one `COPY` line.
- **PR2, adoption:** `/consola` links `/ui/styles.css`. `zd-*` classes go on static markup only. A console-only bridge `<style>` covers script-managed nodes. The inline script stays byte-identical.

The specs this design implements are `shared-visual-system` (new) and the `query-console` delta.

## Architecture Decisions (design-level, inside DEC-124)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Module | `src/estilos-rutas.ts` exports `ARCHIVOS_ESTILOS`, `RUTAS_ESTILOS`, `cargarEstilos`, `registerEstilosRoutes` | A separate zero-import list module | Follows the `contrato-rutas.ts` naming. The module does no IO at the top level, so importing the list from `contexto-tenant.ts` reads no files. It imports only `node:fs`, `node:crypto` and the `FastifyInstance` type. It never imports `contexto-tenant`, so there is no cycle |
| Exemption | `export const ESTILOS_EXENTOS: ReadonlySet<string> = new Set(RUTAS_ESTILOS.map(r => 'GET ' + r))` in `contexto-tenant.ts`, checked like `PLANTILLAS_EXENTAS`. It is exported only so R3 can assert set equality | Exempting a `/ui/` prefix; adding `HEAD`; exporting `esExenta` | Exact rows from the same constant (A3). Fastify's automatic `HEAD` route arrives with method `HEAD`, which is not in the set, so it gets `400` |
| Load / register split | `cargarEstilos(dir)` reads the files at boot. `registerEstilosRoutes(app, estilos)` loops over the list, and each handler closes over its own buffer | Loading inside the registrar | Tests can point the loader at a temp dir. No handler reads a path from the request |
| Boot placement | In `server.ts`, call `cargarEstilos()` right after `loadConfig()`, before Prisma, the scheduler and `listen`. A missing file throws `Error('Hoja de estilos ausente o ilegible: public/ui/<file>')` and the process exits 1 | A lazy read on the first request | Fails closed and visibly, the same way `loadConfig()` already does |
| Path resolution | `new URL('../public/ui/', import.meta.url)` | `import.meta.dirname` plus `join` | The `new URL(…, import.meta.url)` form has precedent only in test files (`contrato-rutas.test.ts:210`, `marcas-alta.test.ts:41`, `agente-proceso/frontera.test.ts:11`). No hand-written runtime module in `src/` uses it; the only runtime use is the generated Prisma client. It still works at runtime because of four facts. `package.json` has `"type": "module"`. `tsconfig.json` uses `NodeNext`, so `import.meta.url` is valid and emitted as is. `rootDir: src` emits a flat `dist/estilos-rutas.js`. `readFileSync` accepts a file `URL`. So `src/` (tsx dev and test) and `dist/` (tsc) both go up one level to `<root>/public/ui`. In the image that is `/app/public/ui` |
| Headers | `text/css; charset=utf-8` (the comments contain non-ASCII characters), `Cache-Control: no-cache`, and a strong `ETag` (sha256 base64url, computed at boot). `If-None-Match` equal to one listed tag gives `304`. A new scenario in the Response Headers requirement of the `shared-visual-system` delta covers this behavior: the ETag is computed at boot and a matching `If-None-Match` returns `304`. Test R2 covers it | `max-age=N`; no ETag | See Q2 |
| **Q1 bridge location** | **A reduced inline `<style>` in `src/consola.ts`, placed after the `<link>`** | A sixth file in `public/ui/` | A2 says `public/ui/` holds the five verbatim skill files and nothing else. The spec says "exactly five" and "the only exemption added". A sixth, non-verbatim file would amend A2 and A3. A5 keeps pages as TS strings, and DEC-124 already accepts inline styles ("Sin CSP… estilos inline siguen permitidos"). The bridge is console-local, so it cannot leak into the panel (CH-22). It is mostly removed in CH-21c. Costs: about 50 uncached lines per load, and a future CSP must also cover it (already accepted) |
| **Q2 cache** | **`no-cache` + ETag** | `max-age=300` | This is a design-level HTTP-header choice on routes DEC-124 already decided. It adds no dependency, route, exemption or boundary, so it is not an architecture decision and needs no DEC addendum. Rationale: the names carry no fingerprint, so with `max-age` a deploy can serve old `components.css` next to new markup for minutes, and the `@import` chain can mix versions across files. `no-cache` revalidates on every load, a `304` carries no body, and the CSS is never stale. Cost: about 8 lines and one test. It needs no dependency (there is no `@fastify/etag`) |
| Parity evidence | Not a test. The PR1 description carries the output of the loop below plus `git ls-files -s` blob ids for both paths | A parity test in `npm test` that is skipped when `.claude` is absent | `.dockerignore` strips `.claude`. A test would also turn `npm test` red whenever the skill changes in a design session. DEC-124 accepts drift. The re-copy procedure lives in the module's header comment |

Parity command (Git Bash), recorded in the PR body:
`for f in styles.css tokens/colors.css tokens/typography.css tokens/spacing.css components/components.css; do diff -q ".claude/skills/zerodashboard-design/$f" "public/ui/$f" || exit 1; done && echo PARITY-OK`

## Needs User Decision

None. Q1 and Q2 stay inside DEC-124. Choosing the sixth-file option for Q1 would require amending DEC-124 A2/A3 first (AGENTS.md). Q2 is a design-level header choice. If the user objects to the ETag/`304` path, plain `no-cache` without an ETag also meets the spec.

## Request Flow

```
Browser                     onRequest hooks (contexto-tenant)          handler
  |-- GET /consola (no header) ->| esExenta(GET,/consola)=true -------> consola: 200 text/html
  |<-- <link href=/ui/styles.css>, <style>bridge</style>, <script> (unchanged)
  |-- GET /ui/styles.css ------->| ESTILOS_EXENTOS has row -> skip -----> closure buffer: 200 text/css,
  |                              |                                        no-cache, ETag
  |<-- 4 @import url("tokens/..","components/..") resolved against /ui/styles.css
  |== GET /ui/tokens/{colors,typography,spacing}.css, /ui/components/components.css (parallel) ==> 200 each
  |-- reload: GET /ui/... If-None-Match:"<tag>" ------------------------> 304, empty body
  |-- GET /ui/x.css | /ui-falso/.. | HEAD|POST /ui/styles.css -> no pattern or method!=GET -> 400 tenant-no-indicado
Boot: loadConfig -> cargarEstilos (5x readFileSync, throw = exit 1) -> Prisma -> registrarContextoTenant
      -> ... registerConsolaRoute -> registerEstilosRoutes(app, estilos) -> registerContratoRoutes -> listen
```

## Interfaces

```ts
export const ARCHIVOS_ESTILOS = ['styles.css', 'tokens/colors.css', 'tokens/typography.css',
  'tokens/spacing.css', 'components/components.css'] as const;   // closed list (DEC-124 A3)
export const RUTAS_ESTILOS: readonly string[] = ARCHIVOS_ESTILOS.map((a) => '/ui/' + a);
export interface HojaCargada { readonly contenido: Buffer; readonly etag: string }
export type EstilosCargados = ReadonlyMap<(typeof ARCHIVOS_ESTILOS)[number], HojaCargada>;
export function cargarEstilos(dir?: URL): EstilosCargados;               // throws naming the file
export function registerEstilosRoutes(app: FastifyInstance, estilos: EstilosCargados): void;
```

The module source must never contain the word `prisma` (test R7). That includes its comments.

## PR2 Static Markup Mapping

The `class` attribute goes immediately **after** `id`, so `<textarea id="sql"` and `/id="limite"[^>]*min="1"/` still match.

| Element | Classes |
|---|---|
| `<body>` | `zd-root` |
| `header#barra-tenant` / its `label` / `select#tenant` | `zd-tenantbar` / `zd-tenantbar__label` / `zd-select` |
| `strong#tenant-activo`, `p#banner`, `p#estado` | **unchanged** (script-managed `className`) |
| `h1`; three `h2` | `zd-h1`; `zd-h2` |
| The nine static `label`s outside the bar | `zd-label` |
| `#conexion`, `#auto-conexion`, `#auto-cron` | `zd-input zd-input--code` |
| `#limite`, `#nombre`, `#descripcion`, `#auto-destinatario` | `zd-input` |
| `textarea#sql`; `select#auto-plantilla` | `zd-textarea zd-textarea--code`; `zd-select` |
| `#ejecutar` | `zd-btn zd-btn--primary` |
| `#agregar-parametro`, `#guardar`, `#auto-crear`, `#anterior`, `#siguiente` | `zd-btn zd-btn--secondary` |
| Three `div.tabla-contenedor` | replaced by `zd-table-wrap zd-table-scroll` |
| `table#resultados`, `#auto-lista`, `#auto-ejecuciones` | `zd-table` |
| `div.paginacion` | `zd-form-actions paginacion` |
| `p.ayuda`, `div.controles`, `ul#guardadas` | unchanged (bridge-styled) |

## PR2 Bridge `<style>` Outline (~50 lines, tokens only, no backtick, no `${`)

1. `[hidden]{display:none !important}`.
2. Frame: `body.zd-root>:not(#barra-tenant){margin-inline:max(var(--space-8),calc((100% - 58rem)/2))}`, so the bar spans the full width and the content sits in a centered column.
3. Tenant bar: `#barra-tenant{flex-wrap:wrap}`. `#tenant-activo` gets `margin-left:auto` and `__name` typography. `.zd-tenantbar:has(#tenant-activo.sin-tenant)` reuses the three `--none` declarations. `#barra-tenant .zd-select` gets `width:auto;max-width:18rem;min-height:var(--control-h-sm)` and a focus outline in `--tenant-on`, or `--warn-text` in the no-tenant state. `zd-select` takes its colors from the scheme-aware tokens, which covers light and dark.
4. Spacing: `.zd-h1`/`.zd-h2` margins, `.zd-label{display:block;margin…}`, and `.ayuda` follows `zd-help` (it covers the static `p`, the `li`, the `span` and the `td`).
5. Script-built rows: `.parametro` and `#auto-valores label` (flex column), plus `.parametro-nombre,.parametro-tipo,.parametro-valor` with the `.zd-input` declarations and `:focus-visible`. The value caption `.parametro-leyenda` (set at `src/consola.ts:649`) gets the `zd-label` look on purpose, so the caption that follows the typed name matches the static captions "Nombre" and "Tipo".
6. `.controles` (flex, `align-items:flex-end`), `.controles>div{width:10rem}`, `.paginacion{margin-top}`.
7. Dynamic buttons (Quitar, Cargar, `.ver-ejecuciones`, `.desactivar`): `button:not(.zd-btn)` uses the secondary small-button declarations, plus hover and `:disabled`.
8. `.banner`: error tokens and a left rule. `.banner.exito`: ok tokens, `white-space:pre-wrap`.
9. `.estado` uses `text-2`. `.estado .corte` is a block with a left rule in `--warn` and `--warn-text` at semibold weight. It shares nothing with the pager buttons.
10. Tables: `.zd-table td{white-space:pre-wrap;vertical-align:top}`, `td.nulo` gets the `.is-null` look, and `.zd-table-wrap:not(:has(th,td)){border:0}` hides empty boxes.
11. `#guardadas` list rules, rewritten with tokens.

There is a side effect to note. `*{box-sizing:border-box}` now applies to every element. The old `:root{color-scheme}` is dropped because the tokens set it.

## File Changes

| File | PR | Action | ± lines |
|---|---|---|---|
| `public/ui/**` (5) | 1 | Create, verbatim | 263 (vendored) |
| `src/estilos-rutas.ts` | 1 | Create | 65 |
| `src/estilos-rutas.test.ts` | 1 | Create | 110 |
| `src/contexto-tenant.ts` | 1 | Import, exported `ESTILOS_EXENTOS` set, row check, doc | 12 |
| `src/contexto-tenant.test.ts` | 1 | New no-database block | 50 |
| `src/server.ts` | 1 | Load and register | 5 |
| `Dockerfile` | 1 | After the `dist` line: `COPY --from=build /app/public ./public` plus a comment | 3 |
| `scripts/smoke.sh` | 1 | Headerless `GET` on two routes: 200 and `content-type: text/css` | 9 |
| **PR1** | | **~517 (254 authored), `size:exception` under DEC-124** | |
| `src/consola.ts` | 2 | −44 style, +1 link, +50 bridge, ±44 class edits | ~140 |
| `src/consola.test.ts` | 2 | Guard tests | 45 |
| `scripts/smoke.sh` | 2 | Grep the `<link>` | 3 |
| **PR2** | | **~190** | |

## Testing Strategy

| Id | Case |
|---|---|
| R1 | Each route returns 200, `text/css; charset=utf-8`, `no-cache` and an ETag. The body equals the file bytes |
| R2 | A matching `If-None-Match` gives 304 with no body. A different tag gives 200 |
| R3 | An `onRoute` capture shows the `/ui/` `GET` routes equal `RUTAS_ESTILOS` exactly. Separately, the set of `ESTILOS_EXENTOS` rows is equal to the set `RUTAS_ESTILOS.map(r => 'GET ' + r)`: same size, with no extra and no missing row |
| R4 | The `@import` URLs in the served `styles.css`, resolved against `/ui/styles.css`, equal the other four routes |
| R5 | A temp dir without `tokens/spacing.css` makes `cargarEstilos` throw, and the message names the file |
| R6 | Editing a temp file after loading leaves the served bytes unchanged |
| R7 | `registerEstilosRoutes.length === 2`, and the source names no `prisma` (the DEC-24 pattern) |
| E1 | The throwing-stub block: every route answers 200 with no header. With an unknown tenant id it also answers 200, byte-identical, and the stub is never called. This stands in for the spec's "valid tenant id": an exempt route returns before the tenant is looked up, so the id's validity is never consulted, and the `/contrato` 3.1 test uses the same argument |
| E2 | With no header, each case gets 400 `{error:'tenant-no-indicado'}`: `/ui/unknown.css`, `/ui/tokens/`, `/ui/Styles.css`, `/ui-falso/styles.css`, `/uix/styles.css`, `/ui/../package.json`, `/ui/%2e%2e/package.json`, `HEAD` and `POST /ui/styles.css` |
| G1 | The markup is the text before `<script>`. Each of `IDS`, `barra-tenant`, `resultados`, `guardado` and `automatizaciones` appears exactly once as `id="<id>"`, and a failure names the id |
| G2 | The page contains exactly `<p id="banner" class="banner" role="alert" hidden></p>`, `<strong id="tenant-activo" class="sin-tenant">` and `<p id="estado" class="estado" hidden></p>` |
| G3 | The page has one `<link rel="stylesheet" href="/ui/styles.css">`, placed before the single `<style>` (exactly one `<style>` in the page), and `RUTAS_ESTILOS` includes that href. The former inline rules are absent: the page contains neither `max-width: 62rem` nor `#barra-tenant { position: sticky`. The script contains no `zd-` |
| V | Script identity is evidence, not a test. Run `sed -n '/^<script>$/,/^<\/script>$/p'` over `git show master:src/consola.ts` and over the new file, then `cmp` the two outputs |

All existing suites run unchanged.

Two spec scenarios are verified by review, not by tests:
- "Agent image is unchanged": the PR1 `Dockerfile` diff touches only the engine stage.
- "No-tenant state stays distinct": checked with the manual checklist below.

**Manual checklist for PR2** (light and dark, at about 360 px and 1280 px, in Chromium and Firefox). The results are attached to the PR. Check each of the following:

- no tenant: amber bar and its text
- tenant selected: violet bar, `name (id…)`, a legible select, and a visible focus ring
- the banner is hidden on load
- error banner and ok banner
- result table: NULL cells and multiline cells
- horizontal scroll at 360 px
- a capped result shows its cut line, with no "Hay más resultados" and the pager disabled
- parameter rows: add, set booleano, Quitar
- saved list with Cargar
- the automation and run tables with their buttons and the truncation row
- no empty table borders
- the bar stays sticky on scroll
- disabled buttons look disabled

## Threat Matrix

| Boundary | Applicability | Response / RED tests |
|---|---|---|
| Documentation-like paths | N/A: nothing is executed or classified | — |
| Git repo selection, commit, push and PR commands | N/A: no VCS automation | — |
| HTTP routing and the tenant-header exemption (project-specific) | **Applicable** | Exact rows only, and unmatched requests fail closed. Tests E1, E2, R3 and R7 |

## Migration / Rollout

There is no migration, env change or dependency. Merge PR1, then PR2. Between the two, the stylesheet is served but unused. To roll back, revert PR2 first, which restores the inline `<style>`. Then revert PR1, which removes the files, routes, rows, the `COPY` line and the boot dependency.

## Open Questions

- None blocking. The `:has()` fallback (the bar stays violet while the text still states no tenant) is accepted per the proposal.
