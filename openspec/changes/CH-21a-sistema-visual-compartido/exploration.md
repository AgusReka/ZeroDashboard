# Exploration: CH-21a Shared visual system (skill stylesheet applied to the existing console)

Date: 2026-10-04. Decision to register BEFORE implementing: DEC-124 (last registered entry is DEC-123, `docs/01-decisiones.md:2224`). The decision is the user's (`AGENTS.md`, "Decisiones de arquitectura").

## Current state

**How the console is built and served**
- `src/consola.ts` is a single 1,330-line file. `DOCUMENTO_CONSOLA` (`consola.ts:29-1320`) is one TypeScript template literal holding the whole document: `<style>` (`:35-78`, 44 lines), static markup (`:80-193`) and one inline `<script>` (`:195-1317`, about 1,120 lines of plain JS).
- The route is `GET /consola` (`consola.ts:1326-1330`). It replies 200 with `text/html; charset=utf-8` and takes no Prisma client.
- No security or cache headers are set on this route. A repo-wide search found no helmet, CSP or `setHeader` in `src/`. The only `.header(...)` calls are `cache-control: no-store` in `agentes-rutas.ts:94,111`. There is no CSP today to break.
- The header comment (`consola.ts:3-9`) rejects `@fastify/static` "for a single document". The same reasoning is in `docs/bitacora/CH-04-...md:28`. The serving mechanism was never registered as a DEC. DEC-07 only decides that the console exists. That premise changes now: there will be two surfaces sharing one stylesheet.
- The spec `openspec/specs/query-console/spec.md:11` says markup and client structure are "a design-level concern". The same spec (`:106`) requires that the row-cap cut message stays "visually and textually distinguishable" from the load-more control. Line `:289` forbids a backtick in the page.

**Tenant-header exemption**
- `esExenta` (`src/contexto-tenant.ts:123-145`) matches `request.routeOptions.url`, the route pattern. It is never a URL prefix, so `/consola-falsa` cannot pass as `/consola` (DEC-15 resolution 1, `docs/01-decisiones.md:279`).
- Today's exempt set is: `GET` on `/health`, `/consola` and `/contrato` (`:131-136`); four exact `/plantillas` rows (`:116-121`); `/tenants` and `/tenants/*` (`:144`).
- An unmatched URL has no pattern, so it is refused with `400 tenant-no-indicado` before any 404 (`:92-94`). This is fail-closed.
- A `<link rel="stylesheet">` cannot send `X-Tenant-Id`, so any stylesheet route MUST be exempt. The precedents are DEC-24 (`/contrato`), DEC-61 (`/plantillas`) and DEC-116 (`/agente/*`), each registered as its own closed exemption.
- `pedir()` attaches the header only to `fetch` calls (`consola.ts:554-568`). Assets loaded by the browser never carry it.

**Rule 2 for static assets**
- A static asset handler has no Prisma client, so it cannot leak tenant data. This is the same structural argument as DEC-24.
- Rules 1, 3, 4, 5 and 7 are not touched. Rule 6 (anti-scope) is not touched either: this is UI plumbing and the engine is unchanged.
- Fastify 5 exposes HEAD for GET routes by default. `esExenta` only exempts `GET`, so `HEAD /ui/...` would get a 400. That matches `HEAD /consola` today. Browsers do not send HEAD for stylesheets, and exempting HEAD would widen the list, which is a decision. Not verified at runtime.

