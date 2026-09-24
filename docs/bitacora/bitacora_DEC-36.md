# Bitácora — DEC-36: `producto.activo` obligatorio; `stock-producible` fuera de `producto.stockDisponible`

**Fecha:** 2026-09-24.
**Decisión:** DEC-36 (`docs/01-decisiones.md`), tomada por el autor el 2026-09-24. El agente la transcribió y la aplicó; no la decidió.
**Alcance:** contrato y tests. No se modificó ninguna consulta SQL ni ninguna base de datos.

> Numeración: el encargo original pedía DEC-30, pero ese número ya lo usa "Mapeo por tenant (CH-09)", y DEC-31 a DEC-35 dependen de él. Por indicación del autor, la decisión se registró como DEC-36.

---

## Problema

- `openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql` (la implementación de `stock-producible`) filtra `WHERE pr.activo = true`, pero el contrato declaraba `producto.activo` como `opcional`. Si una plataforma no lo puebla, la vista lo deja en `NULL` y la consulta devuelve cero filas sin error.
- El contrato declaraba que `stock-producible` usa `producto.stockDisponible`, pero la consulta no lo lee: solo lee `insumo."stockDisponible"`.

## Cambios

| Archivo | Cambio |
|---|---|
| `docs/01-decisiones.md` | Se agregó DEC-36 después de DEC-35 (contexto, opciones, decisión, por qué, se resigna, decidido por, estado). Opción descartada: `COALESCE(pr.activo, true)` en la consulta. |
| `src/contrato.ts` | `producto.activo`: `opcional` → `obligatorio`, con el comentario actualizado. `producto.stockDisponible`: se quitó `STOCK_PRODUCIBLE` de `automatizaciones` (queda `STOCK_FISICO`, `REPORTE_DIARIO`), con el comentario actualizado. |
| `src/contrato.test.ts` | Prueba 1.4: `activo` pasó de la lista de campos opcionales de `producto` a la de obligatorios. |
| `src/contrato-rutas.test.ts` | La proyección de `GET /contrato` ahora espera `['stock-fisico', 'reporte-diario']` para `producto.stockDisponible`. |

Sin cambios en: cualquier `.sql`, `prisma/`, bases de datos.

La entidad `producto` sigue nombrando `stock-producible` a través de `id`, `nombre` y `activo`, así que las pruebas 1.3 (automatizaciones por entidad) no cambiaron.

## Salida de los tests

Comando: `npm test` (suite completa). Código de salida: 0. **149 pruebas, 149 pasan, 0 fallan.**

Salvedad: 8 suites de integración contra PostgreSQL se saltearon porque no había un servidor en `localhost:5432` (las líneas `﹣` de abajo). Ninguna prueba el contrato: las pruebas del contrato (`contrato.test.ts`, `contrato-rutas.test.ts`) no necesitan base y corrieron todas.

