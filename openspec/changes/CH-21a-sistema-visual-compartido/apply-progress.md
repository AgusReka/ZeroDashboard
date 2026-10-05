# Apply Progress: CH-21a — Shared Visual System

**Mode**: Standard (`strict_tdd: false`); tests written before the code where the tasks say RED.
**Delivery**: auto-chain, stacked-to-main. Batch 1 was PR1 (mechanism), later split into PR1a and PR1b; `size:exception` accepted for the 263 vendored lines. Batch 2 is PR2 (console adoption), branch `ch21a/adopcion-consola` from `master` after PR0, PR1a and PR1b merged (see "PR2: Console adoption" below).

## Task Status (cumulative)

| Task | Status | Notes |
|---|---|---|
| 0.1 | done | PR0 (orchestrator) |
| 0.2 | pending | orchestrator-owned |
| 1.1 | done | five files copied with `cp`, `cmp` and `diff -q` clean, blob ids equal |
| 1.2 | done | R1-R7 in `src/estilos-rutas.test.ts`; RED observed (module missing) |
| 1.3 | done | `src/estilos-rutas.ts`; R1-R7 green |
| 1.4 | done | E1-E2 no-database block in `src/contexto-tenant.test.ts`; RED observed (5 E1 cases 400) |
| 1.5 | done | `ESTILOS_EXENTOS` from `RUTAS_ESTILOS`; E1, E2, R3 green |
| 1.6 | done | `cargarEstilos()` after `loadConfig()`; registrar after `registerConsolaRoute` |
| 1.7 | done | one `COPY --from=build /app/public ./public` after the engine `dist` line |
| 1.8 | done | headerless `GET` on `/ui/styles.css` and `/ui/components/components.css` |
| 1.9 | partial | `npm test` green with DB suites skipped, `tsc` clean, parity OK; `scripts/smoke.sh` NOT run (Docker daemon not running) |
| 1.10 | needs decision | authored lines 435 > 400 (see Workload) |
| 2.1 | done | G1 (ids, plus a mutation test that renames and duplicates an id), G2, G3 in `src/consola.test.ts`; RED observed (G3 failed: no link) |
| 2.2 | done | `<link>` plus reduced bridge `<style>`; static class mapping applied; script untouched |
| 2.3 | done | `.estado .corte` block with `--warn` rule; `.zd-tenantbar:has(#tenant-activo.sin-tenant)` with the `--none` declarations |
| 2.4 | done | `scripts/smoke.sh` greps `/consola` for the link (checked against a locally served page; Docker smoke not run) |
| 2.5 | done | `sed`/`cmp` script identity, one closing script tag, no backtick (below) |
| 2.6 | pending | manual light/dark checklist needs a human with a browser; checklist ready below |
| 2.7 | partial | `tsc` clean, focused suites green; `npm test` exit 1 from live-DB suites only (environment, below); Docker smoke not run |
| 2.8 | done | 242 code lines (`git diff --stat master...HEAD` before the docs commit), under 400 |

## Commits (on `ch21a/mecanismo-estilos`)

- `a877e70` feat(ch21a): vendor the five skill stylesheets into public/ui
- `4074bc8` feat(ch21a): fixed-list stylesheet registrar with exact exemption rows
- `bf0ad1d` feat(ch21a): load the stylesheets at boot and register their routes
- `c4b0a1b` feat(ch21a): ship public/ in the engine image and smoke the stylesheet
- plus one `docs(ch21a)` commit with this file and the `tasks.md` checkboxes

## Work Unit Evidence (Unit 1, PR1)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx tsx --test src/estilos-rutas.test.ts src/contexto-tenant.test.ts`: exit 0, tests 42, pass 42, fail 0 (the live-DB suite in `contexto-tenant.test.ts` is skipped: no PostgreSQL at localhost:5432) |
| Full suite | `npm test`: exit 0, tests 555, pass 555, fail 0; 23 live-DB / live-service suites skipped (no PostgreSQL, no Docker) |
| Types | `npx tsc --noEmit`: exit 0 |
| Boot regression | `npx tsx --test src/server.test.ts`: 3/3 pass (boots `src/server.ts`, which now loads the sheets) |
| Runtime harness (local boot, no Docker) | `node --import tsx src/server.ts` with a closed DB URL: five routes 200 `text/css; charset=utf-8`, `cache-control: no-cache`, strong ETag, bytes `cmp`-identical to `public/ui`; `If-None-Match` = ETag gives 304 size 0; `/ui/unknown.css`, `HEAD /ui/styles.css`, `POST /ui/styles.css`, `/ui/../package.json` (`--path-as-is`) give 400 `tenant-no-indicado`; `/consola` 200 |
| Fail-closed boot | same command with `public/ui/tokens/spacing.css` moved away: exit 1, `Error: Hoja de estilos ausente o ilegible: public/ui/tokens/spacing.css`; file restored and `cmp`-identical to the skill |
| Docker smoke | NOT run: Docker daemon not running in this environment (`docker ps` cannot reach the engine pipe) |
| Rollback boundary | Revert the four `feat(ch21a)` commits: removes `public/ui/**`, `src/estilos-rutas*.ts`, the `ESTILOS_EXENTOS` row check and its test block, the two `server.ts` lines, the `COPY` line and the smoke block |