**How the tests constrain the console**
- `src/consola.test.ts` fetches `/consola` with `inject()` from a Fastify that only has `registerConsolaRoute` (`:230-243`). It extracts the inline script with `indexOf('<script>')` and `indexOf('</'+'script>')` (`:239-242`). It runs the script via `new Function` over a hand-made `Nodo` DOM (`:160-203`).
- That fake DOM supplies nodes from the `IDS` list (25 ids, `:117-143`), whether or not those ids exist in the HTML. `getElementById` returns `null` for any id not in `IDS`.
- **`npm test` never checks that ids exist in the served markup.** Only `scripts/smoke.sh:275-281` and `:389-416` grep a few literals: `<textarea id="sql"`, `id="ejecutar"`, `id="nombre"`, `id="guardar"`, `id="guardadas"`, `id="barra-tenant"`, `id="tenant"`, `id="tenant-activo"`, `type="button"`, `textContent`, `X-Tenant-Id`, no `innerHTML`, and exactly one `</script>`.
- Other structural checks: exactly one closing script tag and no `inner`+`HTML` (`:251-257`); `/id="limite"[^>]*max=/` must not match and `/id="limite"[^>]*min="1"/` must match (`:259-264`); no backtick in the document (`:957-958`).
- **`Nodo.porClase` compares `className` by strict equality** (`:107-113`). Tests rely on these exact values: `parametro`, `parametro-nombre`, `parametro-tipo`, `parametro-valor`, `parametro-leyenda`, `corte`, `automatizacion`, `ejecucion`, `desactivar`, `ver-ejecuciones`.
- The script assigns `className` wholesale: banner (`consola.ts:354,362,368`), tenant indicator (`:482,487`), the `parametro*` nodes (`:621-649`), `ayuda` (`:846-888`, `:1047`), `nulo` (`:411`), `corte` (`:443`), row classes (`:1036`), `boton(texto, clase)` (`:1094`).
- The stub `Nodo` has no `classList`. Any new `getElementById` in the script needs its id added to `IDS`, otherwise `null.className` throws.
- What breaks if assets move: CSS leaving the `<style>` block breaks nothing (no test or smoke check reads the CSS). JS leaving the inline script breaks `consola.test.ts` (extraction) and the smoke checks for `textContent` and `X-Tenant-Id`. **JS and HTML must stay inline in CH-21a.** HTML moving to a file still works through `inject()`, but adds nothing to this change.

**Build and packaging**
- `package.json:7` has `"build": "tsc -p tsconfig.json"`. `tsconfig.json` has `rootDir: src`, `include: ["src"]`, no copy step. `tsc` does not emit non-TS files. There is no static or CSS dependency in `package.json`, and `@fastify/static` is not in `node_modules`.
- The engine image (`Dockerfile:31-42`) copies only `node_modules`, `dist`, `prisma`, `prisma.config.ts` and `package*.json`, plus the entrypoint. It runs `node dist/server.js` with `WORKDIR /app` (`docker-entrypoint.sh:7`).
- The build stage does `COPY . .` (`Dockerfile:5`), so a tracked `public/` reaches the build stage. The final stage needs one new `COPY --from=build /app/public ./public`.
- `.dockerignore` excludes `docs`, `openspec`, `.atl`, `.claude`, `dist` and `dist-agente`. Nothing under `.claude/` can be read at runtime or in the image. Assets must live in a tracked source path outside `.claude/`.
- The agent image (`Dockerfile:22-29`, `tsconfig.agente.json:7`) copies only `dist-agente` and `ws`. It is unaffected.
- In dev and test the module directory is `src/` (`tsx watch src/server.ts`, `tsx --test`). In production it is `dist/`. So `join(import.meta.dirname, '..', 'public')` resolves to `<root>/public` in all three, and `/app/public` in the image. `import.meta.dirname` needs Node 20.11 or later. The image is `node:22-alpine`.
- `.gitignore` explicitly un-ignores `/.claude/skills/zerodashboard-design/`. `public/` is not ignored and does not exist yet (verified).

