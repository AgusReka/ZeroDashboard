# Design: CH-33 — Adjusting an automation from the console, and a typed confirmation for a tenant's baja

Inputs: proposal.md, the three spec deltas (`automation-scheduling`, `tenant-management`, `query-console`), DEC-174 (with its CH-33 precision), DEC-175, DEC-79, DEC-82, DEC-138, DEC-173, the alta route (`src/automatizaciones-rutas.ts:114-192`), the panel adjust (`src/panel-ajustes.ts`), the wizard (`src/consola.ts:640-730`, `:1960-2035`, `:2251-2275`, `:2459-2506`), the baja (`src/tenants.ts:141-167`, `src/consola.ts:3455-3518`), the pop-up factory (`src/consola.ts:1020-1060`) and the design guide (`lenguaje.md:28`: a destructive confirmation repeats action and object, never "Sí").

## 1. Adjust route (`src/automatizaciones-rutas.ts`)

### 1.1 Pure resolver

```ts
/** The adjust body as the route hands it over: only the three keys, values still untrusted. */
export interface CuerpoAjusteOperador {
  valores?: Record<string, unknown>;
  cron?: string;
  destinatario?: string | null;
}

export type ResolucionAjusteOperador =
  | { ok: true; datos: { valores?: Record<string, unknown>; cron?: string; destinatario?: string | null } }
  | { ok: false; campos: string[]; problemas?: Problema[] };

export function resolverAjusteOperador(
  cuerpo: CuerpoAjusteOperador,
  plantilla: { sql: string; parametros: unknown },
  zona: string,
): ResolucionAjusteOperador
```

- Checks, in this order, and collects **every** offender before answering (as `resolverAjustes` does): `cron` with `cronValido(cron, zona)` → `/cron`; `destinatario`: `null` passes as `null`, a string goes through `destinatarioDe` + `direccionValida` → `/destinatario`; `valores` through `prepararSentencia(sanearSql(plantilla.sql), plantilla.parametros, valores)` → one field per distinct `problema.campo`, with `problemas` passed through as the alta does.
- Field names keep the alta's JSON-pointer form (`/cron`, `/destinatario`, `/valores/...`) so the console's existing 400 handling (`crearAutomatizacion`, `mensajeDeSolicitudInvalida`) reads them unchanged. The panel's business names are client copy and do not apply here.
- No stored-row input: `valores` replaces the map as a whole, so nothing is merged and the stored row is not needed to validate. The template comes from the stored row's `plantillaId`.

### 1.2 Schema

```ts
const ajusteOperadorSchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  propertyNames: { enum: ['valores', 'cron', 'destinatario'] },
  properties: {
    valores: { type: 'object' },
    cron: { type: 'string', minLength: 1 },
    destinatario: { type: ['string', 'null'], maxLength: 254 },
  },
} as const;
```

`valores` is a container only (no inner types), as in the alta, so AJV cannot coerce a value (DEC-60). No `default` on `valores`: an absent key must stay absent, or `minProperties` would never fail and every adjust would rewrite the map. `maxLength` applies to strings only, so `null` passes.

### 1.3 Handler: `PUT /automatizaciones/:id/ajustes`

1. `validationError` → `400 { error: 'solicitud-invalida', campos }` (`camposInvalidos`).
2. Scoped `findUnique({ where: { id }, select: { activo: true, plantillaId: true } })` → `null`: `404 automatizacion-no-encontrada`; `!activo`: `409 automatizacion-desactivada`.
3. Global `plantilla.findUnique` by the row's `plantillaId` (DEC-61; id comes from a scoped row). `null` (impossible under the FK, defensive) → `404 plantilla-no-encontrada`.
4. `resolverAjusteOperador` → `400 { error: 'solicitud-invalida', campos, problemas? }`.
5. Scoped `update` with only the returned columns, `select: AutomatizacionCompleta`; `P2025` → `404` (row vanished between read and write, as in the panel).
6. `200 { automatizacion, proximaEjecucion, zonaHoraria }`; `proximaEjecucion` from the stored `cron` and `new Date()`, guarded like the panel's `proximaIso` (a stored cron that no longer resolves → `null`).

The route is not exempt from `x-tenant-id`. The module's header comment changes from "no edit" to "adjust in place (DEC-174); no delete, no reactivation".

## 2. Baja (`src/tenants.ts`)

```ts
interface BajaTenantBody { nombre: string; }

const bajaTenantSchema = {
  type: 'object',
  additionalProperties: false,
  propertyNames: { enum: ['nombre'] },
  required: ['nombre'],
  properties: { nombre: { type: 'string' } },
} as const;
```