## Parity Evidence

Command (Git Bash, repository root):

```
for f in styles.css tokens/colors.css tokens/typography.css tokens/spacing.css components/components.css; do diff -q ".claude/skills/zerodashboard-design/$f" "public/ui/$f" || exit 1; done && echo PARITY-OK
```

Output: `PARITY-OK`

`git ls-files -s` (both paths share each blob id):

```
08bd0bdc6acedb8d6b5bd39cc4aa9d85e132ce9b  styles.css
7908fd3c863404f4fac5f2d0ef7fe572679ed22a  tokens/colors.css
05c7bbc5fa9664f72595321131223f6cb595fa71  tokens/typography.css
16515a4e933a095dff4f1ace85517f556650ad16  tokens/spacing.css
3a3f6dc7485878172cda825f8c406e0da034897c  components/components.css
```

Line endings: no `.gitattributes`; `core.autocrlf=true`. The skill blobs are stored LF (`i/lf w/crlf`), the copies were taken from the CRLF working tree with `cp`, and git normalizes them on add to the same LF blobs. Each checkout therefore serves the same bytes for both paths (CRLF on this Windows checkout, LF on a Linux checkout or in the image built from it).

## Deviations from Design

1. `exposeHeadRoute: false` on each asset route. The spec says "no `HEAD`"; the design said Fastify's automatic `HEAD` twin would exist and be refused by the exemption. With the option, no `HEAD` route exists at all; a headerless `HEAD` still gets `400 tenant-no-indicado` (E2), and R3 asserts the route table holds `GET` rows only, any method. Not architectural (a route option inside DEC-124 A3).
2. R7 checks the source case-insensitively (no `prisma` in any casing), stricter than the `contrato-rutas` pattern.
3. `registerEstilosRoutes` throws if a listed file is absent from the loaded map (defensive; unreachable through `cargarEstilos`).
4. Internal, unexported `ArchivoEstilos` type alias and `rutaDe` helper, so the routes and `RUTAS_ESTILOS` share one path function.
5. Size: authored lines are larger than the design estimate (module 122 vs 65, its test 195 vs 110, the exemption test block 76 vs 50), mostly the header comment with the re-copy procedure and per-case test messages.

## Workload

- Authored (excluding `public/ui/**`, before this docs commit): 435 additions, 0 deletions, over the 400 budget by 35.
- Vendored: 263 (`size:exception` accepted).
- Needs an orchestrator/user decision for task 1.10: extend `size:exception` to the authored lines, or accept as-is. No code was compressed to fit.

## Split into PR1a and PR1b (orchestrator, 2026-10-04)

Authored lines were 435 (over 400), so PR1 was split without changing content: the final tree of `ch21a/mecanismo-estilos` equals the original single-branch result (kept locally as `ch21a/respaldo-pr1-completo`).
- PR1a `ch21a/estilos-modulo`: vendored CSS (263) + `src/estilos-rutas.ts` (122) + `src/estilos-rutas.test.ts` (185). `npx tsx --test src/estilos-rutas.test.ts`: 7 of 7 pass; `npx tsc --noEmit`: clean.
- PR1b `ch21a/mecanismo-estilos`: `src/contexto-tenant.ts` (+20) and test (+76), `src/server.ts` (+8), `Dockerfile` (+3), `scripts/smoke.sh` (+11), R3 set-equality restored in `src/estilos-rutas.test.ts` (+12 -2). On this tip: `npm test` 555 of 555 pass (exit 0), `npx tsc --noEmit` clean, per-file `diff -q` parity PARITY-OK.
- Not observed: `bash scripts/smoke.sh` (Docker daemon not running) and live-database suites (no PostgreSQL on 5432 or 5434).
- `gentle-ai review assess --base-ref ch21a/exploracion --committed-only`: risk high (`scripts/smoke.sh` is shell source), so an independent verification is required with RDD off.

## PR2: Console adoption (2026-10-05)

