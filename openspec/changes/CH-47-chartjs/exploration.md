# Exploration: CH-47 — Chart.js vendored in `public/ui/vendor/`

Status: **closed** (explored 2026-11-08). The user chose 4.6.1, the same list and a hand copy, with no research phase; recorded as DEC-200. Store: openspec. No story (map column is "—"). Depends on CH-36, merged. Consumer is CH-48 (panel dashboard, DEC-183). Independent of CH-40/41/43/45.

Map row (`docs/02-mapa-de-changes.md:69`): "Chart.js copiado en `public/ui/vendor/`, con su fila en la lista fija de DEC-124. DEC-184. Excepción de tamaño por el archivo de terceros, como la copia de la skill en CH-21a".

## Current State

### What the decisions already fix

DEC-184 (`docs/01-decisiones.md:3479`, decided by the user 2026-10-23, option (b)):
- Library: **Chart.js 4, MIT, UMD build**, copied **literally** into `public/ui/vendor/`, **exact version pinned**.
- "Copiarla es una nueva fila en la lista fija de DEC-124, con su prueba."
- Drawing is on `<canvas>`, so no client data reaches the DOM as markup. Colors come from the design tokens via `getComputedStyle` (CH-48). Number and table do not use the library. Each chart gets an accessible table (CH-48).
- Accepted costs: large third-party file, updated by hand, "el PR que lo copia necesita una excepción de tamaño, como la copia de la skill en CH-21a", first front-end dependency.
- Rejected: own SVG drawer (a), CDN (c), server-side SVG (d). So no `integrity`/CDN question exists.

DEC-183 only says the browser drawing was left to a separate DEC (this is it). DEC-124 (`:2247`) is the mechanism: closed list, exact `GET` rows, no prefix/wildcard/`HEAD`, one exemption derived from the same list, fail closed at boot, copy literal, `COPY --from=build /app/public ./public` in the engine image, scope limited to the stylesheet until now (A5).

### The "lista fija" in code

It is `ARCHIVOS_ESTILOS` in `src/compartido/estilos-rutas.ts` (5 CSS files, `as const`). One list drives three things:
1. `cargarEstilos(dir)` reads every file once at boot (called from `src/server.ts:21`, before the DB client or listener) and throws `Hoja de estilos ausente o ilegible: public/ui/<file>` on a missing file. It computes a strong sha256 base64url `ETag`.
2. `registerEstilosRoutes(app, estilos)` (called from `src/app/rutas.ts:86`) adds one exact `GET` per file with `exposeHeadRoute: false`, `Cache-Control: no-cache`, the ETag and `304` on a matching `If-None-Match`. **The content type is hardcoded `text/css; charset=utf-8`.**
3. `RUTAS_ESTILOS = ARCHIVOS_ESTILOS.map(rutaDe)` feeds `ESTILOS_EXENTOS` in `src/aislamiento/contexto-tenant.ts:179`, the tenant-header exemption (`'GET ' + ruta`). Route and exemption cannot diverge.

The registrar receives no DB client (structural premise of the exemption, DEC-24 argument).

Design consequences of adding a JavaScript file to this list:
- The hardcoded `text/css` must become per-entry (a JS file served as `text/css` is blocked or ignored by the browser).
- Names are CSS-specific (`ARCHIVOS_ESTILOS`, `cargarEstilos`, `EstilosCargados`, `HojaCargada`, "Hoja de estilos ausente" message, `estilos-rutas.ts`). They are used in `server.ts`, `app/rutas.ts`, `contexto-tenant.ts`, `consola.test.ts`, `contexto-tenant.test.ts`, `rutas.test.ts` and the registrar test.

### Serving of `public/ui/` today

- Only five CSS files exist: `public/ui/{styles.css,tokens/{colors,spacing,typography}.css,components/components.css}`. **No `vendor/` folder, nothing vendored besides the CH-21a CSS copy.** No `@fastify/static`.
- No CSP, no `nosniff`, no security headers anywhere in `src` (searched `content-security`, `x-frame`, `nosniff`, `onSend`). Inline `<script>` is allowed; there is nothing to relax for a same-origin external script.
- Pages are TypeScript strings. Panel (`src/panel/panel.ts`, 928 lines) has `<link rel="stylesheet" href="/ui/styles.css">` (`:65`) and three inline `<script>` blocks (login `:157`, logout `:305`, screen `:312`). The authenticated shell is where CH-48 would add `<script src="/ui/vendor/chart.umd.js"></script>`.
- The tenant hook exempts only the exact `GET` rows. `/ui/vendor/` bare, look-alikes and `.map` URLs fall to `400 tenant-no-indicado`.

