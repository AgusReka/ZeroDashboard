# Apply Progress: CH-21a — Shared Visual System

**Mode**: Standard (`strict_tdd: false`); tests written before the code where the tasks say RED.
**Delivery**: auto-chain, stacked-to-main. This batch is PR1 (mechanism) only, branch `ch21a/mecanismo-estilos`, PR base `ch21a/exploracion` until PR0 merges. `size:exception` accepted for the 263 vendored lines.

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
| 2.x | pending | PR2, not in this batch |

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
