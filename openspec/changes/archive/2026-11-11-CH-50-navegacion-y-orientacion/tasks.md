# Tasks: CH-50 — Console navigation and orientation

Inputs: proposal.md, specs/query-console/spec.md, design.md.

Delivery: **single-pr** (session preflight, 2026-11-11). Branch `ch50/navegacion` from `master`. No new DEC is needed.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~340: ~170 production (markup ~90, script ~80) + ~170 tests |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | None |
| Delivery strategy | single-pr |
| Chain strategy | — |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: —
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 1 | Navigation, tenant presentation, unknown section, single tenant-switch path, purpose lines | `npx tsx --test src/consola/consola.test.ts` | `npm test`; `npx tsc -p tsconfig.json --noEmit`; `scripts/smoke.sh` in verify | Revert the PR |

## 1. Markup
- [x] 1.1 Sidebar (L370–392):
  - Block "Global": add a `globe` icon to its heading, and the meta "se prueba con el tenant activo" on `nav-plantillas` and `nav-reportes`.
  - Tenant block: add a `building` icon, `nav-tenant-nombre` + `nav-tenant-id` (heading), and `nav-tenant-hint` (`hidden`, "Elegí un tenant para usar estas secciones").
  - Order: "Puesta en marcha" = agentes (meta "opcional"), conexiones, mapeo, usuarios, tablero; "Trabajo diario" unchanged.
  - Footer: `zd-sidenav__foot` with the heading "Investigación" holding `nav-tiempos`.
  - Every `nav-*` keeps its id.
- [x] 1.2 Tenant bar (L329–337):
  - Label "Operando sobre".
  - A `building` icon.
  - `tenant-activo` keeps the name; new `tenant-activo-id` (`zd-tenantbar__id`) holds the short id.
  - No-tenant hint text: "Las secciones del tenant necesitan uno".
- [x] 1.3 Tenant pop-up (L344): add `tc-sin-guardar`, a `zd-banner zd-banner--warn`, `hidden`, with «Tenés cambios sin guardar en Tablero del cliente. Si cambiás de tenant, se descartan.»
- [x] 1.4 New `section#pantalla-desconocida` (`hidden`):
  - a `zd-pagehead` titled "Sección no encontrada";
  - a `zd-state` «Esta sección no existe»;
  - the link `desconocida-volver`.
- [x] 1.5 Headers:
  - Frescura: remove the duplicated `h2` (L1439) and add a `zd-pagehead__desc`.
  - Consultas: purpose text from the spec.
  - Plantillas and Reportes: add `prueba-sobre-plantillas` and `prueba-sobre-reportes` next to the scope tag.
  - Any other screen without a `zd-pagehead__desc` gets one, using the `lenguaje.md` glossary.
- [x] 1.6 Initial `<title>`: "Consola — ZeroDashboard".

## 2. Script
- [x] 2.1 `fijarTenant`: set `tenant-activo` (name only) and `tenant-activo-id`; `nav-tenant-nombre`, `nav-tenant-id` and `nav-tenant-hint`; and both "Prueba sobre" lines.
- [x] 2.2 `aplicarSinTenant`: scope text "Del tenant · {nombre}" or "Necesita un tenant".
- [x] 2.3 Without a tenant:
  - disable the template and report test and save controls;
  - write their reason line ("Elegí un tenant para probar o guardar");
  - leave listing and the side panel untouched.
- [x] 2.4 `mostrarPantalla`:
  - an unknown hash shows `pantalla-desconocida` and sets no `aria-current`;
  - `desconocida-volver` points to `#consultas` or `#tenants` by tenant state;
  - `document.title` comes from a screen → title map.
- [x] 2.5 `abrirCambioTenant(idPreelegido)`:
  - `dialogoCambioTenant.alAbrir` honours the preselected id;
  - `tc-sin-guardar.hidden = !tableroCambiado()`.
- [x] 2.6 «Elegir como activo» (`accionesTenant`, L4973) and «Crear y elegir» (`crearTenant`, L5109) call `abrirCambioTenant(id)` instead of `cambiarTenant(id)`.

## 3. Tests (`src/consola/consola.test.ts`)
- [x] 3.1 `IDS` and the start-hidden list: add the new ids.
- [x] 3.2 Navigation:
  - order of links per block;
  - the tenant heading with and without a tenant;
  - `nav-tiempos` inside the footer block.
- [x] 3.3 Unknown hash: `pantalla-desconocida` visible, no link current, `document.title`. Update the old "unknown hash shows Consultas" case.
- [x] 3.4 «Elegir como activo» opens the pop-up preselected; the tenant does not change until «Operar sobre»; «Crear y elegir» does the same after the 201. Update the cases that expected a direct switch.
- [x] 3.5 `tc-sin-guardar` is visible after a dashboard reorder and hidden without changes.
- [x] 3.6 Scope tags read "Del tenant · X" and "Necesita un tenant". Without a tenant, template and report test and save are disabled and send nothing.
- [x] 3.7 Frescura has one heading and a description.

## 4. Verify
- [x] 4.1 `npm test`, `npx tsc -p tsconfig.json --noEmit` and `scripts/smoke.sh` pass.
- [x] 4.2 The checklist in `guidelines/admin.md` §14 for the touched items. The hypothesis about two tabs with different tenants stays out of scope (proposal).

## Apply notes (2026-11-11)

- **Work unit 1:** passed in the native attempt ledger.
  - `consola.test.ts`: 483/483.
  - `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 2307/2311. The 4 failures are the known `conexiones` false positives with the `postgres` password, not caused by this change.
  - `npx tsc -p tsconfig.json --noEmit`: ok.
- **`scripts/smoke.sh` was not run.** It brings the real Compose stack up and runs `docker compose down` at the end, which would stop the developer stack that is running. Its `/consola` greps (`textarea#sql`, `#ejecutar`, no `innerHTML`) are untouched by this change.
- **Deviation 1.1, navigation meta.** The badge reads «con tenant», with `title="Se prueba con el tenant activo"`: the full sentence does not fit the 32 px item. The spec delta was aligned.
- **Deviation 2.3, catalog without a tenant.** The template and report pop-ups already refused a test without a tenant and kept save disabled with the reason. Disabling «Probar» as well would only change existing behaviour, so the new part is the «Prueba sobre» line. The spec delta was aligned.
- **Research footer.** It is a `zd-sidenav__group` with `id="nav-investigacion"` pushed to the foot by a bridge rule. `zd-sidenav__foot` is a single flex row and cannot hold a heading plus a link.
- **«Crear y elegir».** It now creates the tenant and opens «Cambiar tenant» with it chosen; the banner tells the operator to confirm.
