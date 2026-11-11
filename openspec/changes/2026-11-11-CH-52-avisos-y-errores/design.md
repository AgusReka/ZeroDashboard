# Design: CH-52 — One feedback system and human errors

Inputs: `proposal.md`, `specs/query-console/spec.md`, `src/consola/consola.ts`, `guidelines/admin.md` §7, M4, M5, T7, and `guidelines/lenguaje.md`. No new architecture decision.

## Technical Approach

### 1. The page banner as `zd-banner`
**Server markup.** `<p id="banner" class="banner" role="alert" hidden>` becomes:
```html
<div id="banner" class="zd-banner" role="alert" hidden>
  <div class="zd-banner__body"><p id="banner-texto"></p><p id="banner-detalle" class="zd-mono" hidden></p></div>
</div>
```

**Script.**
- `mostrarBanner(texto, detalle?)` and `mostrarConfirmacion(texto)` set `data-tono` (`error` / `ok`) and the texts. They never set `className`.
- `ocultarBanner()` clears both texts.
- The `.banner` / `.banner.exito` bridge rules are deleted, and the bridge already styles `[data-tono]`.
- **Detail node:** `#banner-detalle` holds the mono technical code.
- **Callers that read the banner:** `banner.textContent` keeps working, because it concatenates the two `<p>`. Tests that read it are updated to read `banner-texto`.

### 2. Feedback inside an open pop-up
One function, `avisar(texto, opciones)`, routes the notice:
```
avisar(texto, { tono, detalle, dialogo?, linea?, junto? })
  if dialogo && dialogo.abierto() → write into its status line (avisarEnDialogo, extended with tone/detail)
  else if junto (a result box id) and its node is not hidden → mostrarResultado(junto, …)
  else → mostrarBanner / mostrarConfirmacion
```
- `llevarBannerA` disappears. Its callers pass `dialogo` and `linea` up front.
- Every pop-up already has its own status line (`*-aviso`), which DEC-173 and CH-32 introduced.

### 3. Errors
`mensajeDeError({ estado, cuerpo, accion, objeto })` returns `{ texto, detalle }`:
- `estado === 0` (network): the network sentence, with no detail.
- 400 or 422: `cuerpo.mensaje` or the existing field-specific sentence, with detail `HTTP {estado}`.
- 403: the permission sentence.
- 404: «No encontramos {objeto}…».
- 409: a lookup in the existing per-code map (`plantilla-en-uso`, `sin-cambios`, `conflicto-de-edicion`, `vista-canonica-no-aprobada`…), falling back to «{Objeto} cambió o está en uso.».
- 5xx: «La consola tuvo un error interno al {accion}…», with detail `HTTP {estado}`.
- `accion` and `objeto` are short Spanish phrases at each call site, e.g. `accion: 'cargar las plantillas'`, `objeto: 'la plantilla'`.

**Call sites.** Every `'No se pudo leer ' + ruta + ' (HTTP ' + …` and similar string is replaced. An apply-time grep for `HTTP ' +`, `(HTTP` and `No se pudo leer` lists them.

**Unchanged.** The execution category messages (`pg-error` categories, the DEC-204 read-only refusal) are not touched.

### 4. Busy buttons
```
function ocupado(boton, gerundio) {
  boton.setAttribute('data-etiqueta', boton.textContent);
  boton.setAttribute('data-deshabilitado', boton.disabled ? '1' : '0');
  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  boton.textContent = gerundio;
}
```
- G3' allows `style` only where already used (one exception at L4839). The width is therefore kept with the CSS rule `button[aria-busy="true"] { min-width: var(--btn-busy-min, 8ch); }`, not with an inline style.
- `ocupado(boton, gerundio)` sets `disabled = true`, `aria-busy="true"` and the gerund text.
- `libre(boton)` restores the label and the previous `disabled`.
- The existing ad hoc "Probando…" and "Cargando…" sites are migrated.

### 5. Copy and zones
- **Voseo:** replace the "usted" strings found by grep (`Verifique|Revise|Escriba|elija|acote|Use un`), and also check imperatives ending in `-e` / `-a` addressed to the operator.
- **M5:** L4474.
- **Zones:**
  - `fechaHoraTenant` (L4950) callers render the column header «Fecha y hora · Hora de tu navegador».
  - The automation date helpers (L2851) render «· Hora del servidor» in their column headers.
  - The headers are server markup where the table head is static. Where it is script-built, the text is set with `textContent`.

## Architecture Decisions

### Decision: One router function for notices
**Choice:** `avisar` decides the place from the open pop-up and the target.
**Alternatives considered:** fixing each call site by hand.
**Rationale:** E1 is a placement rule; one function enforces it everywhere, and the next screens (CH-53 to CH-56) call the same function.

### Decision: Keep `#banner` as the fallback
**Choice:** keep the page banner, now a `zd-banner`, as the last fallback.
**Alternatives considered:** removing the global banner entirely.
**Rationale:** the console spec requires the alert banner in the shell, and messages with no better place (session, tenant fetch) need it.

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `src/consola/consola.ts` | Modify | Banner markup; bridge (`.banner` removed, `button[aria-busy]` added); `mostrarBanner`, `mostrarConfirmacion` and `ocultarBanner`; `avisar`, `mensajeDeError`, `ocupado` and `libre`; `avisarEnDialogo` extended; `llevarBannerA` removed; call sites; copy lines; date headers |
| `src/consola/consola.test.ts` | Modify | Banner reads move to `banner-texto`/`data-tono`; expected strings updated; new cases |

## Interfaces / Contracts
No API change. New guarded ids: `banner-texto`, `banner-detalle`.

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (fake DOM) | Network, 403, 404, 409 fallback and 5xx sentences, with no path in the text. Refusal inside an open pop-up while `#banner` stays hidden. Busy state set and cleared. Voseo hint. Zone labels | Existing harness with stubbed `fetch` answers |
| Structural | No `banner.className =` in the script. Grep guard for the "usted" list | A cheap structural test, like the existing guards |

## Migration / Rollout
None.

## Open Questions
- Unifying the timezone stays a product question (not in scope).
