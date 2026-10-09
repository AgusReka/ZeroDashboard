# Exploration: CH-30 — Console redesign and missing admin screens (proposed 2026-10-09)

Status: **proposed**, not started. Store: openspec. This exploration decides nothing: the architecture decisions below are the owner's (`AGENTS.md`) and must be registered in `docs/01-decisiones.md` before any code.

## Why

The console grew change by change into one long page. Two problems show in daily use: (1) the **result of running a query appears at the bottom**, below Automatizaciones and Frescura; (2) several administration tasks the API already supports have no screen, so P1 does them with outside tools. The visual style does not feel finished either. A brief for the design tool exists: `docs/design/prompt-claude-design-consola.md`.

## What exists (verified)

| Piece | State |
|---|---|
| `src/consola.ts` | 2,465 lines: markup, one bridge `<style>` and one inline script, served as a TypeScript string. Section order: tenant bar, editor, saved queries (with versions), automations, freshness, then the results table and pager. |
| Calls the page makes | `GET /tenants`; `POST /consultas/ejecutar`; saved queries (list, get, create, edit, versions, restore); `GET /plantillas`; automations (list, create, deactivate, runs); `GET /conexiones` (a dropdown); `PUT /tenants/:id/frescura`. |
| API with no screen | `POST /tenants` and `POST /tenants/:id/baja`; `POST /conexiones` and `POST /conexiones/:id/prueba`; agents (`POST/GET /agentes`, `POST /agentes/:id/revocar`); canonical views (`/conexiones/:id/vistas-canonicas`) and `GET/POST /conexiones/:id/validacion-mapeo`; `GET /contrato`; template create and replace. |
| Test harness | `src/consola.test.ts` runs the **one** script on a fake DOM; guard G3' forbids any shared `zd-*` class inside the script; every id in `IDS` is a contract. `scripts/smoke.sh` checks one document and one script element. |
| Stylesheets | Served from `public/ui/` by exact exempt routes (DEC-124). The pending decision "how interface files are served" was never taken for HTML. |

## Decisions that are not mine to take

1. **How the screens are served.** (a) Keep one document and add in-page navigation (show or hide sections): the smallest step, but the string and the script keep growing. (b) One module and one route per screen (`/consola/consultas`, `/consola/conexiones`, ...) sharing a layout function: real navigation and smaller files, but the harness and the smoke script assume one document. (c) Static HTML and JS files under `public/`: cleanest to edit, but a larger change to exemptions, guards and tests.
2. **Navigation model.** Sidebar sections and which screens are global versus per-tenant, taken from the design output, not invented here.
3. **Where the credential-emitting screens wait.** Agents (token shown once) and, with CH-28, panel users should wait for CH-29.
4. **How to cut it.** One change is too large; the cuts below are a proposal.

## Proposed cuts (not final)

| Cut | Content | Notes |
|---|---|---|
| CH-30a | Shell and navigation; move the results block next to the editor; keep every current section working | The small, low-risk win; can even go before the design output if (1a) is chosen |
| CH-30b | Tenants (list, create, deactivate) and connections (register, test, list) | Credentials are never shown back |
| CH-30c | Agents | After CH-29; the token appears once |
| CH-30d | Mapping and validation of the schema, canonical contract | Largest screens; read-heavy |

## Risks

- A visual redesign touching ids breaks the script and the tests; the brief forbids renaming ids.
- Moving to several documents (1b, 1c) multiplies the fake-DOM harness and the smoke checks.
- The design tool may propose screens outside the inventory: anything beyond it is a product decision, not an implementation detail.

## Size

Not estimated until decision 1 and the design output exist. Each cut should aim at about 300 lines plus tests.

## Next

Run the brief in Claude Design, decide 1 to 4, register them as DEC, then propose, spec, design and tasks for CH-30a first.