```

> zerodashboard-console@0.1.0 test
> tsx --test src/**/*.test.ts

﹣ aislamiento entre tenants — integration against a live PostgreSQL target (0.7778ms) # no PostgreSQL server at localhost:5432 — bring up the Compose db service and set TEST_DB_* (see this file's header)
▶ aplicarAlcance — the closed operation map
  ✔ create receives tenantId, overwriting anything supplied (1.7911ms)
  ✔ createMany receives tenantId on every entry, preserving the shape (0.4089ms)
  ✔ a filter operation is AND-wrapped, never spread (0.3104ms)
  ✔ a caller's tenantId or OR cannot displace the injected predicate (0.2641ms)
  ✔ a unique selector gains tenantId, overwriting a supplied one (0.2177ms)
  ✔ an unlisted operation throws instead of passing through (0.7129ms)
  ✔ the caller’s args object is never mutated (0.2805ms)
✔ aplicarAlcance — the closed operation map (5.1209ms)
﹣ destinoDeConexion — the single credential-bearing read (1.5563ms) # no PostgreSQL server at localhost:5432 — bring up the Compose db service and set TEST_DB_* (see src/conexiones.test.ts's header)
﹣ conexion routes — integration against a live PostgreSQL target (1.1983ms) # no PostgreSQL server at localhost:5432 — bring up the Compose db service and set TEST_DB_* (see this file's header)
▶ loadConfig — fail-closed master key validation at boot (DEC-17)
  ✔ a valid 32-byte base64 key lets the configuration load (2.8627ms)
  ✔ the loaded configuration never carries the master key (0.9776ms)
  ✔ an unset master key refuses the boot (1.268ms)
  ✔ an empty master key refuses the boot, exactly as an absent one does (0.7846ms)
  ✔ a master key that is not valid base64 refuses the boot (0.8498ms)
  ✔ a master key that decodes to fewer than 32 bytes refuses the boot (0.8691ms)
  ✔ a master key that decodes to more than 32 bytes refuses the boot (0.7514ms)
  ✔ the refusal never quotes the offending key value (0.7731ms)
✔ loadConfig — fail-closed master key validation at boot (DEC-17) (11.9896ms)
▶ loadConfig — the timeout budgets keep their CH-03/CH-04 behaviour
  ✔ both budgets fall back to their defaults when unset (0.8768ms)
  ✔ a configured budget is read from the environment (0.6218ms)
  ✔ a non-positive-integer budget is a configuration error, not a silent fallback (0.6392ms)
✔ loadConfig — the timeout budgets keep their CH-03/CH-04 behaviour (2.5873ms)
▶ loadConfig — the row cap is configuration, not a source literal (DEC-19)
  ✔ maxFilasPorConsulta defaults to 200 when MAX_FILAS_CONSULTA is unset (0.6217ms)
  ✔ MAX_FILAS_CONSULTA overrides the default without a source change (0.4174ms)
  ✔ an empty MAX_FILAS_CONSULTA falls back to the default (0.4522ms)
  ✔ the cap is global: it is read once from the environment, not per connection (0.5238ms)
  ✔ MAX_FILAS_CONSULTA=0 is a configuration error, not a silent fallback (0.5122ms)
  ✔ MAX_FILAS_CONSULTA=-1 is a configuration error, not a silent fallback (0.3657ms)
  ✔ MAX_FILAS_CONSULTA=12.5 is a configuration error, not a silent fallback (0.3835ms)
  ✔ MAX_FILAS_CONSULTA=muchas is a configuration error, not a silent fallback (0.3734ms)
✔ loadConfig — the row cap is configuration, not a source literal (DEC-19) (4.2781ms)
▶ the console document, served by the real route
  ✔ exactly one script element, and no markup-assigning property anywhere (1.535ms)
  ✔ the row-per-page input carries no upper bound of its own (CH-07) (0.6056ms)
  ✔ the credencial-ilegible message exists and never names key material (0.2741ms)
  ✔ the console boots with a tenant and sends the header on a scoped call (11.8301ms)
  ✔ a capped result states the cap and names the configured number (11.7471ms)
  ✔ a capped result leaves the next-page control disabled, hayMas notwithstanding (1.2204ms)
  ✔ the cut sentence is a distinct node, and never sits beside "Hay más resultados." (1.4887ms)
  ✔ an ordinary paginated result keeps CH-04 behaviour exactly (1.0712ms)
  ✔ a capped result followed by an uncut one drops the cut sentence (1.4618ms)
  ✔ a credencial-ilegible refusal is explained, and the table is cleared (1.2761ms)
  ✔ the console can ask for a page above the old 200 ceiling (1.231ms)
✔ the console document, served by the real route (500.3884ms)
▶ classifyExecutionError — classification rows
  ✔ row 1: the backstop rejection value is not classified as a timeout here (16.6501ms)
  ✔ row 2: SQLSTATE 57014 is the server-side statement_timeout (0.3574ms)
  ✔ row 3: SQLSTATE 25006 is a write refused by the read-only transaction (0.6658ms)
  ✔ row 3: SQLSTATE 0A000 is also "not a read", not the unknown fallback (0.5146ms)
  ✔ row 4: SQLSTATE 42501 is insufficient privilege, not a syntax error (0.3882ms)
  ✔ row 5: any other class 42 (42601) is a syntax error (0.3082ms)
  ✔ row 5: any other class 42 (42P01) is a syntax error (0.3649ms)
  ✔ row 5: any other class 42 (42703) is a syntax error (0.2946ms)
  ✔ row 6: any class 22 (22012) is a data exception (0.577ms)
  ✔ row 6: any class 22 (22P02) is a data exception (22.5065ms)
  ✔ row 7: an unrelated SQLSTATE falls back to the generic category (0.3592ms)
  ✔ row 7: a non-Error throw is classified without a codigo (0.2024ms)
  ✔ row 7: null is classified without a codigo (6.4664ms)
✔ classifyExecutionError — classification rows (57.083ms)
▶ classifyExecutionError — codigo allowlist
  ✔ an error with no code at all yields codigo: null (0.6502ms)
  ✔ a free-text code does not match the allowlist and yields codigo: null (0.2599ms)
  ✔ a numeric code is not read as a codigo (0.168ms)
  ✔ a Node socket code reaching the execution phase keeps its shape (1.2332ms)
✔ classifyExecutionError — codigo allowlist (2.6978ms)
▶ sanearSql — plain trimming, never parsing
  ✔ a trailing semicolon is stripped (0.5353ms)
  ✔ a trailing semicolon followed by whitespace is stripped (0.2184ms)
  ✔ exactly one semicolon is stripped, so a doubled one stays invalid (0.1724ms)
  ✔ a statement without a semicolon is only trimmed (0.1628ms)
  ✔ whitespace-only input collapses to the empty string (0.1727ms)
  ✔ an interior semicolon is left untouched — no statement splitting happens here (0.2074ms)
✔ sanearSql — plain trimming, never parsing (2.0793ms)
▶ limiteEfectivoDe — the clamp, and only the clamp
  ✔ a requested page under the cap is served as requested (0.3521ms)
  ✔ a requested page equal to the cap is served as requested (0.1955ms)
  ✔ a requested page above the cap is clamped down to the cap (0.1824ms)
  ✔ a cap configured lower than the default clamps a default-sized page (0.1835ms)
✔ limiteEfectivoDe — the clamp, and only the clamp (1.3565ms)
▶ corteDeEjecucion — the cap verdict is not the pagination signal (DEC-18)
  ✔ no clamp and no further rows: nothing was cut (0.2834ms)
  ✔ no clamp but further rows exist: ordinary pagination, not a cut (0.1827ms)
  ✔ clamped and further rows exist: the cap cut the result (0.1635ms)
  ✔ clamped but no further rows: the operator saw everything, so no cut (0.1582ms)
  ✔ a page exactly at the cap with nothing beyond it is not a cut (0.1541ms)
  ✔ the verdict is independent of hayMas in both directions (0.1487ms)
✔ corteDeEjecucion — the cap verdict is not the pagination signal (DEC-18) (1.5615ms)
▶ classifyExecutionError — credential safety
  ✔ a credential-bearing error yields a summary with neither password nor stack (0.6059ms)
✔ classifyExecutionError — credential safety (0.8349ms)
﹣ consulta guardada routes — integration against a live PostgreSQL target (0.9444ms) # no PostgreSQL server at localhost:5432 — bring up the Compose db service and set TEST_DB_* (see this file's header)
﹣ consulta routes — integration against a live PostgreSQL target (9.6527ms) # no PostgreSQL server at localhost:5432 — bring up the Compose db service and set TEST_DB_* (see this file's header)
▶ contexto de tenant — the store fails closed outside a request
  ✔ exigirTenantActivo() outside conTenantActivo() throws ErrorSinTenantActivo (1.2127ms)
  ✔ tenantActivoOpcional() reports the absence instead of throwing (0.2093ms)
  ✔ conTenantActivo() makes the tenant visible to everything it runs (3.8026ms)
  ✔ a nested conTenantActivo() shadows the outer tenant and then restores it (0.4419ms)
✔ contexto de tenant — the store fails closed outside a request (7.2468ms)
▶ contexto de tenant — GET /contrato es exento del encabezado (CH-08, DEC-24)
  ✔ 3.1 GET /contrato answers headerless (26.9748ms)
  ✔ 3.1 GET /contrato answers 200 with a header naming a nonexistent tenant (1.4216ms)
  ✔ 3.2 both answers are byte-for-byte the same body (1.8318ms)
  ✔ 3.3 /contrato-falso with no header is refused, never let through as exempt (2.2342ms)
  ✔ 3.4 POST /contrato with no header is refused: non-GET inherits no exemption (1.1929ms)
✔ contexto de tenant — GET /contrato es exento del encabezado (CH-08, DEC-24) (265.969ms)
﹣ contexto de tenant — hook envelopes and exemptions against a live PostgreSQL target (0.0866ms) # no PostgreSQL server at localhost:5432 — bring up the Compose db service and set TEST_DB_* (see this file's header)
▶ GET /contrato — the read-only projection of the static catalog
  ✔ 2.1 answers 200 with { contrato: { entidades } } equal to CONTRATO_CANONICO (35.685ms)
  ✔ 2.2 lists the five entities, each marked, with every field marked and traced (1.7269ms)
  ✔ 2.2 producto arrives with its marks and labels intact over the wire (1.2549ms)
  ✔ 2.3 no method other than GET is routed on /contrato (18.9019ms)
  ✔ 2.3 a request body on the GET is ignored, never applied to the catalog (2.0049ms)
  ✔ 2.6 the registrar takes the app alone and the module names no Prisma client (0.8484ms)
✔ GET /contrato — the read-only projection of the static catalog (305.892ms)
▶ contrato canónico — the entity list is closed
  ✔ 1.1 the catalog contains exactly the five canonical entities, no more and no fewer (2.1845ms)
  ✔ 1.2 producto, pedido and item_pedido are marked obligatorio at the entity level (0.4071ms)
  ✔ 1.2 insumo and receta_componente are marked opcional at the entity level (0.2812ms)
✔ contrato canónico — the entity list is closed (4.6684ms)
▶ contrato canónico — every field is marked and traces to an automation
  ✔ 1.3 every field across every entity is marked obligatorio or opcional (0.442ms)
  ✔ 1.3 every field names at least one automation, and every label is an AUTOMATIZACIONES value (0.4123ms)
  ✔ 1.3 the three named automations are the whole set, and each one is actually used (0.3047ms)
  ✔ 1.3 each entity only names the automations the proposal assigns to it (0.3766ms)
✔ contrato canónico — every field is marked and traces to an automation (2.0216ms)
▶ contrato canónico — the field-level scenarios, literally
  ✔ 1.4 producto.id, producto.nombre, producto.stockDisponible and producto.activo are obligatorio with ≥1 automation (0.4194ms)
  ✔ 1.4 producto.sku is opcional with ≥1 automation (0.259ms)
  ✔ 1.4 an optional entity still carries required fields (0.2572ms)
✔ contrato canónico — the field-level scenarios, literally (1.288ms)
▶ contrato canónico — personal fields are structurally absent (DEC-23)
  ✔ 1.5 no entity or field name is named or means domicilio, teléfono or correo (1.662ms)
  ✔ 1.5 no entity is reasonably interpretable as a customer or buyer (0.5902ms)
  ✔ 1.5 the sweep would actually catch a personal field (the patterns are not inert) (0.4571ms)
✔ contrato canónico — personal fields are structurally absent (DEC-23) (2.9616ms)
▶ cifrarCredencial — versioned authenticated envelope
  ✔ an enciphered credential round-trips to the original plaintext (9.5208ms)
  ✔ a credential with non-ASCII characters round-trips byte-identically (0.7126ms)
  ✔ the envelope has the shape v1:iv:tag:ciphertext with base64 components (0.7251ms)
  ✔ the same credential enciphered twice yields two different envelopes (0.9932ms)
  ✔ the envelope never contains the plaintext (0.5386ms)
✔ cifrarCredencial — versioned authenticated envelope (14.9612ms)
▶ descifrarCredencial — every unreadable input is ErrorCredencialIlegible
  ✔ a tampered authentication tag is rejected (2.1543ms)
  ✔ a tampered ciphertext is rejected by the tag, not decrypted (0.7306ms)
  ✔ a tampered IV is rejected (0.793ms)
  ✔ an unknown version prefix is rejected instead of being guessed at (0.6582ms)
  ✔ a legacy plaintext credential is rejected (0.4482ms)
  ✔ an empty string is rejected (0.2139ms)
  ✔ an unversioned three-part value is rejected (0.2914ms)
  ✔ a five-part value is rejected (0.1814ms)
  ✔ a value whose components are not base64 is rejected (0.2945ms)
  ✔ a value with the right shape but a short IV is rejected (0.258ms)
  ✔ an envelope enciphered under a different key is rejected, not returned (1.0174ms)
✔ descifrarCredencial — every unreadable input is ErrorCredencialIlegible (8.3838ms)
▶ regla 7 — no key material and no plaintext escapes a failure
  ✔ the failure carries neither the plaintext, the ciphertext nor the key (2.0397ms)
  ✔ a missing key is a configuration failure, not an ErrorCredencialIlegible (0.4746ms)
✔ regla 7 — no key material and no plaintext escapes a failure (2.8115ms)
▶ validarClaveMaestra — fail-closed, and it never returns the key
  ✔ a valid 32-byte base64 key passes and yields nothing (0.502ms)
  ✔ a key that is unset is refused (2.5054ms)
  ✔ a key that is empty is refused (0.3118ms)
  ✔ a key that is not base64 at all is refused (0.2588ms)
  ✔ a key that is valid base64 but only 16 bytes is refused (0.2025ms)
  ✔ a key that is valid base64 but 31 bytes is refused (0.1903ms)
  ✔ a key that is valid base64 but 33 bytes is refused (0.1928ms)
  ✔ a key that is 32 ASCII characters that are not base64 for 32 bytes is refused (0.2337ms)
  ✔ the refusal never quotes the offending value (0.5267ms)
  ✔ changing the key in the environment is picked up, not served from a cache (1.2157ms)
✔ validarClaveMaestra — fail-closed, and it never returns the key (6.9097ms)
▶ classifyConnectionError — classification rows
  ✔ row 1: an explicit ETIMEDOUT from the socket layer (2.7935ms)
  ✔ row 2: ECONNREFUSED is an unreachable host/port (0.5212ms)
  ✔ row 3: ENOTFOUND is a DNS resolution failure (0.3534ms)
  ✔ row 3: EAI_AGAIN is DNS, but its underscore fails the codigo allowlist (0.4625ms)
  ✔ row 4: EHOSTUNREACH is an unreachable host/port (1.0255ms)
  ✔ row 4: ENETUNREACH is an unreachable host/port (0.2624ms)
  ✔ row 4: ECONNRESET is an unreachable host/port (0.1898ms)
  ✔ row 5: SQLSTATE 28P01 is a credentials failure (0.2502ms)
  ✔ row 5: SQLSTATE 28000 is a credentials failure (0.2331ms)
  ✔ row 6: SQLSTATE 3D000 is a missing database (0.4304ms)
  ✔ row 7: any SQLSTATE class 08 falls back to the generic category (0.2716ms)
  ✔ row 8: an unrecognized SQLSTATE falls back to the generic category (0.211ms)
✔ classifyConnectionError — classification rows (10.0883ms)
▶ classifyConnectionError — codigo allowlist
  ✔ a non-Error throw is classified without a codigo (0.2737ms)
  ✔ null is classified without a codigo (0.1507ms)
  ✔ a free-text code does not match the allowlist and yields codigo: null (0.1853ms)
  ✔ a numeric code is not read as a codigo (0.2478ms)
✔ classifyConnectionError — codigo allowlist (1.2077ms)
▶ classifyConnectionError — credential safety
  ✔ a credential-bearing error yields a summary with neither password nor stack (0.4168ms)
✔ classifyConnectionError — credential safety (0.5551ms)
▶ probeConnection — the budget is decided by the race, not by the clock
  ✔ a target that never answers is tiempo-agotado, within the budget (409.6247ms)
  ✔ a driver error inside the budget is classified normally, not as a timeout (2.9277ms)
  ✔ a lost race never leaks the credential into the result (402.1878ms)
✔ probeConnection — the budget is decided by the race, not by the clock (827.7679ms)
﹣ tenant routes — integration against a live PostgreSQL target (0.5893ms) # no PostgreSQL server at localhost:5432 — bring up the Compose db service and set TEST_DB_* (see this file's header)
▶ vistas canonicas — static guarantees
  ✔ ENTIDADES_CANONICAS is exactly the five contract entity names (DEC-32) (1.6857ms)
  ✔ 2.11 the route module never names a target-database entry point or the secret column (9.3031ms)
✔ vistas canonicas — static guarantees (13.7111ms)
﹣ vista canonica routes — integration against a live PostgreSQL target (0.1399ms) # no PostgreSQL server at localhost:5432 — bring up the Compose db service and set TEST_DB_* (see this file's header)
ℹ tests 149
ℹ suites 35
ℹ pass 149
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2089.7102
```