### How CH-21a handled the copy (precedent)

- Procedure documented in the `estilos-rutas.ts` header comment: copy, never retype, then `diff -q` per file against the skill folder. Parity is checked by blob id too.
- Size: PR1 was ~517 lines (254 authored + 263 vendored) under `size:exception` limited to the vendored lines (`openspec/changes/archive/2026-10-05-CH-21a-.../tasks.md:21,38`; budget is 400 authored lines).
- No license file was needed there (own skill). Provenance was "the skill", with a re-copy procedure.

### Tests that pin the list (will change)

- `src/compartido/estilos-rutas.test.ts` (195 lines): R1 asserts `RUTAS_ESTILOS.length === 5` and `content-type === 'text/css; charset=utf-8'` for every entry; R4 asserts the `@import` targets equal "the other four routes" (`RUTAS_ESTILOS` minus `styles.css`); R5 missing-file boot failure; stale-after-boot test; source scan for DB client names. `copiaTemporal` copies every listed file.
- `src/aislamiento/contexto-tenant.test.ts:422-470`: E1 per-route headerless 200, E2 rejected URLs (bare folder, look-alikes, traversal, `HEAD`, `POST`), plus a test that `ESTILOS_EXENTOS` equals the registered routes.
- `src/consola/consola.test.ts:734` and `src/app/rutas.test.ts` only reference the stylesheet link / `cargarEstilos`.
- Spec `openspec/specs/shared-visual-system/spec.md`: "SHALL serve **exactly five files**", content type `text/css`, "list is closed" — needs a MODIFIED delta.
- `src/panel/panel.test.ts` extracts the screen script with `html.lastIndexOf('<script>')`; a `<script src="...">` tag does not match that literal, but CH-48 must keep the inline-script extraction working.

### Build, image and agent

- `npm run build` is `tsc` only: it does not copy `public/`. The engine loader reads `../../public/ui/` relative to `src/` or `dist/`, i.e. `/app/public/ui` in the image.
- `Dockerfile:38` copies the whole `public/` tree, so `public/ui/vendor/` ships with **no Dockerfile change**. `.dockerignore` does not exclude it.
- The agent bundle (`tsconfig.agente.json`, `src/agente-proceso/**`) is not affected.
- Memory: one extra ~205 KiB buffer held at boot.

### Chart.js, verified against the registry (2026-11-08)

`npm view chart.js` -> latest `4.6.1`, license MIT; `4.5.0`, `4.5.1`, `4.6.1` are the recent 4.x. `chart.js@4.6.1` tarball inspected:
- `dist/chart.umd.js`: **210,078 bytes, 14 lines** (minified, very long lines), sha256 `338399fb5bafe598d21cfc471b0590b61ceb321a985fade4f68499b151f67fbf`. `dist/chart.umd.min.js` is 210,082 bytes (practically the same file, 4 bytes differ).
- Banner: `/*! Chart.js v4.6.1 ... Released under the MIT License`. `@kurkle/color` v0.3.2 (MIT) is **bundled** inside the UMD and carries its own banner.
- UMD assigns `window.Chart` (and `globalThis`), no `eval` or `new Function` (only `evaluateInteractionItems`), no network access on load.
- Last line is `//# sourceMappingURL=chart.umd.js.map`: devtools would request `/ui/vendor/chart.umd.js.map`, which would answer `400 tenant-no-indicado` (devtools noise only; not served in production use).
- Loads in a bare `node:vm` context with no DOM: `typeof Chart === 'function'`, `Chart.version === '4.6.1'`. So a boot-level test can prove the file is the expected, loadable UMD without a browser.
- `LICENSE.md` is 9 lines (MIT, "Copyright (c) 2014-2024 Chart.js Contributors").
- ESM build (`chart.js`) needs chunks and the bare import `@kurkle/color`, so it is not usable by the inline classic scripts of these pages. UMD is the only fit (consistent with DEC-184; not an open question).

### Platform risk found

`core.autocrlf=true` here and `.gitattributes` only sets `*.sh text eol=lf`. A vendored JS file checked out on Windows would get CRLF line endings (14 lines), differing from the npm bytes and from the Docker/Linux checkout. Harmless to the browser but it breaks any hash pin and the "literal copy" claim. The CSS copy has the same latent issue, but its tests compare against the disk file, not a constant.

## Affected Areas

