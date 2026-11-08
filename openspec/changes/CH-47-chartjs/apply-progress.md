# Apply progress: CH-47 — Chart.js vendored in `public/ui/vendor/`

## Unit 1: tasks 1.1 to 5.2, all done

Task 4.1 (the PR number in `docs/02-mapa-de-changes.md`) was done after the PR was opened: PR #243.

### Tasks done

- 1.1: `.gitattributes` gains `public/ui/vendor/* -text` with a one-line comment, added before the vendored files. `git check-attr text` answers `unset`.
- 1.2: `npm pack chart.js@4.6.1` in a scratch folder outside the repository, `tar` extraction of `package/dist/chart.umd.js` and `package/LICENSE.md`, copied with `cp` to `public/ui/vendor/chart.umd.js` and `public/ui/vendor/LICENSE-chartjs.md`. Neither file was opened in an editor.
- 1.3: sha256 and size checked on disk and in the index (below).
- 2.1, 2.2: `src/compartido/estilos-rutas.ts`: typed rows `{ archivo, tipo }` with `CSS` and `JS`, the script row, `ArchivoEstilos` from `archivo`, the generic boot error, the per-row content type, and the header comment (six files, why the `estilos` names hold a script, the provenance block, the `npm pack` re-copy procedure, the CSS parity loop unchanged). The source still names no database client (R7).
- 2.3: `src/aislamiento/contexto-tenant.ts`: the three comments about the stylesheet rows also name the vendored script. No code change.
- 3.1: `src/compartido/estilos-rutas.test.ts`: helpers over the rows, R1 over six routes with each row's type plus an explicit `text/javascript` assertion, R4 over the CSS rows only, and the new R5b, V1, V2, V3 and V4. Describe titles no longer say "five".
- 3.2: `src/aislamiento/contexto-tenant.test.ts`: E2 adds `GET /ui/vendor/`, `GET /ui/vendor/chart.umd.js.map`, `GET /ui/vendor/../../package.json`, `HEAD /ui/vendor/chart.umd.js` and `POST /ui/vendor/chart.umd.js`; the "five closed-over buffers" comment says six.
- 5.1, 5.2: the verification below.

### Files touched

| File | Action | Lines (+/-) |
|---|---|---|
| `.gitattributes` | Modify | +2 |
| `public/ui/vendor/chart.umd.js` | Create (vendored, 210,078 B) | +14 |
| `public/ui/vendor/LICENSE-chartjs.md` | Create (vendored) | +9 |
| `src/compartido/estilos-rutas.ts` | Modify | +68 / -29 |
| `src/compartido/estilos-rutas.test.ts` | Modify | +128 / -21 |
| `src/aislamiento/contexto-tenant.ts` | Modify (comments) | +7 / -4 |
| `src/aislamiento/contexto-tenant.test.ts` | Modify | +10 / -3 |

### Deviations from the design, with reasons

- **The registrar's second error message is generic too.** `registerEstilosRoutes` threw «Hoja de estilos no cargada» for a row missing from the loaded map; it now reads «Archivo de la interfaz no cargado: public/ui/<file>», for the same reason as the boot message (design §0). No test matched the old wording.
- **V1 checks the banner block, not the literal first line.** The file's first line is `/*!`; `Chart.js v4.6.1` is on the second. The test looks for the version in the lines of the leading banner (first 200 bytes), which is what the spec scenario means.
- **V3 proves "no route serves the license" twice:** no listed route names it, and `GET /ui/vendor/LICENSE-chartjs.md` on an app with only this registrar answers `404`.
- **The two TypeScript files written whole have LF endings in the working copy.** `core.autocrlf=true` normalizes them on `git add`, so the index and the diff are unaffected.

### Verification

- `npx tsx --test src/compartido/estilos-rutas.test.ts src/aislamiento/contexto-tenant.test.ts` (with `TEST_DB_PORT=5434`, `TEST_DB_PASSWORD` and `DATABASE_URL` for the test database, which the live-hook suite needs): 86 tests, 86 pass, 0 fail.
- `npx tsc -p tsconfig.json --noEmit`: exit 0, no output.
- `npm run build`: exit 0.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 2027 tests, 2023 pass, 4 fail. The 4 are the known failures in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07).
- `sha256sum public/ui/vendor/chart.umd.js` and `git show :public/ui/vendor/chart.umd.js | sha256sum`: both `338399fb5bafe598d21cfc471b0590b61ceb321a985fade4f68499b151f67fbf`, 210,078 bytes.
- `git diff --cached --stat`: `chart.umd.js` 14 lines, `LICENSE-chartjs.md` 9, `.gitattributes` 2.
- `git ls-files --eol public/ui/vendor/`: `i/lf w/lf attr/-text` for both files.