## Relevamiento: consultas del catálogo que leen atributos del contrato (solo reporte)

Se revisó todo el repositorio (`src/`, `openspec/`, `docs/`, `scripts/`, `prisma/`, `files.zip`; se excluyeron `node_modules/` y `dist/`).

**Resultado: la única consulta del catálogo que lee atributos del contrato es `04_consulta_canonica.sql` (`stock-producible`).** `stock-fisico` y `reporte-diario` no tienen implementación en el repositorio (ya registrado en DEC-29). En `src/` ningún código consulta las vistas canónicas: la composición con `WITH` llega en CH-12 (DEC-31).

### `openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql` — `stock-producible`

Contraste contra el contrato vigente después de DEC-36:

| Atributo | ¿Lo lee la consulta? | Contrato: obligatoriedad | Contrato: ¿declara `stock-producible`? | ¿Coincide? |
|---|---|---|---|---|
| `producto.id` | Sí (select, join, group by) | obligatorio | Sí | ✅ |
| `producto.nombre` | Sí (select, group by) | obligatorio | Sí | ✅ |
| `producto.activo` | Sí (`WHERE pr.activo = true`) | obligatorio | Sí | ✅ (antes de DEC-36: ❌, era opcional) |
| `producto.stockDisponible` | No | obligatorio | No | ✅ (antes de DEC-36: ❌, lo declaraba) |
| `producto.sku` | No | opcional | No | ✅ |
| `receta_componente.productoId` | Sí (join) | obligatorio | Sí | ✅ |
| `receta_componente.insumoId` | Sí (join) | obligatorio | Sí | ✅ |
| `receta_componente.cantidadPorUnidad` | Sí (división, `> 0`) | obligatorio | Sí | ✅ |
| `insumo.id` | Sí (join) | obligatorio | Sí | ✅ |
| `insumo.nombre` | Sí (`insumo_limitante`) | obligatorio | Sí | ✅ |
| `insumo.stockDisponible` | Sí (división, `stock_insumo_limitante`) | obligatorio | Sí | ✅ |
| `insumo.unidadMedida` | **No** | opcional | **Sí** | ⚠️ Lo declara pero no lo lee. Ya estaba registrado en DEC-29 (el comentario del contrato lo dice) |
| `insumo.codigo` | **No** | opcional | **Sí** | ⚠️ Lo declara pero no lo lee. No hay nada registrado al respecto |