- No `minLength`: an empty string is a valid *shape* that simply does not match any name (tenant names have `minLength: 1`), so it answers `409 confirmacion-no-coincide`, the same as any other wrong name.
- Order: schema `400` → read (`404`, `409 tenant-desactivado`) → `request.body.nombre !== tenant.nombre` → `409 { error: 'confirmacion-no-coincide' }` → `update` + `cerrarTenant`. The name is compared after the existence check, so the endpoint reveals nothing it did not already reveal.
- A missing body: Fastify hands `undefined` to a body schema with `required`, which fails validation → `400`. A test covers it explicitly (no `Content-Type`, no payload).

## 3. Console: «Ajustar»

### 3.1 Markup (inside `#automatizaciones`, after `#auto-alta`)

```
div#auto-ajuste.zd-dialog-backdrop[hidden]
  div.zd-dialog.zd-form[role=dialog][aria-modal=true][aria-labelledby=aj-titulo]
    h2#aj-titulo.zd-dialog__title            «Ajustar automatización»
    p#aj-resumen.ayuda                        "Plantilla: … · Conexión: …" (text, script-filled)
    div#aj-valores                            one rotular(nombre, controlDeValor(tipo)) per parameter
    .zd-form-row: select#aj-frecuencia (same four options), input#aj-hora[type=time]
    p#aj-horario-texto.ayuda
    label + input#aj-cron.zd-input.zd-input--code[readonly]
    label + input#aj-destinatario.zd-input[type=email]   «Correo del destinatario (opcional; vacío: no se envía correo)»
    p#aj-aviso.ayuda[role=status]
    .zd-dialog__actions
      span#aj-confirmar[hidden] «Hay cambios sin guardar.» button#aj-descartar, button#aj-seguir
      button#aj-guardar.zd-btn.zd-btn--primary «Guardar ajustes»
      button#aj-cancelar.zd-btn.zd-btn--ghost «Cancelar»
```