- `public/ui/vendor/chart.umd.js` — new, verbatim copy of `chart.js@4.6.1/dist/chart.umd.js` (210,078 B, 14 lines).
- `public/ui/vendor/LICENSE-chartjs.md` (name to confirm) — new, MIT text (9 lines). Not served; shipped with the tree by the existing `COPY`.
- `src/compartido/estilos-rutas.ts` — add the entry to the closed list; per-entry content type (`text/javascript; charset=utf-8`); update header comment: provenance (version, sha256, source tarball), re-copy procedure.
- `src/aislamiento/contexto-tenant.ts` — comment only if the exemption wording is updated; the row appears automatically (derived from the list).
- `src/compartido/estilos-rutas.test.ts`, `src/aislamiento/contexto-tenant.test.ts` — new/adjusted cases (below).
- `openspec/specs/shared-visual-system/spec.md` — delta: five -> six files, per-file content type, exemption row for the JS file, vendored-file integrity requirement, Purpose line.
- `.gitattributes` — `public/ui/vendor/* -text` (recommended).
- `docs/01-decisiones.md` — small addendum or DEC for the points DEC-184 does not settle (version, file, list shape, pin).
- Not touched: `Dockerfile`, `package.json` (recommended), `src/panel/panel.ts` (CH-48), `src/server.ts` and `src/app/rutas.ts` unless names are changed.

## Approaches

### A. Where the new row lives

1. **Same closed list, typed entries** — `ARCHIVOS_ESTILOS` entries become `{ archivo, tipo }` (or a parallel `Record` of content types); one loader, one registrar, one exemption.
   - Pros: literally "una nueva fila en la lista fija de DEC-124"; one source for routes and exemption; smallest diff to wiring (`server.ts`, `rutas.ts` unchanged).
   - Cons: module and symbol names say "estilos" while serving JS; existing tests that assume "all five are CSS" need edits; spec "exactly five" becomes six.
   - Effort: Low.
2. **Separate vendor list and registrar** (`vendor-rutas.ts`) with its own loader, registrar and `RUTAS_VENDOR`, and a second term in the exemption.
   - Pros: stylesheet tests and spec stay as they are; names stay honest.
   - Cons: duplicates loader/registrar/headers logic; two lists to keep consistent; wiring changes in `server.ts`, `rutas.ts`, `contexto-tenant.ts`; deviates from DEC-184's wording.
   - Effort: Medium.

### B. How the file enters the repo

1. **Commit by hand, no dependency** — `npm pack chart.js@4.6.1`, copy `dist/chart.umd.js`, verify sha256, document the procedure in the module header (like CH-21a).
   - Pros: matches DEC-184/DEC-124 "copia literal, se actualiza a mano"; no `package.json` or lockfile change; `npm ci` in Docker unchanged.
   - Cons: provenance lives in a comment and a test constant.
   - Effort: Low.
2. **`chart.js` as devDependency plus a copy script** (`npm run vendor:chartjs`).
   - Pros: version recorded in `package-lock.json` with integrity; repeatable.
   - Cons: first front-end dependency in `package.json` (DEC-184 still says "se actualiza a mano"); adds a script, a 6 MB install and a second source of truth that can drift from the committed copy.
   - Effort: Medium.

### C. Integrity

1. **Pin sha256 and banner version in a test** (plus `-text` in `.gitattributes`); no `integrity=` attribute on the tag.
2. **SRI `integrity=` on the `<script>`** in CH-48. Same-origin file served by our own server, so SRI protects nothing the pin test does not, and it would couple page HTML to the hash.

## Recommendation

A1 + B1 + C1, with no consumer in CH-47. Concretely:
- Chart.js **4.6.1**, file `dist/chart.umd.js`, served as `/ui/vendor/chart.umd.js` with `text/javascript; charset=utf-8`, `Cache-Control: no-cache`, strong ETag and `304`, exactly like the CSS rows.
- Keep existing symbol names (`ARCHIVOS_ESTILOS`, `cargarEstilos`...) and explain in the header why they also hold the vendored script; renaming is churn across six files for no behavior.
- Tests: R1 per-entry content type and `length === 6`; R4 restricted to the CSS entries; new: vendor route 200 headerless and byte-equal to disk, 304 on matching ETag; sha256 constant equals the file; banner `Chart.js v4.6.1`; the file runs in `node:vm` and exposes `Chart.version === '4.6.1'`; boot fails naming `public/ui/vendor/chart.umd.js` when missing; exemption set has six rows; `/ui/vendor/`, `/ui/vendor/chart.umd.js.map`, `HEAD` and `POST` stay `400 tenant-no-indicado`; no DB client mention (already scanned).
- `.gitattributes` `public/ui/vendor/* -text` so the bytes are identical on Windows, CI and the image.
- Leave the trailing `sourceMappingURL` comment (literal copy, DEC-184); the `.map` is not shipped.