**The skill as input**
- `SKILL.md:8` and `readme.md:104-105` say production is "plain HTML + CSS + JS (no build): link `styles.css` and use `.zd-*`". The React and JSX files and `_ds_bundle.js` are mockups only.
- `styles.css` contains only four `@import url(...)` lines: `tokens/colors.css` (53 lines), `tokens/typography.css` (10), `tokens/spacing.css` (22), `components/components.css` (174). Total is 263 lines (verified with `wc -l`). Byte size not measured; unminified it is probably 25-30 KB (estimate).
- A search of all `*.css` found no `url()`, no `@font-face` and no `http(s):`. The stack is `system-ui` plus a system monospace, with no webfonts. It works offline with no build and no CDN.
- Dark mode is built in, via `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]` (`colors.css:24-53`). The surface density hook is `[data-surface="panel"]` (`spacing.css:19-22`).
- Icons are inline SVG (`class="zd-icon" aria-hidden="true"`), so they inherit `currentColor`. There are 72 SVG files in `assets/icons`, and none needs to be served.
- `.zd-*` classes available: `zd-root`, `zd-h1/h2/h3`, `zd-eyebrow`, `zd-muted`, `zd-meta`, `zd-mono`, `zd-num`; `zd-btn` (`--primary`, `--secondary`, `--ghost`, `--danger`, `--sm`, `--lg`); `zd-field`, `zd-label`, `zd-input`, `zd-select`, `zd-textarea` (`--code`), `zd-help`, `zd-form`, `zd-form-row`; `zd-tenantbar` (`__label`, `__name`, `__id`, `--none`); `zd-table-wrap`, `zd-table-scroll`, `zd-table`, `zd-pager`; `zd-badge`, `zd-banner`, `zd-card`, `zd-state`, `zd-spinner`, `zd-skeleton`, `zd-conn`, `zd-kv`, `zd-code`, `zd-tag`.
- Not available as CSS classes: sidebar, nav item, page header and modal overlay. They exist only as inline style objects in `ui_kits/consola/ConsolaShell.jsx:19-26`. The mockup's sidebar and multi-screen layout is out of scope for CH-21a, because the real console is one page with no routing.

**What the current console markup would use**
`body.zd-root`; `header#barra-tenant` becomes `zd-tenantbar`; `h1`/`h2` become `zd-h1`/`zd-h2`; static labels, inputs, textarea (`--code`) and selects get `zd-label`, `zd-input`, `zd-textarea`, `zd-select`; static buttons get `zd-btn` with `--primary` or `--secondary`; `.tabla-contenedor` becomes `zd-table-scroll` inside `zd-table-wrap`, and the three static `<table>`s get `zd-table`.

## Constraints discovered (apply to any option)

1. **Script-managed class names cannot carry static `zd-*` classes.** `#banner` and `#tenant-activo` are re-assigned by the script (`banner.className = 'banner'`, `indicadorTenant.className = ''`). A static `zd-banner` on `#banner` is wiped on the first `mostrarBanner()`. Classes on script-built nodes (`parametro-*`, `corte`, row classes) cannot take `zd-*` without changing `porClase` in the tests.
2. **`.zd-banner{display:grid}` defeats the `hidden` attribute.** `components.css` has no `[hidden]{display:none}` rule. Linking the skill CSS and styling `#banner` with `zd-banner` would show an empty banner. Any bridging layer needs `[hidden]{display:none !important}`. `.zd-banner` also expects an icon and title structure, while the script writes `textContent` to the node, which would wipe children.
3. **Tenant-bar state lives on a child, not the header.** `.zd-tenantbar--none` goes on the container, but the script toggles `sin-tenant` on the inner `<strong>`. Switching the bar between violet and amber with zero JS needs `:has()` (`.zd-tenantbar:has(.sin-tenant)`). The skill itself uses `:has` (`components.css:128`). Without `:has` support the bar stays violet while the text says "Ningún tenant seleccionado". Adding a class from JS would need the `barra-tenant` id in `IDS`.
4. **Native `<select>` inside the violet bar** needs explicit colors in both schemes. The skill has no rule for it.
5. **Linking `components.css` applies `*{box-sizing:border-box}` to everything** (`components.css:2`), even elements without `zd-*` classes.
6. **Visual drift is unavoidable.** Body size goes from 1rem to 14px, tables from .9rem to 13px, and the monospace stack changes. No automated visual test exists, so verification is a manual screenshot checklist.

## Affected areas

`src/consola.ts` (remove 44-line `<style>`, add `<link>`, add classes to static markup, no JS change in the recommended path); `src/consola.test.ts` (add a markup-id guard and a stylesheet-link assertion); `src/contexto-tenant.ts` and its test (new exact exemption rows); `src/server.ts` (register asset routes); new registrar module and its test; new tracked directory, for example `public/ui/`; `Dockerfile` (one `COPY` line in the engine stage); `scripts/smoke.sh` (headerless `GET` on the stylesheet); `docs/01-decisiones.md` (DEC-124).