Branch `ch21a/adopcion-consola`, created from `master` at `b59212f` (PR0, PR1a and PR1b merged), so the PR targets `master` directly.

### Commits

- `95af331` feat(ch21a): console links the shared stylesheet through a reduced bridge (`src/consola.ts`, `src/consola.test.ts`)
- `1da44fa` test(ch21a): smoke checks that /consola links the shared stylesheet (`scripts/smoke.sh`)
- plus one `docs(ch21a)` commit with this file and the `tasks.md` checkboxes

### What changed

- `src/consola.ts`: the 44-line inline `<style>` is replaced by `<link rel="stylesheet" href="/ui/styles.css">` and one bridge `<style>` (design outline 1 to 11, tokens only, no backtick, no `${`). Static markup follows the design mapping table, with `class` right after `id`. `strong#tenant-activo`, `p#banner`, `p#estado`, `p.ayuda`, `div.controles` and `ul#guardadas` keep their markup; there is no `zd-banner`. The `<script>` block is byte-identical (evidence V below).
- `src/consola.test.ts`: G1 (each of `IDS` plus `barra-tenant`, `resultados`, `guardado`, `automatizaciones` exactly once before `<script>`, plus `<textarea id="sql"` and the submit `#ejecutar`), a G1 mutation case (a renamed `estado` and a duplicated `guardar` each make the guard throw naming the id), G2 (exact banner, indicator and status markup; the `limite` tag has `min="1"` and no `max`), G3 (one link, `RUTAS_ESTILOS` includes its href, exactly one `<style`, link before it, no `max-width: 62rem`, no `#barra-tenant { position: sticky`, no `zd-` in the script). Existing tests are unchanged.
- `scripts/smoke.sh`: in the stylesheet block, `grep -qF` for the link on the `/consola` body fetched earlier in the script.

### Work Unit Evidence (Unit 2, PR2)

| Evidence | Value |
|---|---|
| RED | `npx tsx --test src/consola.test.ts` with the guards and the old markup: tests 31, pass 30, fail 1 (`CH-21a G3`, "exactly one link to the shared stylesheet"). G1 and G2 passed on the old markup by design: they guard what the restyle must not move |
| Focused test command and exact result | `npx tsx --test src/consola.test.ts`: tests 31, pass 31, fail 0 (27 existing plus 4 new) |
| Types | `npx tsc --noEmit`: exit 0 |
| Wider focused run | `npx tsx --test src/contexto-tenant.test.ts src/estilos-rutas.test.ts src/consola.test.ts src/server.test.ts`: tests 88, pass 76, fail 0, cancelled 12, exit 1. The 12 cancelled are the live-PostgreSQL block of `contexto-tenant.test.ts` (see the environment note) |
| Full suite | `npm test`: exit 1, tests 854, pass 559, fail 22, cancelled 273. Every failure or cancellation is in a live-database or live-agent suite whose `before` hook cannot set up its rows (environment note). The console suite passes inside the full run |
| Runtime harness (local boot, no Docker) | `node --import tsx src/server.ts` with `APP_PORT=3917`, a closed `DATABASE_URL` and the test `CREDENTIAL_MASTER_KEY`: `/consola` 200 `text/html; charset=utf-8`; the new smoke grep for the link matches; every existing smoke grep on the console page matches (`<textarea id="sql"`, `id="ejecutar"`, `id="nombre"`, `id="guardar"`, `id="guardadas"`, `type="button"`, `textContent`, `id="barra-tenant"`, `id="tenant"`, `id="tenant-activo"`, `X-Tenant-Id`); no `innerHTML`, no removed error code, one closing script tag, zero backticks; the five `/ui/` routes 200 `text/css; charset=utf-8` |
| Docker smoke | NOT run: Docker daemon not running |
| Rollback boundary | Revert `1da44fa` and `95af331`: restores the inline `<style>`, the unclassed markup, the old tests and the old smoke block. PR1 stays in place (the sheet is served but unused) |

Environment note: on 2026-10-05 a PostgreSQL that is not the project's answers on `localhost:5432` (`netstat`: LISTENING). The live suites' reachability probe therefore no longer skips them, and their `before` hooks fail with `password authentication failed for user "zerodashboard"` (for example `db.tenant.create()` at `src/contexto-tenant.test.ts:394`), which cancels their cases. On 2026-10-04 nothing listened there and the same suites were skipped (555 of 555). No PR2 file is involved; the cancelled `2.1 GET /consola answers headerless` case is cancelled by that hook, and the console page itself is covered by the console suite and the local boot above.

### Evidence V: the inline script is unchanged

Commands (Git Bash, repository root). The working tree is CRLF (`core.autocrlf=true`) and the blobs are LF, so the committed blobs are compared, and the working file is compared after stripping CR:

