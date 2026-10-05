# Tasks: CH-21a — Shared Visual System

From `design.md`, `specs/shared-visual-system/spec.md` and `specs/query-console/spec.md`. Where they differ, the SPEC wins. No task edits `docs/01-decisiones.md` (DEC-124 is already registered). Test: `npm test`; types: `npx tsc --noEmit`. Test ids (R*, E*, G*, V) are the design's. Apply never commits; commits, PRs, verify and archive belong to the orchestrator. Focused runs use `npm test -- <files>`. No engine change (rule 6), no CSP, no panel.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR0 ~50 (done), PR1 ~517 (254 authored + 263 vendored), PR2 ~190 |
| 400-line budget risk | High (PR1 only, because of vendored CSS) |
| Chained PRs recommended | Yes |
| Suggested split | PR0 -> PR1a -> PR1b -> PR2, each merged to main in order (PR1 split on 2026-10-04: authored lines came out at 435, over 400) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

PR1 carries `size:exception` for its 263 vendored lines (DEC-124); the 254 authored lines are under budget. The vendored files cannot be split cleanly and are verified by per-file `diff -q`. PR2 (~190) is under budget. Line-count checkpoint at the end of each PR: `git diff --stat` plus `git status --porcelain` with line counts of each `??` file; PR1 excludes `public/ui/**` from the authored count. If PR2 exceeds 400, STOP and report.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 0 | DEC-124 and exploration (done) | PR0, branch `ch21a/exploracion` | N/A (docs only) | N/A, no runtime change | Revert docs commits |
| 1 | Vendored CSS, registrar, exemption, boot, image, smoke | PR1, branch `ch21a/mecanismo-estilos`, base `master` | `npm test -- src/estilos-rutas.test.ts src/contexto-tenant.test.ts` | `scripts/smoke.sh` headerless `GET` on two routes | Revert PR1 after PR2: removes files, routes, rows, `COPY` line, boot dependency |
| 2 | Console adopts the stylesheet, guards, bridge | PR2, branch `ch21a/adopcion-consola`, base PR1 branch (retarget to `master` after PR1 merges) | `npm test -- src/consola.test.ts` | Manual light/dark checklist plus `sed`/`cmp` script identity | Revert PR2: restores inline `<style>` |

## PR0: Docs (done)

- [x] 0.1 DEC-124 in `docs/01-decisiones.md` (commit 0a86440) and exploration (commit d7dfbdc), on `ch21a/exploracion`.
- [ ] 0.2 `proposal.md`, `specs/`, `design.md` and `tasks.md` of this change land in PR0 itself: one docs commit on `ch21a/exploracion` right after the orchestrator finishes this phase, before PR1 starts. Orchestrator-owned.

## PR1: Mechanism (split into PR1a and PR1b)

Implementation produced 435 authored lines plus 263 vendored, over the 400-line budget, so under `auto-chain` PR1 was split. The `size:exception` accepted by the user still covers only the 263 vendored lines.

- **PR1a** (branch `ch21a/estilos-modulo`, base `ch21a/exploracion` until PR0 merges, then `master`): tasks 1.1 to 1.3 (vendored CSS, registrar module, route tests R1 to R7). 307 authored lines (122 module + 185 tests) plus 263 vendored. The R3 exemption-set assertion moves to PR1b because it needs `ESTILOS_EXENTOS`.
- **PR1b** (branch `ch21a/mecanismo-estilos`, base the PR1a branch, retarget to `master` after PR1a merges): tasks 1.4 to 1.8 (exemption rows and tests E1, E2 plus the R3 set equality, boot wiring, Dockerfile, smoke). About 132 authored lines.
- Verification results per task are in `apply-progress.md`.

Branch `ch21a/mecanismo-estilos`, base `master`.

