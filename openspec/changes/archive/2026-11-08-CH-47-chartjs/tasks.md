# Tasks: CH-47 — Chart.js vendored in `public/ui/vendor/`

Inputs: proposal.md, specs/shared-visual-system/spec.md, design.md.

DEC-200 goes on `v2/dec-200` from `master`, in its own PR (#242), before the code (AGENTS.md). The code goes on a `ch47/` branch from `master` after #242 merges.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~190 authored + 23 vendored (one 205 KiB minified file), without the planning artifacts |
| 400-line budget risk | Low by line count |
| Chained PRs recommended | No |
| Suggested split | Single PR with `size:exception` for the vendored file (DEC-184 and the map), one commit |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

The exception covers the vendored file only: it is one 205 KiB minified blob that can't be reviewed line by line. It is checked by sha256 against the published tarball instead.

### Suggested Work Units

| Unit | Goal | Commit boundary | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Vendored file, license, `.gitattributes`, typed list, tests and map | Commit 1 | `npx tsx --test src/compartido/estilos-rutas.test.ts src/aislamiento/contexto-tenant.test.ts` | `npm run test:db` on port 5434 | Revert the commit. No page loads the script yet |

## 0. Decision
- [x] 0.1 DEC-200 in `docs/01-decisiones.md` on `v2/dec-200`, committed before any code, with the map numbering line moved to DEC-201. PR #242.

## 1. The file
- [x] 1.1 `.gitattributes`: add `public/ui/vendor/* -text` with a one-line comment (design §1). It must be in place **before** the file is added, so the index stores the exact bytes.
- [x] 1.2 `npm pack chart.js@4.6.1` into the scratchpad, extract `package/dist/chart.umd.js` and `package/LICENSE.md`. Copy them to `public/ui/vendor/chart.umd.js` and `public/ui/vendor/LICENSE-chartjs.md`, unmodified. Never retype them, and never open them with an editor that rewrites line endings.
- [x] 1.3 Check that `sha256sum public/ui/vendor/chart.umd.js` equals `338399fb5bafe598d21cfc471b0590b61ceb321a985fade4f68499b151f67fbf` and that the size is 210,078 bytes. After `git add`, check the same hash for `git show :public/ui/vendor/chart.umd.js`.

## 2. The list
- [x] 2.1 `src/compartido/estilos-rutas.ts`:
  - typed rows `{ archivo, tipo }` with the `CSS` and `JS` constants;
  - the script row with its CH-47 comment;
  - `ArchivoEstilos` taken from `archivo`, and `RUTAS_ESTILOS` with its shape unchanged;
  - `cargarEstilos` reads `archivo` and throws «Archivo de la interfaz ausente o ilegible: public/ui/<file>»;
  - `registerEstilosRoutes` sends with each row's `tipo` (design §2).
- [x] 2.2 Same file, header comment:
  - six files;
  - why the `estilos` names also hold the script (DEC-200);
  - the provenance block: package, version, file, sha256, license;
  - the `npm pack` re-copy procedure;
  - the CSS parity loop kept over the five stylesheets.

  The source must still not mention the database client (R7).
- [x] 2.3 `src/aislamiento/contexto-tenant.ts`: the comments that say «stylesheet» also name the vendored script. No code change.

## 3. Tests
- [x] 3.1 `src/compartido/estilos-rutas.test.ts`:
  - `bytesEnDisco` and `copiaTemporal` read `archivo` from each row, and the temp copy creates `vendor/`.
  - R1 checks six routes and each row's content type, plus an explicit assertion for `/ui/vendor/chart.umd.js` with `text/javascript; charset=utf-8`.
  - R4 restricts the import targets to the CSS rows minus `styles.css`.
  - New tests (design §3):
    - R5b: the missing script is named in the boot error;
    - V1: the sha256 and the `Chart.js v4.6.1` banner;
    - V2: `node:vm`, with `typeof Chart === 'function'` and `Chart.version === '4.6.1'`;
    - V3: `vendor/` holds exactly the two files, the license is MIT with the Chart.js contributors, and no route serves it;
    - V4: `git check-attr text` answers `unset`, through `execFileSync` with no shell, skipped with a reason when `git` is missing.
  - Update the describe titles that say "five".
- [x] 3.2 `src/aislamiento/contexto-tenant.test.ts`: E2 adds the following, all `400 tenant-no-indicado`:
  - `GET /ui/vendor/`;
  - `GET /ui/vendor/chart.umd.js.map`;
  - `GET /ui/vendor/../../package.json`;
  - `HEAD /ui/vendor/chart.umd.js`;
  - `POST /ui/vendor/chart.umd.js`.

  Update the comment that says "five closed-over buffers".

## 4. Docs
- [x] 4.1 `docs/02-mapa-de-changes.md`: the CH-47 row with the PR number.

## 5. Verification
- [x] 5.1 The focused command of unit 1, then `npx tsc -p tsconfig.json --noEmit`, `npm run build` and `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`. Only the 4 known `conexiones.test.ts` failures (5.1, 5.3, 5.4, CH-07) may remain.
- [x] 5.2 `git diff --cached --stat`: the vendored file is 14 lines, and `git ls-files --eol public/ui/vendor/` shows `-text` with no CRLF.