Todo atributo que la consulta lee está declarado como obligatorio y atado a `stock-producible`. Quedan dos campos opcionales que declaran `stock-producible` sin que la consulta los lea. Por ser opcionales no pueden producir el fallo silencioso que motivó DEC-36. Se reportan sin cambiarlos.

### Otras consultas encontradas que no son del catálogo

Se listan para que el relevamiento quede completo:

- **Copia de `04_consulta_canonica.sql` en `docs/bitacora/bitacora_CH-16b_tres_esquemas.md` (bloque de ~línea 149):** es el mismo texto. Mismo resultado que arriba.
- **Consulta de verificación en `docs/bitacora/bitacora_CH-16b_tres_esquemas.md` (~línea 309):** es una variante de diagnóstico, no una automatización. Lee los mismos atributos que la canónica y además `producto.stockDisponible` (como `stock_declarado`), para comparar el stock declarado con el producible. No implementa ninguna automatización del catálogo, así que no hay nada en el contrato contra lo cual contrastarla.
- **`02_query_original.sql`:** es la consulta nativa original de WF-01c contra el esquema de Food Store (`product`, `ingredient`, `product_ingredient`). No lee atributos del contrato.
- **`03_vistas_foodstore.sql`, `06_vistas_medusa.sql`, `08_vistas_woo.sql`:** son las vistas que producen los atributos del contrato, no consultas que los lean. Las tres pueblan `activo` en `v_producto`.