- [x] 1.1 Create the five files under `public/ui/` by verbatim copy from `.claude/skills/zerodashboard-design/` (`styles.css`, `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `components/components.css`). No edits. Spec: Vendored Files Are Verbatim.
- [x] 1.2 RED R1-R7 in new `src/estilos-rutas.test.ts`: R1 200, `text/css; charset=utf-8`, `no-cache`, strong ETag, body equals file bytes; R2 matching `If-None-Match` gives 304 with no body and `no-cache`, other tag gives 200; R3 `onRoute` capture equals `RUTAS_ESTILOS` and `ESTILOS_EXENTOS` equals `RUTAS_ESTILOS.map(r => 'GET ' + r)`; R4 `@import` URLs resolve to the other four routes; R5 temp dir without `tokens/spacing.css` makes `cargarEstilos` throw naming the file; R6 file edited after load leaves bytes unchanged; R7 `registerEstilosRoutes.length === 2` and source has no `prisma`. Spec: Each listed file is served, Relative imports resolve, Missing file stops boot, Files changed after boot are not re-read, Content type/cache/ETag, 304, non-matching tag, Exemption rows equal routes, Registrar has no database dependency.
- [x] 1.3 GREEN `src/estilos-rutas.ts`: `ARCHIVOS_ESTILOS`, `RUTAS_ESTILOS`, `HojaCargada`, `EstilosCargados`, `cargarEstilos(dir?: URL)` (default `new URL('../public/ui/', import.meta.url)`, error `Hoja de estilos ausente o ilegible: public/ui/<file>`), `registerEstilosRoutes(app, estilos)` with per-route closures, no `prisma` word anywhere (comments included), re-copy procedure in the header comment. R1-R7 pass.
- [x] 1.4 RED E1-E2 in `src/contexto-tenant.test.ts`, new no-database block: E1 throwing stub, every route 200 with no header and with an unknown tenant id, byte-identical, stub never called; E2 400 `{error:'tenant-no-indicado'}` for `/ui/unknown.css`, `/ui/tokens/`, `/ui/Styles.css`, `/ui-falso/styles.css`, `/uix/styles.css`, `/ui/../package.json`, `/ui/%2e%2e/package.json`, `HEAD` and `POST /ui/styles.css`. Spec: Unlisted asset URL, HEAD is not served, Traversal, Look-alike path, Non-GET methods, Identical bytes with and without a tenant.
- [x] 1.5 GREEN `src/contexto-tenant.ts`: import `RUTAS_ESTILOS`, export `ESTILOS_EXENTOS`, check it next to `PLANTILLAS_EXENTAS`, update the doc comment. No prefix, no `HEAD`, no exported `esExenta`. E1, E2, R3 pass.
- [x] 1.6 GREEN `src/server.ts`: call `cargarEstilos()` right after `loadConfig()` and before Prisma; `registerEstilosRoutes(app, estilos)` after `registerConsolaRoute` and before `registerContratoRoutes`. Spec: Missing file stops boot.
- [x] 1.7 GREEN `Dockerfile`: after the engine `dist` line add `COPY --from=build /app/public ./public` plus a comment. Engine stage only; the agent stage is untouched. Spec: Engine image boots and serves the stylesheet, Agent image is unchanged (review: the diff touches only the engine stage).
- [x] 1.8 GREEN `scripts/smoke.sh`: headerless `GET` on `/ui/styles.css` and one more listed route, assert 200 and `content-type: text/css`. Spec: Engine image boots and serves the stylesheet.
- [ ] 1.9 Verify: `npm test` green, `npx tsc --noEmit` clean, `bash scripts/smoke.sh` against a running engine. Record in the PR1 body: the parity loop output (`PARITY-OK`) from design.md (per-file `diff -q` over the five files, no `diff -r`) plus `git ls-files -s` blob ids for both paths of each file. Spec: Parity with the skill.
- [ ] 1.10 Line-count checkpoint (method above): authored at most 400 excluding `public/ui/**`; PR labelled `size:exception`.

## PR2: Console adoption (~190)

Branch `ch21a/adopcion-consola`, base PR1 branch (stacked-to-main; retarget to `master` once PR1 merges).

- [ ] 2.1 RED G1-G3 in `src/consola.test.ts`: G1 markup before `<script>` has each of `IDS`, `barra-tenant`, `resultados`, `guardado`, `automatizaciones` exactly once as `id="<id>"`, failure names the id; G2 exact `<p id="banner" class="banner" role="alert" hidden></p>`, `<strong id="tenant-activo" class="sin-tenant">`, `<p id="estado" class="estado" hidden></p>`, and `limite` has `min="1"` and no `max`; G3 one `<link rel="stylesheet" href="/ui/styles.css">` before the single `<style>`, href in `RUTAS_ESTILOS`, no `max-width: 62rem`, no `#barra-tenant { position: sticky`, script has no `zd-`. Spec: All ids present once, A renamed id fails the guard, Limit attributes preserved, Page links the shared stylesheet, Requesting the console page. Existing tests stay unchanged.
- [ ] 2.2 GREEN `src/consola.ts` markup: add `<link>` and replace the 44-line inline `<style>` with the bridge `<style>` (outline 1-11 of design.md: tokens only, no backtick, no `${`). Apply the static class mapping table (`class` right after `id`; `strong#tenant-activo`, `p#banner`, `p#estado`, `p.ayuda`, `div.controles`, `ul#guardadas` unchanged; no `zd-banner`). The `<script>` block is not touched. Spec: Page links the shared stylesheet, Inline script is unchanged.
- [ ] 2.3 Bridge rules that keep the two required distinctions: `.estado .corte` as a block with a left rule in `--warn` and `--warn-text`, sharing nothing with pager buttons; `.zd-tenantbar:has(#tenant-activo.sin-tenant)` reuses the `--none` declarations. Spec: Distinct styling after the restyle, A capped result is not mistaken for a partial page, No-tenant state stays distinct.
- [ ] 2.4 `scripts/smoke.sh`: grep the `/consola` response for the `<link>` to `/ui/styles.css`.
- [ ] 2.5 Evidence V (PR body, not a test): in Git Bash run `sed -n '/^<script>$/,/^<\/script>$/p'` over `git show master:src/consola.ts` and over `src/consola.ts`, then `cmp` the two outputs; also record one closing script tag and no backtick. Spec: Inline script is unchanged.
- [ ] 2.6 Manual screenshot checklist, light and dark, about 360 px and 1280 px, Chromium and Firefox; attach results to the PR. Items: no tenant (amber bar and text); tenant selected (violet bar, `name (id...)`, legible select, visible focus ring); banner hidden on load; error and ok banners; result table with NULL and multiline cells; horizontal scroll at 360 px; capped result shows its cut line, no "Hay más resultados", pager disabled; parameter rows (add, set booleano, Quitar); saved list with Cargar; automation and run tables with buttons and truncation row; no empty table borders; bar sticky on scroll; disabled buttons look disabled. Spec: Indicator is always visible, No-tenant state stays distinct, Viewing a capped result, Distinct styling after the restyle.
- [ ] 2.7 Verify: `npm test` green (all existing suites unchanged), `npx tsc --noEmit` clean, smoke passes.
- [ ] 2.8 Line-count checkpoint (method above): at most 400, else STOP.

## Closure (orchestrator-owned)

- [ ] 3.1 `sdd-verify` against both specs: every scenario below has a task and passing evidence; confirm "Agent image is unchanged" and "No-tenant state stays distinct" by review and checklist.
- [ ] 3.2 `sdd-archive`: merge the `shared-visual-system` spec into `openspec/specs/` and apply the `query-console` delta; archive the change folder.

## Traceability

- Fixed-list registrar, headers, 304 -> 1.2-1.3
- Boot fail-closed, no re-read -> 1.2-1.3, 1.6
- Exact exemption, look-alike, non-GET, HEAD, traversal, no tenant data -> 1.4-1.5, 1.2 (R3, R7)
- Verbatim vendoring -> 1.1, 1.9
- Engine image, agent image unchanged -> 1.7-1.8
- Console ids guard, link, no inline styles, script identity -> 2.1-2.2, 2.5
- Cut message vs pager, no-tenant state -> 2.3, 2.6
