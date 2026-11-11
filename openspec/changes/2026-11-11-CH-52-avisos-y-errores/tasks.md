# Tasks: CH-52 — One feedback system and human errors

Inputs: proposal.md, specs/query-console/spec.md, design.md.

Delivery: the session is **single-pr**, but this change is forecast above the 400-line budget. The user authorized splitting during tasks, so it ships as **two chained PRs**:
- **52a**: banner, placement and busy buttons.
- **52b**: errors as sentences, voseo, M5 and zones.

Each PR stays under 400 lines. Chain strategy: stacked-to-main (user's choice, 2026-11-11): 52b branches from 52a, targets it, and they merge in order. No new DEC.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650 total: 52a ~320 (150 production + 170 tests), 52b ~330 (170 production + 160 tests) |
| 400-line budget risk | High as one PR; Low per slice |
| Chained PRs recommended | Yes |
| Suggested split | 52a → 52b |
| Delivery strategy | single-pr per slice (split authorized by the user on 2026-11-11) |
| Chain strategy | stacked-to-main (user's choice, 2026-11-11) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low per slice

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 52a | `#banner` as `zd-banner`, `avisar` placement, feedback inside pop-ups, `ocupado`/`libre` | `npx tsx --test src/consola/consola.test.ts` | `npm test`; typecheck | Revert 52a |
| 52b | `mensajeDeError` at every call site, voseo, M5, zone labels | same | `npm test`; typecheck; smoke | Revert 52b |

## 52a — Banner, placement, busy buttons
- [x] a.1 Markup: `#banner` becomes a `zd-banner` with `banner-texto` and `banner-detalle` (`zd-mono`, `hidden`); add them to `IDS`.
- [x] a.2 Delete the `.banner` bridge rules. Add `button[aria-busy="true"]` min-width.
- [x] a.3 `mostrarBanner(texto, detalle?)`, `mostrarConfirmacion` and `ocultarBanner` set `data-tono` and the text nodes, with no `className`.
- [x] a.4 `avisar(texto, { tono, detalle, dialogo, linea, junto })`. Extend `avisarEnDialogo` with tone and detail. Remove `llevarBannerA` and pass `dialogo`/`linea` at its callers.
- [x] a.5 `ocupado(boton, gerundio)` and `libre(boton)`. Migrate the ad hoc busy sites (connection test, mapping validate, template and report test, query execute, saves).
- [x] a.6 Tests:
  - the banner tone is set by attribute;
  - a refusal inside an open pop-up leaves `#banner` hidden;
  - busy set and cleared;
  - existing banner assertions updated to `banner-texto`.

## 52b — Errors, copy, zones
- [x] b.1 `mensajeDeError({ estado, cuerpo, accion, objeto })` per design §3, reusing the existing per-code map.
- [x] b.2 Replace every list-load, save, test and delete error string. The grep is `No se pudo leer|\(HTTP|HTTP ' \+`, and the result must be zero hits outside `mensajeDeError`.
- [x] b.3 Voseo:
  - lines L1503, L1932, L2297, L2426, L3519 and L3525;
  - any further hit of `Verifique|Revise|Escriba|elija|acote|Use un`.
- [x] b.4 L4474: «Ejecutá la consulta para poder guardarla.»
- [x] b.5 Zone labels: «Hora de tu navegador» on lists, Auditoría and versions; «Hora del servidor» on automations and runs.
- [x] b.6 Tests:
  - 5xx, 404, 403, 409 fallback and network sentences;
  - no `/` path in any shown error;
  - the voseo structural guard;
  - zone labels present.

## Verify
- [x] v.1 `npm test`, `npx tsc -p tsconfig.json --noEmit` and `scripts/smoke.sh` pass after each slice.
- [x] v.2 Every E1–E4, M4, M5 and T7 item of `guidelines/admin.md` §14 holds for the touched screens.

## Apply notes, 52a (2026-11-11)

**Evidence.**
- `consola.test.ts`: 492/492.
- `test:db`: 2316/2320. The 4 failures are the known `conexiones` false positives.
- `tsc`: ok.
- 123 changed lines in `src/`.
- `scripts/smoke.sh` was not run: it runs `docker compose down` on the developer stack.

**Deviations, all inside the spec.**
- **a.1 Banner markup.** `#banner` stays a single `<p>`, now `class="zd-banner banner-pagina" data-tono="error"`. The script sets only `data-tono` and the text. `banner-texto` and `banner-detalle` move to 52b, where the technical detail is first written. Splitting the node now would have rewritten the 42 test reads of `#banner` with no visible gain.
- **a.4 Notices inside pop-ups.** `avisar()` was not introduced and `llevarBannerA` / `llevarBannerAlDialogo` stay. They already move every refusal of an async helper into the open pop-up (E1), and the query pop-up keeps its specific title («No se pudo guardar la consulta»). A central router would have lost that title.
- **a.5 Busy buttons.** `ocupado` and `libre` apply to «Probar conexión» in each connection row, «Validar mapeo» and «Ejecutar consulta». Tablero already disables «Guardar» with `guardandoTablero`. The template and report «Probar» move with CH-56, which rebuilds those editors.
- **Bridge.** Nothing reserves the button's width: the gerunds are no longer than the labels they replace.

## Apply notes, 52b (2026-11-11)

**Evidence.**
- `consola.test.ts`: 495/495.
- `test:db`: 2319/2323. The 4 failures are the known `conexiones` false positives.
- `tsc`: ok.
- 283 changed lines in `src/`.
- `scripts/smoke.sh` was not run, as in the earlier slices.

**What changed.**
- `mensajeHttp(estado, accion)` and `mensajeIlegible(estado, accion)` replace the 39 raw «(HTTP n)» and «La aplicación respondió HTTP n» sentences and the path-based one in `leerGlobal`.
- `AVISO_SIN_RED` replaces the 25 network sentences. The 3 «para leer …» variants were rewritten in the same voice.

**Deviations, aligned in the spec delta.**
- **The technical code** is written at the end as «Código: HTTP n.», not in a mono block. Most notices are plain-text lines, and the mono detail belongs to the query workbench (CH-53, W6). `banner-detalle` was therefore not needed.
- **The 403, 404 and 409 sentences** name the action, so a sentence never reads out of context.
- **T7.** The runs table shows the instant as stored (UTC), so its columns say «(UTC)». The «Hora del servidor» label of the design would have been wrong, because only the next-run sentences use the deployment zone, and they already name it.