### Desincronización detectada fuera del alcance (no corregida)

`openspec/specs/canonical-contract/spec.md`, líneas 33–37, escenario "An optional field on a required entity": sigue diciendo que `producto.sku` **y `producto.activo`** SHALL be marked optional. Después de DEC-36, la spec contradice al contrato y a sus tests. Corregirla no estaba entre las tareas, así que queda para decisión del autor.

## Corrección de la spec

**Fecha:** 2026-09-24.
**Alcance:** solo `openspec/specs/canonical-contract/spec.md`. No se modificó `src/`, ninguna consulta SQL ni ninguna base de datos.

Se corrigió la desincronización de la sección anterior. Se revisó la spec completa en busca de otras afirmaciones contrarias a DEC-36:

- **`producto.activo` como opcional:** solo aparecía en el escenario "An optional field on a required entity". Ahí se quitó, y ese escenario queda con `producto.sku` como único ejemplo de campo opcional.
- **Campos obligatorios de `producto`:** la spec los enumera en el escenario "A required entity's required field". Se agregó `activo` a esa lista.
- **`stock-producible` como dependencia de `producto.stockDisponible`:** la spec no nombra ninguna automatización en particular (no menciona `stock-producible`), así que no había nada que corregir.

Los escenarios corregidos coinciden ahora con la prueba 1.4 de `src/contrato.test.ts`.

