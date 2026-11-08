# Proposal: CH-47 — Chart.js vendored in `public/ui/vendor/`

**Status**: ready for spec and design. Inputs: exploration.md, DEC-124, DEC-184, DEC-200. No story. Depends on CH-36, merged. Consumer: CH-48.

## Intent
CH-48 draws the report charts in the panel with Chart.js (DEC-184), but nothing serves the library yet. This change serves one exact, verified copy of it from our own server through the closed file list of DEC-124. No page loads it until CH-48.

## Scope

### In Scope
- **The file.** `public/ui/vendor/chart.umd.js`, a byte-for-byte copy of `dist/chart.umd.js` from `chart.js@4.6.1`. It is 210,078 bytes, with sha256 `338399fb5bafe598d21cfc471b0590b61ceb321a985fade4f68499b151f67fbf`. Its trailing `sourceMappingURL` comment stays, and the `.map` file is not shipped.
- **License.** The MIT license of Chart.js, in `public/ui/vendor/` next to the file. The file is shipped, not served.
- **The list (DEC-200).** One more row in `ARCHIVOS_ESTILOS` (`src/compartido/estilos-rutas.ts`), served at `GET /ui/vendor/chart.umd.js`.
  - Each row declares its content type. The CSS rows keep `text/css; charset=utf-8`, and the script is `text/javascript; charset=utf-8`.
  - Same boot load, strong ETag, `304`, `Cache-Control: no-cache` and fail-closed boot as the CSS rows.
  - The tenant-header exemption gains that one exact route automatically, because it derives from the same list.
- **Provenance.** The module header records the version, sha256 and re-copy procedure (`npm pack chart.js@4.6.1`, copy, check the hash). It also explains why the stylesheet names now also hold a script.
- **Integrity.** A test pins the sha256 and the banner version. It also loads the file in a `node:vm` context and expects `Chart.version === '4.6.1'`.
- **Line endings.** `.gitattributes` marks `public/ui/vendor/*` as `-text`.

### Out of Scope
- The `<script src>` tag in the panel, the drawing, the colors and the accessible tables (CH-48).
- A CDN or an SRI attribute (DEC-184).
- An npm dependency or a copy script (DEC-200).
- Renaming `ARCHIVOS_ESTILOS`, `cargarEstilos` and the related symbols.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `shared-visual-system`: the closed list grows from five files to six. Content type is set per file. The vendored script is pinned by version and hash, and its exemption row is added.

## Approach
Turn the list entries into typed rows (file and content type) and keep one loader, one registrar and one exemption source. Copy the file by hand from the published tarball and let a test prove that the bytes and the version are the expected ones.

## Rules Check
- **Rule 2.** The new route serves the same bytes to every tenant, and its handler has no database client. The exemption covers only that exact `GET`. `HEAD`, `POST`, the bare folder and the `.map` URL stay `400 tenant-no-indicado`.
- **Rules 1 and 3-5.** No SQL, no replica access, no query execution.
- **Rule 6, anti-scope.** It serves a static file and draws nothing.

## Rollback
Revert the PR: the row, the file, the license and the `.gitattributes` line. Nothing loads the script yet, so no page changes.

## Affected Areas
- `public/ui/vendor/chart.umd.js`, `public/ui/vendor/LICENSE-chartjs.md` (new)
- `src/compartido/estilos-rutas.ts`, `estilos-rutas.test.ts`
- `src/aislamiento/contexto-tenant.test.ts`, plus a comment in `contexto-tenant.ts` if its wording names only stylesheets
- `.gitattributes`
- `openspec/specs/shared-visual-system/spec.md` (through the delta)
- `docs/02-mapa-de-changes.md` (PR number)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A 205 KiB minified file can't be reviewed line by line | Certain | `size:exception`; the sha256 must match the published tarball, and a test checks it |
| A Windows checkout rewrites the bytes to CRLF | High without the fix | `-text` in `.gitattributes`, plus the hash test |
| The script is served with the wrong content type and the browser refuses it | Low | A test asserts the header on the script row |
| The exemption widens by more than one route | Low | E2 keeps the folder, `.map`, `HEAD` and `POST` refused |

## Success Criteria
- [ ] `GET /ui/vendor/chart.umd.js` without a tenant header answers 200 with `text/javascript; charset=utf-8`, the exact bytes on disk, and `304` on a matching ETag.
- [ ] A test proves the sha256 and that the file exposes `Chart.version === '4.6.1'`.
- [ ] The server refuses to boot when the file is missing, naming it.
- [ ] The list and the exemption hold six rows, and nothing else under `/ui/vendor/` is exempt.
- [ ] `npm run test:db` and `npx tsc -p tsconfig.json --noEmit` pass, apart from the known failures.
