# Design: CH-47 — Chart.js vendored in `public/ui/vendor/`

Inputs: proposal.md, the `shared-visual-system` delta spec, DEC-124, DEC-184, DEC-200.

## 0. What the spec settles beyond DEC-200

None of these changes a boundary, so none needs a new DEC. They are listed so the user can object.

- **The boot error message becomes generic.** «Hoja de estilos ausente o ilegible» would be wrong for a script, so it reads «Archivo de la interfaz ausente o ilegible: public/ui/<file>». No test matches the old wording; R5 matches the path.
- **The `.map` URL stays tenant-scoped.** Browser devtools may request `/ui/vendor/chart.umd.js.map` and get `400 tenant-no-indicado`. The page is not affected.
- **The license file is shipped but not served.** It goes into the image with the existing `COPY` of `public/`.

## 1. The file

- **Source.** `npm pack chart.js@4.6.1`, then extract `package/dist/chart.umd.js` and `package/LICENSE.md`.
- **Targets.**
  - `public/ui/vendor/chart.umd.js`, unmodified. It is 210,078 bytes, with sha256 `338399fb5bafe598d21cfc471b0590b61ceb321a985fade4f68499b151f67fbf`.
  - `public/ui/vendor/LICENSE-chartjs.md`, the license text unmodified.
- **`.gitattributes`.** A new line, with a comment saying why: the bytes are pinned by hash and must not change on a CRLF checkout.

  ```
  public/ui/vendor/* -text
  ```

- **Checks before committing.** `sha256sum public/ui/vendor/chart.umd.js` equals the pinned hash, and so does `git show :public/ui/vendor/chart.umd.js | sha256sum` (the index).

## 2. The list (`src/compartido/estilos-rutas.ts`)

The rows become typed. The exported names stay, as DEC-200 says.

```ts
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
export const RUTAS_ESTILOS: readonly string[] = ARCHIVOS_ESTILOS.map(({ archivo }) => rutaDe(archivo));
```

- **Load.** `cargarEstilos` iterates the rows and reads `archivo`. The rest is unchanged, except the error message in §0.
- **Register.** `registerEstilosRoutes` iterates the rows and sends with `reply.type(tipo)`. Everything else is unchanged: one exact `GET`, `exposeHeadRoute: false`, `no-cache`, the strong ETag and `304`.
- **No wiring change.** `RUTAS_ESTILOS` keeps its shape, so `contexto-tenant.ts`, `server.ts`, `app/rutas.ts` and `consola.test.ts` compile unchanged. In `contexto-tenant.ts`, the two comments that say «stylesheet» also name the vendored script.

**Header comment.**
- Rename the first paragraph to «the shared stylesheet and the vendored chart library, served as six fixed files».
- Explain why the `estilos` names now hold a script: one list for routes, load and exemption (DEC-200).
- Add a provenance block: package, version, file, sha256, license file. Then the re-copy procedure, from Git Bash at the repository root:

```sh
npm pack chart.js@4.6.1 --pack-destination "$TMP"
tar -xzf "$TMP/chart.js-4.6.1.tgz" -C "$TMP" package/dist/chart.umd.js package/LICENSE.md
cp "$TMP/package/dist/chart.umd.js" public/ui/vendor/chart.umd.js
cp "$TMP/package/LICENSE.md" public/ui/vendor/LICENSE-chartjs.md
sha256sum public/ui/vendor/chart.umd.js   # must equal the pinned hash
```

- An update to a new version is its own change: copy the file again, then update the version and the hash in the test and in this comment.
- The CSS parity loop stays as it is, over the five stylesheet files only.

**Decision: the hash lives in the test, not in the server.** The server does not check the hash at boot. A boot check would make the server refuse to start over a file that the test already pins, and it would duplicate the constant. The test is the gate, as for the CSS parity.

## 3. Tests

### `src/compartido/estilos-rutas.test.ts`