Fuera de la spec vigente, `activo` aparece también en changes archivados (`openspec/changes/archive/`). Se dejaron como están porque son registro histórico.

### Diff

```diff
--- a/openspec/specs/canonical-contract/spec.md
+++ b/openspec/specs/canonical-contract/spec.md
@@ -25,16 +25,16 @@ Every field in every catalog entity SHALL be marked required or optional at the
 #### Scenario: A required entity's required field
 
 - **GIVEN** the `producto` entity in the catalog
-- **WHEN** its `id`, `nombre`, and `stockDisponible` fields are inspected
+- **WHEN** its `id`, `nombre`, `stockDisponible`, and `activo` fields are inspected
 - **THEN** each SHALL be marked required
 - **AND** each SHALL name at least one automation
 
 #### Scenario: An optional field on a required entity
 
 - **GIVEN** the `producto` entity in the catalog
-- **WHEN** its `sku` and `activo` fields are inspected
-- **THEN** each SHALL be marked optional
-- **AND** each SHALL name at least one automation
+- **WHEN** its `sku` field is inspected
+- **THEN** it SHALL be marked optional
+- **AND** it SHALL name at least one automation
 
 ### Requirement: Personal Fields Are Structurally Absent
```

### Tests

Comando: `npm test` (suite completa). Código de salida: 0. **149 pruebas, 149 pasan, 0 fallan** (35 suites, 0 canceladas, 0 salteadas, 0 pendientes).

Misma salvedad que antes: 8 suites de integración contra PostgreSQL no corrieron porque no había un servidor en `localhost:5432`. Las pruebas del contrato no necesitan base y corrieron todas. El cambio es solo documental, así que no podía afectar el resultado.