## Open decisions for the user (each with a recommendation)

1. **Exact version.** (a) 4.6.1, the latest 4.x. (b) 4.5.1. *Recommended: (a). Newest patch of the major DEC-184 names; no reason to start behind. Pinned exactly, updated by a later change.*
2. **Which dist file.** (a) `chart.umd.js`. (b) `chart.umd.min.js` (4 bytes bigger, same minified bundle). *Recommended: (a), the documented UMD entry; the name does not claim an extra minification.*
3. **Shape of the DEC-124 list.** (a) Same list with per-entry content type (A1). (b) Separate vendor list (A2). *Recommended: (a). It is the literal reading of DEC-184 and keeps one exemption source.*
4. **Entry into the repo.** (a) Committed by hand with a documented `npm pack` re-copy procedure (B1). (b) devDependency plus copy script (B2). *Recommended: (a), as DEC-184 says "se actualiza a mano".*
5. **Integrity.** (a) Test pins sha256 and banner; no SRI attribute. (b) Also SRI in CH-48. *Recommended: (a).*
6. **Line endings.** (a) Add `public/ui/vendor/* -text` to `.gitattributes`. (b) Do nothing and pin the hash only on LF checkouts. *Recommended: (a); without it a Windows checkout breaks the hash test and the "literal" claim.*
7. **License and provenance placement.** (a) `public/ui/vendor/LICENSE-chartjs.md` (MIT text) plus provenance block (version, source tarball, sha256, procedure) in the `estilos-rutas.ts` header. (b) Only the header comment. *Recommended: (a). MIT requires the notice to travel with copies, and the bundled `@kurkle/color` carries its own banner inside the file.*
8. **Consumer.** (a) CH-47 ships the file, row, tests and spec only; the `<script src>` in the panel belongs to CH-48. (b) Also add the tag to `panel.ts` now. *Recommended: (a). The map marks no story for CH-47, and loading 205 KiB in a page that draws nothing yet is dead weight.*
9. **Registering the choices.** (a) A short addendum to DEC-184 (or DEC-200) recording items 1-7 before apply, as CH-45 and CH-46 did (DEC-198, DEC-199). (b) Treat them as implementation detail inside the spec/design. *Recommended: (a), short; AGENTS.md requires architecture decisions in `docs/01-decisiones.md` first and the version pin plus list shape change the DEC-124 contract.*
10. **Size exception.** (a) Label the PR `size:exception` for the vendored file, as the map and DEC-184 require. *Recommended: (a). By line count it is only 14 lines, but it is one 205 KiB minified blob that cannot be reviewed line by line; parity is checked by sha256 against the npm tarball.*

## Risks

- **Reviewability.** The diff is a single 205 KiB minified line group. Mitigation: sha256 equals the published tarball's `dist/chart.umd.js`, recorded in the test and the header.
- **Silent drift or CRLF.** Without `-text`, Windows checkouts alter the bytes. Mitigation: `.gitattributes` plus the pin test.
- **Wrong content type** would make the browser refuse the script (CH-48 would fail at runtime, not in tests). Mitigation: explicit header assertion on the JS entry.
- **Naming drift.** "estilos" symbols serving JS. Mitigation: header comment; rename later if a second vendored file appears.
- **Spec "exactly five files" is stale** after this change; the delta must say six and keep "list is closed".
- **CH-48 coupling.** If a CSP is ever added, the canvas drawing and same-origin script need no `unsafe-eval`, but inline scripts of the pages would. Out of scope here.
- **Blast radius of the exemption.** Adds exactly one exempt `GET` row; no prefix. Same handler shape, no DB client, so rule 2 is unaffected (content identical for every tenant).

## Size estimate

- Vendored: `chart.umd.js` 14 lines / 210,078 bytes (+ 9-line LICENSE).
- Authored: about 40-50 in `estilos-rutas.ts` (typed entries, content type, provenance comment), ~5 in `contexto-tenant.ts` comment, ~90-110 in tests, ~60 in the spec delta, ~3 in `.gitattributes`, ~25 in docs (decision addendum). Roughly 220-260 authored lines, under the 400 budget. Single PR.
- `size:exception`: not needed by line count (14 vendored lines), but required by the map and DEC-184 because of the 205 KiB file. Record it before apply.

## Ready for Proposal

Yes, once the user answers the decisions above (the load-bearing ones are 1, 3, 4 and 9). No research phase: everything is internal plus the verified npm tarball. The library, UMD build, path and "new row in the fixed list" are already decided by DEC-184.