```
git show master:src/consola.ts | sed -n '/^<script>$/,/^<\/script>$/p' > script-master.txt
git show HEAD:src/consola.ts   | sed -n '/^<script>$/,/^<\/script>$/p' > script-head.txt
tr -d '\r' < src/consola.ts    | sed -n '/^<script>$/,/^<\/script>$/p' > script-worktree.txt
cmp script-master.txt script-head.txt && echo "cmp master HEAD: identical"
cmp script-master.txt script-worktree.txt && echo "cmp master worktree: identical"
```

Output (HEAD = `1da44fa`):

```
cmp master HEAD: identical
cmp master worktree: identical
```

Both extracts are 1123 lines, sha256 `300f0cf94dc24fc7767a391eaf34269efa7a9216e91cb7d8c66d2cd2632cbe11`. In the committed file: one `</script>`, zero backticks inside the `DOCUMENTO_CONSOLA` literal, zero `zd-` in the script.

### Spec scenario coverage (`query-console`)

| Scenario | Covered by |
|---|---|
| All ids present once | G1 |
| A renamed id fails the guard | G1 mutation case (renamed and duplicated) |
| Limit attributes preserved | G2, plus the existing CH-07 test |
| Requesting the console page | G1 (`<textarea id="sql"`, submit `#ejecutar`), existing smoke greps, local boot |
| Page links the shared stylesheet | G3, smoke grep, local boot |
| Inline script is unchanged | Evidence V; G3 (no `zd-` in the script); existing one-script-element and no-backtick tests |
| Viewing a capped result | Existing behavioural tests (cut sentence, next page disabled); manual checklist |
| A capped result is not mistaken for a partial page | Existing test (`corte` is its own `strong`); bridge `.estado .corte` block; manual checklist |
| Distinct styling after the restyle | Existing tests (`corte` class only on the cut; pager buttons carry `zd-btn zd-btn--secondary`); bridge shares no rule between `.corte` and the pager; manual checklist |
| Indicator is always visible | Existing behavioural tests; sticky `zd-tenantbar`; manual checklist |
| No-tenant state stays distinct | G2 (`class="sin-tenant"` and its text on load); bridge `:has()` rule; manual checklist (review, per design) |

### Deviations from design

1. `.banner` carries `white-space: pre-wrap` in its base rule, not only in `.banner.exito`: multi-line refusals (`mensajeDeSolicitudInvalida` joins with a newline) are error banners, so they need it too. The old inline style also had it on `.banner`.
2. The banner text uses `--text-1` (as `.zd-banner` does), with error and ok tokens for background and border. The state is carried by the text, not by colour alone.
3. Small additions the outline implies but does not list: `body.zd-root { padding-bottom }`, `#barra-tenant { padding-block }` for the wrapped bar at 360 px, `#agregar-parametro { margin-top }`, `.zd-table-wrap { margin-top }`, `.ver-ejecuciones + .desactivar { margin-left }`, and hover rules for the parameter controls. All use tokens.
4. The `.parametro` and `#auto-valores` labels carry the `zd-label` look as a whole (font size, weight, colour), so "Nombre", "Tipo" and the `.parametro-leyenda` caption match; `.parametro-leyenda` is also listed explicitly in that selector.
5. One HTML comment above the link explains the bridge. The old comment on the row-cap cut is kept, adapted, in the bridge.

None is architectural; all stay inside DEC-124 and design Q1.

### Manual checklist for the PR body (task 2.6, not done here)

Check in light and dark, at about 360 px and 1280 px wide, in Chromium and Firefox. Attach the screenshots to the PR.

- [ ] No tenant: amber bar and its text ("Ningún tenant seleccionado")
- [ ] Tenant selected: violet bar, `name (id…)`, a legible select, and a visible focus ring on the select
- [ ] The banner is hidden on load
- [ ] Error banner and ok banner (for example a save without a tenant, then a successful save)
- [ ] Result table: NULL cells and multiline cells
- [ ] Horizontal scroll of the result table at 360 px
- [ ] A capped result shows its cut line, with no "Hay más resultados" and the pager disabled
- [ ] Parameter rows: add, set booleano, Quitar
- [ ] Saved list with Cargar
- [ ] The automation and run tables with their buttons and the truncation row
- [ ] No empty table borders (before any result or automation is loaded)
- [ ] The bar stays sticky on scroll
- [ ] Disabled buttons look disabled

Firefox note: the amber no-tenant bar needs `:has()` (Firefox 121 or later). On an older Firefox the bar stays violet while its text still states no tenant; the proposal accepts this fallback.