## Approaches (serving the shared visual system)

Effort counts only the mechanism, without the verbatim 263-line CSS copy or tests.

| # | Approach | New deps | Tests | Docker image | Security | Caching | Effort | Fit for the panel |
|---|---|---|---|---|---|---|---|---|
| a | CSS held in a TS string (`src/estilos.ts`), interpolated into each page's `<style>` | none | none change | none | No new route, so no exemption change. Smallest surface | None across pages (about 25-30 KB re-sent per page) | ~15 lines. Hand-copied CSS-in-TS drifts from the skill; backtick and `${` hazard (spec forbids backticks) | Panel imports the same constant; no separate cacheable file; a strict CSP later forces inline-style handling |
| a2 | Same TS constant, served at one route (`GET /ui/zd.css`) | none | route test, one exemption row | none | Exact route, no filesystem, no traversal | Cacheable, ETag by hand | ~35 lines. Same drift and escaping issues as (a) | Good |
| b | Real `.css` files in a tracked `public/ui/`, read at boot by a registrar with a fixed list. Exact `GET` routes and exemption rows derived from the same list | none | route and exemption tests | one `COPY` line | No path comes from the request, so no traversal. A new file requires editing the list and its test. Fail-closed at boot if a file is missing | `no-cache` plus manual ETag, or short max-age. No fingerprinted names | ~55 lines | Good. Assets must stay reachable before login |
| c | `@fastify/static` on `public/` | `@fastify/static` plus transitive packages (not enumerated) | route tests | one `COPY` line | Default wildcard registers one pattern (`/static/*`). Exempting it is one row, but every file ever dropped in the folder inherits the exemption | Built in (`maxAge`, `etag`) | ~25 lines plus lockfile churn | Good |
| d1 | Pre-build script generating a TS file from the CSS | none | tests need the generated file | none | No filesystem at runtime | As (a2) | ~40 lines plus `pretest` and `prebuild` steps | Adds a build step, which contradicts the project's no-build UI line |
| d2 | CDN or external fonts | none | n/a | none | Third-party origin | n/a | n/a | Rejected: production must work offline |

Notes:
- Option (c) fits Fastify 5 and is the Fastify skill's documented static pattern. HEAD behavior and the transitive dependency list were not verified. The project's own precedent prefers fewer dependencies (DEC-09, `docs/01-decisiones.md:155`).
- Option (b) has two sub-choices. **Verbatim tree:** five exact routes (`styles.css`, three tokens, `components.css`); matches the skill's own "copy and link `styles.css`" instruction and makes updates a plain copy; the `@import` chain adds a negligible request waterfall. **Single concatenated bundle:** one route, but loses verbatim provenance and needs a drift check.
- Any option that copies the skill creates a drift risk. A parity test against `.claude/skills/zerodashboard-design` would couple `npm test` to the skill folder: acceptable on dev machines, unusable inside the image because `.dockerignore` strips `.claude`.
- `HEAD` stays unexempt, as today for `/consola`. Unknown asset URLs return `400 tenant-no-indicado` instead of 404 (fail-closed). A usability quirk, not a leak.

## Recommendation (the decision is the user's)

**Option (b), with the verbatim file tree.**

1. Copy the skill's five CSS files verbatim into a tracked `public/ui/`. Ids, JS and the inline script stay as they are.
2. Add a small registrar that reads a fixed file list at boot, fails closed if a file is missing, and registers exact `GET` routes. The same list feeds the exemption rows (one source of truth). No prefix, wildcard or `HEAD`.
3. Docker: add `COPY --from=build /app/public ./public` to the engine stage only.
4. Console adoption is CSS-only bridging, with zero JS diff: a small console-specific stylesheet (about 90 lines) styling script-managed nodes by selector (`.banner`, `.banner.exito`, `#tenant-activo.sin-tenant` with the `:has()` bar variant, `.parametro`, `.corte`, `.ayuda`, `.nulo`, table-embedded and dynamic buttons, `[hidden]{display:none !important}`), plus `zd-*` classes on static markup only.
5. Defer moving HTML and inline JS to files, `zd-*` on script-built nodes (needs a token-aware `porClase`), and the banner icon restructure. These fit CH-21c, which rewrites the console screens anyway. Moving HTML or JS out of the string stays an open decision for CH-22.