The title is generic text in the markup; the template name goes in `#aj-resumen` (the spec's "titled with the template's name" is met by the first line under the title, avoiding script-written headings). All new ids go to `IDS`; `auto-ajuste` and `aj-confirmar` to `IDS_OCULTOS`. The wizard's recipient label and the section help (`:643`, `:703`) are rewritten: «… Se puede ajustar sin perder su historial; para cambiar la plantilla o la conexión, se desactiva y se crea otra.» and «Correo del destinatario (opcional)».

### 3.2 Schedule controls, shared

`actualizarHorario()` today reads the wizard's globals. It becomes `actualizarHorarioDe(c)` over a controls object `c = { frecuencia, hora, cron, texto }`, with `HORARIO_ALTA` and `HORARIO_AJUSTE` instances; the wizard keeps calling `actualizarHorario()` as a thin wrapper, so its tests do not change. A new `presetDeCron(cron)` returns `{ frecuencia, hora: 'HH:MM' }` or `null`, and `horarioEnPalabras` is rebuilt on it (one parser, two outputs).

### 3.3 Flow

- **Opening** (`abrirAjuste(fila)`): generation counter `generacionAjuste` (as `generacionAlta`), `pedirAutomatizacion('/automatizaciones/' + id)`; then the template detail through the existing `detallesPlantilla` cache or `GET /plantillas/:id`. Either failing: banner, nothing opens. Then fill: `#aj-resumen` with `nombresPlantilla` and `nombreDeConexion`; one control per **currently declared** parameter (`elegirPlantilla`'s loop, extracted as `construirValores(contenedor, parametros)` → entries), each prefilled from the stored `valores` (`String(valor)`; booleans select `'true'`/`'false'`; a stored key no longer declared is dropped; a declared key with no stored value stays blank); schedule via `presetDeCron` (preset → frequency + hour; otherwise «Personalizado» and the raw cron); recipient (`''` for `null`). A snapshot `{ valores: JSON of valoresDe(...), cron, destinatario }` is kept as the baseline. Then `dialogoAjuste.abrir()` (focus on the first parameter control, or `#aj-frecuencia` when there is none — `primerCampo` is resolved in `alAbrir`).
- **Dirty**: the current snapshot differs from the baseline. Feeds `crearDialogo`'s `hayCambios`.
- **Saving** (`guardarAjuste`): rebuild a preset cron from the hour (invalid hour → message inside, nothing sent, as the wizard). Body = only the keys whose snapshot differs: `valores` (the whole `valoresDe` map), `cron`, `destinatario` (trimmed; `''` → `null`). Empty body → «No hay cambios para guardar.» inside, nothing sent. `PUT` through `pedirAutomatizacion`. `null` → `llevarBannerA`; `400` → inside, `/cron` and `/destinatario` with the wizard's sentences, otherwise `mensajeDeSolicitudInvalida`; other non-200 → `textoDeRechazo` inside; `200` → close, `mostrarConfirmacion(confirmacionDeAjuste(cuerpo))` («Se guardaron los ajustes. Próxima ejecución programada: … , zona horaria …»; without those fields, the first sentence alone), `listarAutomatizaciones()`. A `409 automatizacion-desactivada` also reloads the list after showing the message.
- **Row**: `listarAutomatizaciones` adds `boton('Ajustar', 'ajustar', …)` before «Desactivar» for active rows. A console rule spaces it like `.ver-ejecuciones + .desactivar`.
- A tenant switch closes it (it is registered in `dialogos`) and bumps `generacionAjuste` so a late answer is dropped.

## 4. Console: baja pop-up

### 4.1 Markup (Tenants screen, after `#tenant-dialogo`)

```
div#tenant-baja.zd-dialog-backdrop[hidden]
  div.zd-dialog[role=dialog][aria-modal=true][aria-labelledby=tb-titulo]
    h2#tb-titulo.zd-dialog__title     «Dar de baja un tenant»
    p#tb-texto                        script-filled: «Vas a dar de baja «{nombre}». No se puede deshacer: …»
    label[for=tb-nombre] «Escribí el nombre del tenant para confirmar»
    input#tb-nombre.zd-input[autocomplete=off][spellcheck=false]
    p#tb-aviso.ayuda[role=status]
    .zd-dialog__actions
      span#tb-confirmar[hidden] (unused strip; crearDialogo requires it — see 4.2)
      button#tb-dar-de-baja.zd-btn.zd-btn--danger[disabled]   «Dar de baja {nombre}» (text set by script)
      button#tb-cancelar.zd-btn.zd-btn--ghost «Cancelar»
```

`zd-btn--danger` is in the shared sheet (checked in apply; if absent, `--primary`, never a new token). `tenant-baja` and `tb-confirmar` go to `IDS_OCULTOS`.

### 4.2 Flow

- «Dar de baja» in the row calls `abrirBaja(tenant)`: stores the tenant, writes the sentence and the button text with `textContent`, empties the field, disables the button, opens. `crearDialogo` with `hayCambios: () => false` (closing a confirmation never asks; the strip stays hidden forever, kept only to reuse the factory as is).
- `input` on `#tb-nombre`: `boton.disabled = campo.value !== tenant.nombre` (exact, no trim).
- Click: guard again on equality, then `fetch('/tenants/' + id + '/baja', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: campo.value }) })`. `200`: close, then today's `darDeBaja` tail (active tenant → none + banner; reload both lists). `409 confirmacion-no-coincide`: «El nombre no coincide con el del tenant. No se dio de baja.» inside; other status: today's sentence, inside.
- `accionesTenant` loses the inline swap: «Dar de baja» opens the pop-up directly.

## 5. Callers of the baja

`src/tenants.test.ts` (9 calls), `src/contexto-tenant.test.ts:531`, `scripts/smoke.sh:565` send the name. A small test helper `bajaDe(app, tenant)` in `tenants.test.ts` keeps the calls short.

## 6. Tests

| Where | What |
|---|---|
| `automatizaciones-rutas.test.ts`, header/shape block (no DB) | `resolverAjusteOperador` units: each field ok/bad, several offenders named together, `null` recipient, CRLF recipient refused, `valores` replaced not merged. Schema: `{}`, `plantillaId`/`conexionId`/`activo`/`tenantId` → 400. |
| same file, DB block | Adjust keeps id and runs; only sent columns change; `proximaEjecucion` matches new cron; `404` unknown; `409` deactivated; `P2025` path not required. |
| `aislamiento.test.ts:455` | `PUT /automatizaciones/:id/ajustes` joins the sweep: foreign id → 404, B's row untouched. |
| `tenants.test.ts` | Existing calls send the name. New: wrong case, trailing space, empty string → 409 and tenant still active and `cerrarTenant` not called; no body, `{}`, extra key → 400; unknown id with a name → 404; inactive with right name → `409 tenant-desactivado`. |
| `consola.test.ts` | «Ajustar» only on active rows; opens prefilled (preset and custom cron, boolean, missing stored value, stale stored key dropped); body has only changed keys; empty recipient → `null`; no changes → nothing sent; 400 and 409 inside; Cancelar/Escape with and without changes; tenant switch closes; failed read opens nothing. Baja: button disabled until exact name (case and trailing space), body `{ nombre }`, 409 inside, Cancelar/Escape send nothing and never ask, active tenant baja path. The two CH-30b inline tests (`:3140-3170`) are rewritten for the pop-up. |

## 7. Size and slicing

Estimated: route + resolver ~130, its tests ~220; baja ~25, its tests and callers ~90; console ~260 (markup ~45, horario refactor ~30, ajuste ~150, baja ~35), console tests ~380; specs/docs (planning, already written) ~300. Code and tests ≈ 1100: over the 400-line budget. Natural slices: **(1)** baja API + console + callers (~300); **(2)** adjust route + tests + sweep (~350); **(3)** console «Ajustar» + tests (~450). The decision is taken at the tasks gate.
