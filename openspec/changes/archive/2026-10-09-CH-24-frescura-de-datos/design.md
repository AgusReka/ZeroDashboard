# Design: CH-24 — Data freshness per tenant and per template

Decisions: DEC-142 (declare and show), DEC-143 (the implementer declares the last refresh), DEC-144 (window on the tenant), DEC-145 (route and contract). No new architecture decision is introduced here.

## 1. Modules

| File | Role |
|---|---|
| `prisma/schema.prisma` + new migration | Two nullable columns on `Tenant` |
| `src/frescura.ts` (new) | Pure: `evaluarFrescura`, `resolverFrescura`, the limits |
| `src/tenants.ts` | `TenantPublico` gains the two fields; new `PUT /tenants/:id/frescura` |
| `src/consola.ts` | New section "Frescura de datos" (markup + script) |
| `src/planificador.test.ts` | One case: a stale window does not change a run |

`src/generated/prisma` is gitignored: the client is regenerated with `npm run prisma:generate` after the schema change (and by the Docker build).

## 2. Schema and migration

```sql
ALTER TABLE "Tenant" ADD COLUMN "ventanaDesactualizacionMinutos" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN "replicaActualizadaEn" TIMESTAMP(3);
```

Both nullable with no default (null means "sin declarar", DEC-143/144). The range is checked in the application, as for `Plantilla.toleranciaFrescuraMinutos`. Migration name follows the existing pattern, `2026100800000N_tenant_frescura`, dated after `20261006000000_usuario_sesion_panel`.

## 3. Pure layer (`src/frescura.ts`)

- `LIMITE_VENTANA_MINUTOS = 525600` (one year; keeps absurd values out).
- `evaluarFrescura(ventana: number | null, tolerancia: number): 'sin-declarar' | 'al-dia' | 'desactualizada'`: null gives `sin-declarar`; `ventana > tolerancia` gives `desactualizada`; otherwise `al-dia`.
- `resolverFrescura(cuerpo: { ventanaMinutos?: unknown; actualizadaAhora?: unknown }, ahora: Date)`: returns `{ ok: true, datos: { ventanaDesactualizacionMinutos?: number | null; replicaActualizadaEn?: Date } }` or `{ ok: false, campos: string[] }`.
  - `ventanaMinutos`: `null`, or an integer (`Number.isInteger`) from 0 to the limit; anything else (string, decimal, negative, boolean, object) names `ventanaMinutos`.
  - `actualizadaAhora`: strictly `typeof boolean`; `true` sets `replicaActualizadaEn: ahora`, `false` sets nothing; a non-boolean names `actualizadaAhora`.
  - A body with neither key is `{ ok: false, campos: [] }`.
  - `ahora` is injected, so the "server clock" rule is testable.

## 4. Route (`src/tenants.ts`)

Strict schema, same shape as `registroTenantSchema` and the CH-23 lesson: `additionalProperties: false`, `minProperties: 1`, `propertyNames: { enum: ['ventanaMinutos', 'actualizadaAhora'] }`, and **both properties declared with an empty schema** (`{}`): they must be listed or `removeAdditional` strips them silently, and they carry no `type` so AJV cannot coerce `"5"` into `5` or `"true"` into `true`. Type checking is `resolverFrescura`'s job.

Flow: validation (400 `solicitud-invalida` with `campos`), `findUnique` on `TenantPublico` (404 `tenant-no-encontrado`), `activo` false gives 409 `tenant-desactivado` (the `baja` route's answer), `resolverFrescura(body, new Date())` (400), one `update` with the returned columns, answer `200 { tenant }`. The route is under the `/tenants/` prefix, already exempt from `X-Tenant-Id` (`src/contexto-tenant.ts:194`), so no exemption row changes; the tenant is named by the path, the console's explicit-tenant pattern (DEC-15).

`TenantPublico` adds `ventanaDesactualizacionMinutos` and `replicaActualizadaEn`, so `POST /tenants`, `GET /tenants` and `POST /tenants/:id/baja` carry them too (additive). Existing tests that assert the exact key set of a tenant are updated.

## 5. Console (`src/consola.ts`)

Markup, a new `<section id="frescura">` after `#automatizaciones`: heading "Frescura de datos"; a help line; two readouts (`#fresc-ventana`, `#fresc-actualizada`); a number input `#fresc-minutos` (`min="0"`, `max="525600"`, `step="1"`) with "Guardar ventana"; "Marcar réplica actualizada ahora"; `#fresc-aviso` for messages; and a table `#fresc-plantillas` (Plantilla, Tolerancia en minutos, Estado). Every control is `type="button"` outside `#formulario`, like the other sections.

Script:
- `cargarTenants` keeps the rows it received (a map by id) so the active tenant's window and refresh are known without another call; `fijarTenant` ends by calling `mostrarFrescura()`.
- `GET /plantillas` (global, already carries `toleranciaFrescuraMinutos`) is read when the section needs it and cached for the page's life; the wizard's own catalog keeps its own copy.
- `estadoFrescura(ventana, tolerancia)` is the client twin of `evaluarFrescura`; both are pinned by the same vectors (DEC-129 precedent: the tests carry the table in each file).
- `hace(iso, ahoraMs)`: "hace unos segundos" under 60 s, "hace N min", "hace H h M min" (minutes omitted at 0), "hace N d"; a future instant reads "hace unos segundos" (clock skew), never a negative.
- State uses icon and text, never color alone: `circle-check` "Al día", `triangle-alert` "Desactualizada", `circle-help`-style neutral text "Sin declarar".
- Saving builds the body from what the operator chose (`{ ventanaMinutos }` or `{ actualizadaAhora: true }`) and calls plain `fetch('/tenants/<id>/frescura', { method: 'PUT', ... })` with only `Content-Type`; this route is exempt from the tenant header, like `GET /tenants`, so it does not go through `pedir()`. A 404 or 409 goes through `manejarFalloDeTenant` (it already reloads the tenant list); a 400 shows "La ventana tiene que ser un número entero de minutos, entre 0 y 525600." in `#fresc-aviso`; on 200 the cached row is replaced by `cuerpo.tenant` and the section is redrawn. With no active tenant the section says "Elegí un tenant para ver su frescura." and the controls are disabled.
- Values reach the DOM as `textContent` only (rule 7, the stored-input discipline of the file). Console copy may use technical words (tenant, réplica).

## 6. Tests

- `frescura.test.ts` (pure): vectors, bounds, every rejected type, the injected clock, empty body.
- `tenants-frescura.test.ts` (live database): 200 per scenario, only the sent fields change, 400s with nothing stored, 404, 409, another tenant untouched, the new fields on `POST`/`GET /tenants`.
- `consola.test.ts`: section strings, badge per vector, relative-time cases, exact request bodies, 400/409 handling, no active tenant.
- `planificador.test.ts`: a tenant with window 1000 and a template with tolerance 10 still runs and is recorded normally.

## 7. Trade-offs

- The comparison exists twice (server helper for tests and future use, console for display): accepted in DEC-145, pinned by shared vectors.
- `replicaActualizadaEn` is a declaration, not a measurement (DEC-143); the heartbeat of CH-19d1 can replace it later without changing the read contract.
- A tenant with replicas of different pace declares the worst one (DEC-144).

## 8. Size forecast

Production: ~120 server lines (helper, route, migration, schema) and ~170 console lines. With tests x1.7, about 590 in all, so two chained PRs (server, then console), as in `tasks.md`.