Why not the others: (a)/(a2) keep a hand-maintained CSS copy inside a string; (c) adds a dependency and a standing exemption over a whole directory; (d1) adds a build step.

## Scope and size estimate (400-line rule)

The verbatim CSS copy alone is 263 lines, so the slice cannot fit one PR.

| PR | Content | Est. lines |
|---|---|---|
| PR0 | DEC-124 only (docs PR) | ~50 |
| PR1 | `public/ui/*` verbatim (~263), registrar (~55), exemption rows (~12), `server.ts` (~3), Dockerfile (~3), registrar test (~70), exemption tests (~40), smoke (~5) | ~450. Over budget because of the verbatim copy: needs `size:exception` for the vendored lines (verifiable with `diff -r` against the skill), or split the tests into a follow-up as CH-19c1 did with "1b" |
| PR2 | Console adoption: remove `<style>` (-44), `<link>` (+2), console bridging CSS (~90), class additions to static markup (~60 changed), markup-id and link tests (~50), smoke (~5) | ~250-300 |

Total about 750 lines across three chained PRs inside one change (CH-19b / CH-19c precedent). The ~1.7 test multiplier from `docs/02-mapa-de-changes.md:85` is already folded in. Until PR2 merges, the stylesheet is served but unused, which is acceptable.

## Risks

- **Visual regressions.** No browser or HTML parser in `npm test`. Verification is a manual screenshot checklist, light and dark: no tenant, tenant selected, result table, capped result, error banner, ok banner, parameter rows, automations and runs tables, at about 360 px and 1280 px.
- **Missing or renamed ids go unnoticed.** Add a markup-id guard test: every `IDS` entry plus `barra-tenant`, `resultados`, `guardado`, `automatizaciones` appears exactly once in the served HTML; `banner` keeps `role="alert"` and `hidden`; `<textarea id="sql"` keeps `id` first; `id="limite"` keeps `min="1"` and no `max=`.
- **Hidden banner shows empty** if `.zd-banner` is used on `#banner` (constraint 2).
- **Class loss** on script-managed nodes (constraint 1).
- **Cap-cut distinctness.** The spec requires `.corte` to stay visually separate from the load-more control.
- **Dark mode.** `prefers-color-scheme` handles it from the tokens; no theme toggle UI is added. White on `--tenant` (`#5a2db0`) is about 8.6:1; other contrasts not checked, so the skill's AA claims are unverified.
- **CSP.** None today. A later CSP would force a nonce or hash for the inline script and a decision on inline `<style>`.
- **Transition duplication.** `<style>` removal and `<link>` land in the same PR (PR2), so no duplicate rules reach master.
- **Boot dependency on files.** A forgotten `COPY` crashes the container at boot (visible, fail-closed). `smoke.sh` would catch it if it checks the stylesheet.
- **Skill drift.** The copy in `public/ui` can fall behind the skill. Mitigation: a documented update procedure (re-copy, re-run tests), not a runtime link.
- **Stale cache.** Unfingerprinted names mean `max-age` must be short or `no-cache` with ETag.
- **Anti-scope.** Nothing here extends the engine or adds a product capability.
- **Config note.** `openspec/config.yaml` still says "greenfield project, no code yet, not a git repo". It is stale and does not block this change.

## Open decisions (all the user's)

