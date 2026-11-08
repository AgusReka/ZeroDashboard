```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:4e280abc3c56c86d5ceec126e5f66b68553a8cbb77a664b2cd3c4df479ab2913
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 17/18
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db
test_exit_code: 1
test_output_hash: sha256:3acc3cea52a2acd2e2dab7c0341510be986e0bd070b1cf8d4c9c44b516c9d3be
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:7c1e2620b9496a46f07127dae7af97f0979ae3e93a9468ec51b53dca56bfd382
```

# Verify report: CH-47 — Chart.js vendored in `public/ui/vendor/`

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 2 WARNING, 4 SUGGESTION). Verified 2026-11-08 on branch `ch47/chartjs` at `f43394b` (PR #243, commits `1946dfb` and `f43394b`, label `size:exception`), against `master`. Independent pass: the verifier did not write the code. Mode: Standard (`strict_tdd: false`). Counts follow native status (`### Requirement:` and `#### Scenario:` headings) over the single delta spec `shared-visual-system`: 6 requirements (5 MODIFIED, 1 ADDED) and 18 scenarios. `evidence_revision` is the SHA-256 of `git diff master...ch47/chartjs` (289,543 bytes). `test_output_hash` and `build_output_hash` are the SHA-256 of the captured stdout and stderr of each command (the build hash equals the one in the CH-46 report because the output is identical). Admission: `gentle-ai sdd-verify-validate --requirements 6 --scenarios 18` denies this envelope («passing verdict contradicts failing or incomplete evidence»), because it requires `test_exit_code: 0` and N/N scenarios for a passing verdict. Both fields are left truthful here (`test_exit_code: 1` from the 4 known environmental failures, `scenarios: 17/18` from the pre-existing parity scenario), as in the CH-46 report. With those two fields set to `0` and `18/18` the same envelope validates as `pass_with_warnings`, which the verifier did not do because it would misstate the evidence. The orchestrator decides whether to settle on this report.

## Commands
| Command | Result |
|---|---|
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres DATABASE_URL=postgresql://zerodashboard:postgres@localhost:5434/zerodashboard_test npx tsx --test src/compartido/estilos-rutas.test.ts src/aislamiento/contexto-tenant.test.ts` | exit 0; 86 tests, 86 pass, 0 fail, 0 cancelled, 0 skipped (so V4 ran, `git` was found) |
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm run build` | exit 0 (`tsc -p tsconfig.json`, no diagnostics) |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | exit 1; 2027 tests, 2023 pass, 4 fail, 0 cancelled, 0 skipped. The 4 failures are exactly the known environmental ones in `src/conexiones/conexiones.test.ts`: 5.1, 5.3, 5.4 and CH-07. No other failure. |

The four commands ran in the foreground, one at a time, on the shared `zerodashboard_test` (port 5434). No second `test:db` was ever started. The verifier wrote no data to the database; the suite's own fixtures clean up after themselves. `psql` is not installed here, so the absence of residue was not probed directly; the CH-14 scheduler-tick cases, which count every due automation and would fail on a stray row, passed. Port 5432 was never used and `.env` was never read. Coverage: not available (no coverage tool configured).

## Byte-exactness of the vendored files
Done independently: `npm pack chart.js@4.6.1` into `scratchpad/verify47` (outside the repository), `tar` extraction of `package/dist/chart.umd.js` and `package/LICENSE.md`.

| Check | Result |
|---|---|
| `cmp` published `dist/chart.umd.js` vs `public/ui/vendor/chart.umd.js` | identical |
| `cmp` published `LICENSE.md` vs `public/ui/vendor/LICENSE-chartjs.md` | identical |
| `cmp` published `dist/chart.umd.js` vs `git show HEAD:public/ui/vendor/chart.umd.js` | identical |
| `cmp` published `LICENSE.md` vs `git show HEAD:public/ui/vendor/LICENSE-chartjs.md` | identical |
| sha256 of tarball file, committed blob and working file | all `338399fb5bafe598d21cfc471b0590b61ceb321a985fade4f68499b151f67fbf`, equal to the constant in the spec, the test and the module header |
| size | 210,078 bytes |
| `git ls-files --eol public/ui/vendor/` | `i/lf w/lf attr/-text` for both files |
| `git check-attr text` | `unset` for both files |
| Index entries | mode 100644, one blob each (`ef741079...` script, `f216610f...` license) |

## Completeness
| Metric | Value |
|---|---|
| Tasks total | 12 (0.1; 1.1-1.3; 2.1-2.3; 3.1-3.2; 4.1; 5.1-5.2) |
| Tasks complete | 12 |
| Tasks incomplete | 0 |

Each task was checked against the diff, not only the checkbox:
- 0.1: DEC-200 exists in `docs/01-decisiones.md` (status firme, decided by the user), merged as #242 before the code, as AGENTS.md requires. The three choices (4.6.1, one list with a content type per row, hand copy) match the proposal and design.
- 1.1: `.gitattributes` has `public/ui/vendor/* -text` with a one-line comment, and `git check-attr` confirms it. 1.2 and 1.3: byte-exactness table above.
- 2.1: typed rows `{ archivo, tipo }` with `CSS` and `JS`, `ArchivoEstilos` from `archivo`, `RUTAS_ESTILOS` keeps its shape, `cargarEstilos` throws «Archivo de la interfaz ausente o ilegible: public/ui/<file>», and the registrar sends with each row's `tipo`. 2.2: header comment has six files, why the `estilos` names hold a script, the provenance block and the `npm pack` procedure, and keeps the CSS parity loop over the five stylesheets. 2.3: three comments in `contexto-tenant.ts`, no code change (the diff there is comment-only).
- 3.1: R1 over six routes, the explicit `text/javascript` assertion, R4 over CSS rows, and the new R5b and V1-V4, all present and passing. 3.2: E2 gained the five refused cases. The «five closed-over buffers» comment now says six.
- 4.1: `docs/02-mapa-de-changes.md` CH-47 row carries «Un solo PR con `size:exception`. PR #243».
- 5.1: re-run above, same result as apply-progress (2027 tests, 2023 pass, the 4 known failures). 5.2: `git ls-files --eol` shows no CRLF.

## Spec compliance matrix
Paths are relative to `src/`. "er" = `compartido/estilos-rutas.test.ts`, "ct" = `aislamiento/contexto-tenant.test.ts`. All listed tests passed in the focused run and in `test:db`.

### shared-visual-system, delta CH-47 (6 requirements, 18 scenarios)
| Requirement | Scenario | Implementation | Test | Result |
|---|---|---|---|---|
| Fixed-List Stylesheet Registrar | Each listed file is served | `estilos-rutas.ts` rows and `registerEstilosRoutes` | er `R1 each route answers 200 with its row content type, no-cache, a strong ETag and the file bytes` (six routes, bytes compared with `rawPayload.equals`); ct `E1 GET <url> answers 200 headerless and with an unknown tenant id, byte-identical` (six tests) | COMPLIANT |
| Fixed-List Stylesheet Registrar | Unlisted asset URL is rejected without leaking | no route, no exemption row for these URLs | ct `E2 GET /ui/unknown.css`, `/ui/tokens/`, `/ui/vendor/`, `/ui/vendor/chart.umd.js.map`, `/ui-falso/styles.css` (each `400 {"error":"tenant-no-indicado"}`) | COMPLIANT |
| Fixed-List Stylesheet Registrar | HEAD is not served | `exposeHeadRoute: false` | ct `E2 HEAD /ui/styles.css` and `E2 HEAD /ui/vendor/chart.umd.js` (400); er `R3` (route table holds `GET` only) | COMPLIANT |
| Fixed-List Stylesheet Registrar | Relative imports resolve | unchanged `styles.css` | er `R4 every @import in styles.css resolves to one of the other four stylesheet routes` (expected set is the CSS rows minus `styles.css`, length asserted as 4) | COMPLIANT |
| Assets Are Loaded at Boot and Fail Closed | Missing file stops boot | `cargarEstilos` throw naming the file | er `R5 a missing tokens/spacing.css makes cargarEstilos throw naming the file` | COMPLIANT |
| Assets Are Loaded at Boot and Fail Closed | Missing vendored script stops boot | same | er `R5b a missing vendor/chart.umd.js makes cargarEstilos throw naming the script` | COMPLIANT |
| Assets Are Loaded at Boot and Fail Closed | Traversal has no path to the filesystem | closed-over buffers, no request-derived path | ct `E2 GET /ui/../package.json`, `/ui/%2e%2e/package.json`, `/ui/vendor/../../package.json` (each 400 `tenant-no-indicado`) | COMPLIANT |
| Assets Are Loaded at Boot and Fail Closed | Files changed after boot are not re-read | buffers read once | er `R6 a file edited after loading leaves the served bytes unchanged` (on `components.css`, not on the script; same code path) | COMPLIANT |
| Response Headers | Content type, cache policy and ETag | per-row `tipo`, `no-cache`, strong ETag | er `R1 ...` (row type, `no-cache`, `^"[A-Za-z0-9_-]+"$`, same ETag on repeat) and `R1 the stylesheets are text/css and the vendored script is text/javascript, named explicitly` (literals, so a wrong row type cannot pass) | COMPLIANT |
| Response Headers | Matching If-None-Match returns 304 | handler | er `R2 a matching If-None-Match answers 304 with no body; another tag answers 200` (six routes; checks `Cache-Control` on the 304) | COMPLIANT |
| Response Headers | Non-matching If-None-Match returns the full body | handler | er `R2` (same test) | COMPLIANT |
| Assets Carry No Tenant Data (Rule 2) | Identical bytes with and without a tenant | exempt rows, no tenant lookup | ct `E1` (six routes, headerless vs unknown tenant id, with a throwing client stub proving no lookup). See S1 on "valid" tenant | COMPLIANT |
| Assets Carry No Tenant Data (Rule 2) | Registrar has no database dependency | registrar takes `(app, estilos)` | er `R7` (arity 2, source names no `prisma`); the registrar-only app in `R1` serves all six routes | COMPLIANT |
| Vendored Files Are Verbatim | Parity with the skill | five CSS files untouched by this diff | No automated test. Verifier ran `diff -q` over the five files against `.claude/skills/zerodashboard-design/`: no difference. See W1 | PARTIAL |
| Vendored Chart Library Is Pinned | The bytes are the pinned release | `public/ui/vendor/chart.umd.js` | er `V1 the file sha256 equals the pinned hash and its banner names Chart.js v4.6.1`; independent `cmp` against the npm tarball (above) | COMPLIANT |
| Vendored Chart Library Is Pinned | The file is the loadable UMD build | same | er `V2 the file runs in a bare node:vm context and exposes Chart with version 4.6.1` (`typeof Chart === 'function'`, `Chart.version === '4.6.1'`) | COMPLIANT |
| Vendored Chart Library Is Pinned | Line endings cannot rewrite the file | `.gitattributes` line | er `V4 .gitattributes leaves the script binary-safe: git check-attr text answers unset`; ran, not skipped | COMPLIANT |
| Vendored Chart Library Is Pinned | The license travels with the copy | `public/ui/vendor/LICENSE-chartjs.md` | er `V3 vendor/ holds exactly the script and its MIT license, and no route serves the license` (exact directory listing, license text, `GET /ui/vendor/LICENSE-chartjs.md` answers 404) | COMPLIANT |

**Compliance summary**: 17/18 scenarios compliant, 1 partial (pre-existing, manually verified), 0 untested, 0 failing. Requirements: 6/6 implemented.

## Correctness (static evidence)
| Area | Status | Evidence |
|---|---|---|
| Typed list | Implemented | `ARCHIVOS_ESTILOS` has six rows; one list drives the loader, the routes and `ESTILOS_EXENTOS` (`RUTAS_ESTILOS.map(ruta => 'GET ' + ruta)`) |
| Content type per row | Implemented | `reply.type(tipo)`; five `CSS` rows and one `JS` row |
| Boot fail-closed | Implemented | `cargarEstilos` throws naming `public/ui/<file>`; the registrar throws if a row is not in the loaded map |
| Tenant exemption | Implemented | Exactly one new exact `GET` row (`GET /ui/vendor/chart.umd.js`), derived, not hand-written; `ct` E1 and E2 and `er` R3 pin the set to the registered routes |
| Hash and version pin | Implemented | Constants `CHART_VERSION` and `CHART_SHA256` in the test; the server does not check the hash at boot (design decision) |
| Docs | Implemented | Map row with PR #243 |

## Rules and decisions
- **Rule 2 (tenant isolation).** The exemption gains exactly one row. It is built from `RUTAS_ESTILOS`, so it cannot diverge from the registered route, and `R3` asserts equality of the two sets in both directions. The folder `/ui/vendor/`, the `.map` URL, traversal, `HEAD` and `POST` on the script all stay `400 tenant-no-indicado` (E2). The handler holds no database client: `rg -i prisma src/compartido/estilos-rutas.ts` finds nothing (exit 1), and `R7` pins it.
- **No SQL, no replica, no engine change** (rules 1, 3, 4, 6). Production code adds no query and no process. The diff to `src/` is `estilos-rutas.ts` (list, comments), comments in `contexto-tenant.ts`, and two test files.
- **No existing assertion was weakened.** Removed lines in the two test files are: imports; header and describe titles ("five" to "six", "stylesheet" to "asset"); the loop `for (const archivo of ARCHIVOS_ESTILOS)` now destructuring rows; the fixed `'text/css; charset=utf-8'` assertion, replaced by `tipo` of each row plus an explicit named assertion for the script and for the five stylesheets (equal or stricter); `RUTAS_ESTILOS.length` 5 to 6; and the R4 `deepEqual` against «routes minus styles.css», replaced by the CSS rows minus `styles.css` with `assert.equal(esperados.length, 4)` added (same four expected routes). The one renamed test title in R7 says «loaded files» for «loaded sheets». No `skip`, `todo` or loosened matcher was introduced.
- **V4 uses `execFileSync` without a shell.** `execFileSync('git', ['check-attr', 'text', '--', 'public/ui/vendor/chart.umd.js'], { cwd, encoding })`: fixed arguments, no `shell` option, no input from outside. A missing `git` (`ENOENT`) skips with a stated reason; any other error rethrows.
- **No `prisma` in `src/compartido/estilos-rutas.ts`:** confirmed, comments included.
- **Source map not shipped:** `public/ui/vendor/` holds exactly the two files (V3), and the `.map` URL is refused (E2).
- **Container image.** The `Dockerfile` copies `/app/public` whole, so the license and the script ship with it, as the design says.
- **Delivery.** PR #243 is open from `ch47/chartjs`, carries `size:exception`, and has the two commits. Authored lines are about 213 added and 57 removed in `src/`, plus 23 vendored lines.

## Coherence (design) and deviations
| Decision | Followed? | Notes |
|---|---|---|
| §0 generic boot error | Yes | «Archivo de la interfaz ausente o ilegible: public/ui/<file>» |
| §0 `.map` URL stays tenant-scoped | Yes | E2 |
| §0 license shipped, not served | Yes | V3 (404) |
| §1 file source, targets, `.gitattributes` | Yes | Byte-exactness table |
| §2 typed rows, names unchanged, `consola-auth.ts`, `server.ts` untouched | Yes | `consola-auth.ts` spreads `ESTILOS_EXENTOS` into its operator-session exemption, so it picks up the new row with no edit |
| §2 hash lives in the test, not in the server | Yes | |
| §2 header comment and provenance block | Yes | |
| §3 R1, R2, R4, R5b, V1-V4, R7, E1, E2 | Yes | All present. E2 adds the five cases the design lists |
| Apply deviation: registrar's second error message is generic too | Acceptable | No test matched the old wording; same reason as §0 |
| Apply deviation: V1 checks the banner lines, not the literal first line | Acceptable | The first line is `/*!` and the version is on the second; the spec says "leading license banner names `Chart.js v4.6.1`" |
| Apply deviation: V3 also asserts the license route answers 404 | Acceptable | Stricter than the design |
| Apply deviation: two TypeScript files written whole with LF in the working copy | Acceptable | `autocrlf=true` normalizes on `git add`; `git status` shows no stray modification in `src/` |

None of the deviations breaks a spec scenario.

## Issues found
**CRITICAL**: None.

**WARNING**
- **W1. The "Parity with the skill" scenario has no covering test.** It is restated by this delta but unchanged from CH-21a; the project proves it with the `diff -q` loop in the module header, not with a test. The verifier ran that loop for the five stylesheets and found no difference, so the scenario holds today, but it is not guarded at runtime. Same state as before this change; not caused by it.
- **W2. The script is untested in a real browser and nothing loads it.** V2 proves it runs in a bare `node:vm` context and exposes `Chart.version`, not that a page with a DOM can draw with it. This is by design (no page loads it until CH-48) and consistent with the project's choice not to run a manual visual pass, so it is recorded as unverified, not as a request.

**SUGGESTION**
- **S1. "A valid tenant id" is stood in for by an unknown one.** The exempt route returns before any lookup, and the throwing client stub proves it. The same argument was accepted in CH-21a; the spec wording could say "any tenant id" at archive.
- **S2. Comment layout in `src/aislamiento/contexto-tenant.test.ts` (lines 412-414).** The edited block comment leaves one line far longer than its neighbours («...by one / exact `GET` row each, built from the same list that registers them. The real registrar is mounted here, not stubs, so the»). The describe title still says «stylesheet exemption rows». Cosmetic; no behavior.
- **S3. The operator-session exemption also gains the route.** `src/consola/consola-auth.ts` spreads `ESTILOS_EXENTOS` into its own exempt set, so `GET /ui/vendor/chart.umd.js` needs neither a tenant header nor an operator session, like the CSS rows. This is consistent with DEC-124 and the file is public library code, but neither the design nor the spec mentions that second consumer of the list. Worth one sentence at archive.
- **S4. Stray untracked files in the repository root** (`0`, `0)`, `Para`, `[f.texto`, `` ` ``, `p.url`, `tolerancia`, plus `docs/design/ZeroDashboard Design System.zip`) and modified `.atl/` files. None is in the PR diff or in HEAD, but `git add -A` would pick them up. Unrelated to CH-47.

## What remains untested
- No real browser load of the script (W2). CH-48 is the first consumer.
- The parity of the five CSS files with the skill is checked by procedure, not by a test (W1).
- `V4` depends on `git` being on the `PATH`; in the production image it is skipped with a reason (by design), so it only guards in development and CI.
- The 4 known `conexiones.test.ts` failures were not re-run on `master`; the brief records that they fail there too.

## Verdict
**PASS WITH WARNINGS.** All 6 requirements are implemented and 17 of 18 scenarios have a passing covering test; the remaining one (parity with the skill) is unchanged from CH-21a, has no automated test, and holds by a manual `diff -q`. All 12 tasks are done. The vendored script and license are byte-identical to the published `chart.js@4.6.1` tarball and to the committed blobs, with the pinned sha256 and no CRLF rewrite. The tenant exemption grows by exactly one derived `GET` row, the module still names no database client, no existing assertion was weakened, and V4 uses `execFileSync` without a shell. The only failing tests in `test:db` are the 4 known environmental ones.

## Key Learnings
1. `core.autocrlf=true` plus `-text` in `.gitattributes` keeps a vendored byte-pinned file stable: `git show HEAD:<path>` matches the npm tarball with `cmp`, and `git ls-files --eol` reports `attr/-text`.
2. One typed list drives the loader, the routes and the tenant exemption, but `consola-auth.ts` also spreads `ESTILOS_EXENTOS`, so adding a row to `ARCHIVOS_ESTILOS` also exempts it from the operator session; check every consumer of the exemption set, not only the tenant hook.
3. A `node:vm` load in a bare context is enough to prove a UMD bundle's global and version without a DOM, but says nothing about drawing.
