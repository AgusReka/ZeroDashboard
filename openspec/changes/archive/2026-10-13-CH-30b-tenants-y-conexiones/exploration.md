# Exploration: CH-30b — Tenants and Connections screens

Status: **decided** (2026-10-13): DEC-167 (show what the API has; widen `GET /conexiones`; no migration) and DEC-168 (a deactivated tenant cannot be selected; DEC-14 unchanged). Store: openspec. Second cut of CH-30 (DEC-166); umbrella exploration in `openspec/changes/CH-30-rediseno-de-la-consola/`. This exploration decides nothing: the owner's decisions are registered in `docs/01-decisiones.md` before any code.

## Why
Creating and deactivating tenants and registering and testing connections have API but no screen (stories T1, A1): P1 does them with outside tools. They are the first steps of the onboarding path in the design guide (`Tenants › alta` → `Conexiones › nueva conexión › probar`).

## What exists (verified)

| Piece | State |
|---|---|
| `POST /tenants`, `POST /tenants/:id/baja` | Exist; global (exempt from the tenant header). |
| `GET /tenants` | Active tenants by default; `?incluirInactivos=true` lists the deactivated ones too. Fields: `id`, `nombre`, `activo`, `creadoEn`, the two freshness declarations. **No date of baja, no counts.** |
| `POST /conexiones`, `POST /conexiones/:id/prueba` | Exist; tenant-scoped. The test answers `resultado`, `categoria`, `codigo`, `host`, `puerto`, `duracionMs` and **is not stored anywhere**. |
| `GET /conexiones` | Tenant-scoped, capped; answers **only `id` and `nombre`** (built for CH-21c's picker). |
| Deactivated tenant | Every scoped request for it is refused with `409 tenant-desactivado` (DEC-14): nothing of it can be read. |
| Design guide | C-02 Tenants and C-05 Conexiones (`guidelines/consola.md`): the fields above plus `baja` date, per-tenant counts, and each connection's last test (when, latency, visible tables, error, SQLSTATE); a frozen read-only state when the active tenant is deactivated. |

## Decisions that are not mine to take

1. **Data the guide shows and the API does not have.** (a) Show what exists, widen `GET /conexiones` to the public connection fields, and show a test's result only right after running it; no date of baja, no counts, no stored last test. (b) Also store each connection's last test (a migration) and add counts and the baja date to the tenant listing.
2. **A deactivated tenant as the active one.** (a) Keep it as today: a deactivated tenant cannot be selected; the Tenants screen lists it as "Dado de baja" and the selector only offers active ones. (b) Allow selecting it read-only, which requires changing DEC-14's refusal of every request for a deactivated tenant.

## Proposed shape once decided (not final)
- Global screen **Tenants** (`#tenants`): list with state, "Nuevo tenant" dialog, "Elegir como activo", "Dar de baja" with confirmation.
- Tenant screen **Conexiones** (`#conexiones`): list, "Nueva conexión" side panel ("Guardar y probar"), "Probar" per row with its result next to the button; the password is never shown back.
- Navigation: a "Global" group with Tenants and a "Puesta en marcha" group with Conexiones (DEC-165 order).
- Size: ~500–700 lines with tests; two chained PRs.