1. **Serving mechanism** (recommended: option b), DEC-124 item A1.
2. **Source of truth for the visual code** (recommended: verbatim copy of five files, not a concatenated bundle), A2.
3. **Exemption shape** (recommended: exact `GET` rows derived from the registrar's file list; no prefix, no wildcard, no `HEAD`), A3.
4. **Docker** (recommended: one `COPY` line, agent image unchanged), A4.
5. **Scope of the DEC** (recommended: only the stylesheet is externalized; HTML and inline JS stay in `consola.ts`; moving them is left undecided until CH-22), A5.
6. **Console adoption depth** (recommended: CSS-only bridging with zero JS diff, `zd-*` on static markup only; the alternative is `zd-*` in the script plus a token-aware `porClase`, deferred to CH-21c).
7. **PR split** (recommended: PR0 docs, PR1 mechanism with `size:exception` for the vendored copy, PR2 adoption).

## Draft DEC-124 (proposal, not a decision; Spanish as the decisions file uses)

```
### DEC-124 — CH-21a: la hoja de estilos compartida se sirve como archivos fijos; las páginas siguen siendo strings de TypeScript

**Contexto.** La consola (`src/consola.ts`) es un documento HTML, CSS y JS dentro de un template literal de TypeScript. DEC-07 decidió que la consola existe, pero la forma de servirla nunca se registró: solo quedó en el comentario del archivo y en la bitácora de CH-04, que descartó `@fastify/static` "para un solo archivo". CH-21a incorpora el sistema visual de la skill `zerodashboard-design` (`styles.css` más tokens y componentes, CSS plano sin build) y CH-22 sumará un segundo documento (panel) que debe usar las mismas hojas. `tsc` no copia archivos que no son TypeScript, y la etapa final de la imagen del motor copia solo `dist`, `node_modules`, `prisma` y los archivos del paquete.

**Opciones y decisión.**
- **Mecanismo (A1).** (a) CSS dentro de strings de TypeScript, interpolado en cada página; (b) archivos `.css` en un directorio rastreado, leídos al arrancar por un registrador con lista fija y rutas `GET` exactas, sin dependencia; (c) `@fastify/static`; (d) paso de build que genere TypeScript desde el CSS. **Propuesta: (b).** [Decisión del usuario.]
- **Origen del código visual (A2).** Copia literal de los cinco archivos CSS de la skill en `public/ui/`, sin concatenar ni modificar; los íconos quedan como SVG inline. **Propuesta: copia literal.** [Decisión del usuario.]
- **Exención de `X-Tenant-Id` (A3).** Filas exactas `GET` por archivo, derivadas de la misma lista que registra las rutas; sin prefijo, sin comodín y sin `HEAD`. Un archivo nuevo exige editar la lista y su prueba. **Propuesta: filas exactas.** [Decisión del usuario.]
- **Imagen Docker (A4).** Una línea `COPY --from=build /app/public ./public` en la etapa del motor; la etapa del agente no cambia. **Propuesta: esta.** [Decisión del usuario.]
- **Alcance (A5).** Solo la hoja de estilos sale del string. HTML y JS de las páginas siguen en TypeScript (el test y el smoke inspeccionan el script inline). Moverlos a archivos queda sin decidir hasta CH-22. **Propuesta: este alcance.** [Decisión del usuario.]

**Por qué.** Los activos son idénticos para todo tenant y sus manejadores no tienen cliente de Prisma, el mismo argumento estructural de DEC-24 y DEC-61 (regla 2). Una lista fija evita que un archivo futuro herede una exención. Sin dependencia nueva, como DEC-09.

**Se resigna.** El arranque depende de que los archivos existan (falla cerrada). La copia de la skill puede desviarse de su fuente. Sin CSP, el script y los estilos inline siguen permitidos. Una URL de activo inexistente responde `400 tenant-no-indicado` y no 404.

**Decidido por:** pendiente. Lo decide el usuario; no lo infiere un agente.

**Estado:** propuesta.
```

## Not verified

Byte sizes of the CSS files; `git ls-files` for the skill folder; actual rendering and browser support for `:has()`; WCAG contrast except the tenant bar; `@fastify/static` transitive dependency list and HEAD behavior.

## Ready for Proposal

Yes, but only after the user answers the open decisions and DEC-124 is registered in `docs/01-decisiones.md` (`AGENTS.md`; `docs/02-mapa-de-changes.md`, CH-21a note).