- `bytesEnDisco` and `copiaTemporal` take `archivo` from each row; `copiaTemporal` also creates `vendor/`.
- **R1.** Six routes. Each answers 200 with the content type of its row, `no-cache`, a strong ETag and the disk bytes. The test names `/ui/vendor/chart.umd.js` with `text/javascript; charset=utf-8` explicitly, so a wrong type cannot pass through the row.
- **R2.** Unchanged: `304` and the full body on a non-matching ETag, over the six routes.
- **R4.** The `@import` targets equal the four other stylesheet routes. The expected set is the CSS rows minus `styles.css`, so the script never enters it.
- **R5b (new).** A copy without `vendor/chart.umd.js` makes `cargarEstilos` throw naming `public/ui/vendor/chart.umd.js`.
- **V1 (new).** The sha256 of the disk file equals the pinned constant, and the leading license banner (the first comment block) includes `Chart.js v4.6.1`.
- **V2 (new).** The file runs in `vm.createContext({})` through `vm.runInContext`. The context then holds a `Chart` function whose `version` is `'4.6.1'`.
- **V3 (new).** `public/ui/vendor/` holds exactly `chart.umd.js` and `LICENSE-chartjs.md`. The license starts with `The MIT License` and names the Chart.js contributors, and no route serves it.
- **V4 (new).** `git check-attr text -- public/ui/vendor/chart.umd.js` answers `unset`. It runs through `execFileSync`, with no shell. If `git` is not on the path the test is skipped with a reason, because the image has no `git`.
- **R7.** Unchanged: two parameters, and the source does not name the database client.

### `src/aislamiento/contexto-tenant.test.ts`

- **E1** loops over `RUTAS_ESTILOS`, so it covers the script with no edit.
- **E2** adds `GET /ui/vendor/`, `GET /ui/vendor/chart.umd.js.map`, `GET /ui/vendor/../../package.json`, `HEAD /ui/vendor/chart.umd.js` and `POST /ui/vendor/chart.umd.js`. All give `400 tenant-no-indicado`.
- The exemption set equals the six registered routes (R3, unchanged code).

## 4. Data flow

```
boot: server.ts → cargarEstilos() reads 6 rows → Map<archivo, {contenido, etag}>
      (missing file → throw «Archivo de la interfaz ausente o ilegible: public/ui/vendor/chart.umd.js»)
request: GET /ui/vendor/chart.umd.js (no X-Tenant-Id)
      → contexto-tenant hook: 'GET /ui/vendor/chart.umd.js' ∈ ESTILOS_EXENTOS → skip
      → handler: If-None-Match = etag ? 304 : 200 text/javascript + buffer
```

## 5. Files

| File | Action | Estimate |
|---|---|---|
| `public/ui/vendor/chart.umd.js` | Create (vendored, 14 lines, 210,078 B) | 14 |
| `public/ui/vendor/LICENSE-chartjs.md` | Create (vendored) | 9 |
| `.gitattributes` | Modify | 3 |
| `src/compartido/estilos-rutas.ts` | Modify | 60 |
| `src/aislamiento/contexto-tenant.ts` | Modify (comments) | 4 |
| `src/compartido/estilos-rutas.test.ts` | Modify | 110 |
| `src/aislamiento/contexto-tenant.test.ts` | Modify | 10 |
| `docs/02-mapa-de-changes.md` | Modify (PR number) | 1 |

About 190 authored lines plus 23 vendored lines, under the 400-line budget. The PR carries `size:exception` for the 205 KiB vendored file (DEC-184), not for its line count.

## 6. Testing

| Layer | What | Where |
|---|---|---|
| Unit | Typed rows, six routes, content type per row, 304, boot failure naming the script, hash, banner, `vm` load, license, `-text` attribute | `src/compartido/estilos-rutas.test.ts` |
| Integration (hooks) | Script served headerless and byte-identical with a tenant; folder, `.map`, traversal, `HEAD` and `POST` refused | `src/aislamiento/contexto-tenant.test.ts` |

Run with `npx tsx --test src/compartido/estilos-rutas.test.ts src/aislamiento/contexto-tenant.test.ts`, then `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` and `npx tsc -p tsconfig.json --noEmit`.

## 7. Threat matrix

| Surface | Applies | Note |
|---|---|---|
| Shell or subprocess | Yes, test only | V4 runs `git check-attr` through `execFileSync` with fixed arguments, no shell and no user input. Production code runs no process |
| Third-party code in the client session | Yes | Same-origin file pinned by hash and fixed in the repository. No CDN (DEC-184). It is not loaded by any page until CH-48 |
| Tenant boundary | Yes | One exact exempt `GET`. Same bytes for every tenant, and no database client in the handler |
| VCS automation, executable-file classification | No | — |

## 8. Rollout and rollback

The change only adds a route and two files, and no page uses them yet. Rollback is reverting the PR.

## 9. Delivery

A single PR with `size:exception`, as DEC-184 and the map require. The work unit is one commit: the file, the list, the tests and the docs.

## Open questions

None.
