# Bitácora — CH-08: Contrato canónico

**Fecha de inicio:** 2026-09-18 (exploración y propuesta a la mañana, después del archivado de CH-07 a las 10:23)
**Fecha de cierre:** 2026-09-18 — implementado, verificado (248 pruebas en verde, `tsc --noEmit` limpio) y archivado (`a047bbb`, 11:35)
**Tiempo invertido:** sesión asistida por agente (Claude Code), ciclo SDD completo (explore → propose → spec → design → tasks → apply → verify → archive) en una sola mañana. Los tres commits de implementación caen entre las 11:18 y las 11:23; el archivado, a las 11:35. **Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas de los commits acotan la implementación, no la exploración ni las decisiones.

> Se escribe a posteriori (2026-09-23), apoyada en los artefactos archivados del change (`openspec/changes/archive/2026-09-18-CH-08-canonical-contract/`: `proposal.md`, `design.md`, `tasks.md`, `verify-report.md`, `archive-report.md`), en los mensajes de commit y en DEC-21 a DEC-24. No reconstruida de memoria.

---

## Qué se construyó

M1 exigía que la operadora pudiera ver qué entidades y campos exige el contrato canónico, cuáles son obligatorios y opcionales, y qué automatización depende de cada uno. M5 exigía que el contrato excluyera los campos personales (domicilio, teléfono, correo). Antes de este change, el contrato existía solo como idea en `docs/00-contexto.md`; no había ningún artefacto en el código contra el cual mapear un esquema de tenant (CH-09) ni validar un mapeo (CH-10).

El contrato quedó como **código estático** (DEC-21): `src/contrato.ts` define `CONTRATO_CANONICO`, un literal congelado con cinco entidades — `producto`, `pedido` e `item_pedido` obligatorias; `insumo` y `receta_componente` opcionales — y 24 campos. Obligatoriedad de entidad y de campo son dos dimensiones independientes: una entidad opcional puede tener campos obligatorios (si existe `insumo`, tiene que traer `nombre` y `stockDisponible`) y una obligatoria puede tener campos opcionales (`producto.sku`, `producto.activo`).

Cada campo nombra la o las automatizaciones que lo necesitan (`stock-fisico`, `stock-producible`, `reporte-diario`). Las etiquetas son constantes exportadas (`AUTOMATIZACIONES`), nunca literales sueltos (DEC-22), porque `Plantilla` — la entidad real de automatización — recién llega en CH-12 y no hay nada a lo cual apuntar con una clave foránea.

Los campos personales no están filtrados: **no existen** en la definición (DEC-23). Una prueba recorre los 29 nombres del catálogo (5 entidades + 24 campos) buscando cualquier cosa que signifique domicilio, teléfono o correo, o una entidad de cliente, e incluye una prueba de triangulación que demuestra que el barrido efectivamente dispararía ante un campo personal.

El catálogo se expone por `GET /contrato` (`src/contrato-rutas.ts`), de solo lectura, que devuelve `{ contrato: { entidades } }`. La ruta quedó exenta del header `x-tenant-id` (DEC-24): el contrato es igual para todos los tenants y el handler no toca la base. La prueba de esa exención corre contra un cliente de Prisma que lanza error si alguien intenta resolver un tenant, de modo que "no resuelve tenant" pasa de ser una ausencia inobservable a una aserción que fallaría.

No hubo migración: `prisma/schema.prisma` y `MODELOS_AISLADOS` quedaron idénticos a su estado previo a CH-08, verificado con `git diff` contra `47e493f`.

## Decisiones tomadas

DEC-21 a DEC-24 (`docs/01-decisiones.md`), las cuatro decididas por el usuario durante la exploración y la propuesta del change, antes de implementar.

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Contrato como código estático, expuesto por una API de lectura (DEC-21) | Tablas `ContratoEntidad`/`ContratoCampo` en la base propia; solo código sin API | El contrato es igual para todos los tenants: persistirlo como tabla mutable lo trata como dato de tenant. Como código queda versionado y revisable en un diff. La API cierra el "ver" de M1 sin migración |
| Dependencia campo→automatización como etiqueta constante, sin FK (DEC-22) | Placeholder documentado de CH-12; booleano "alguna automatización lo usa" | No presupone la forma de `Plantilla`. El booleano perdería el detalle que M1 pide explícitamente |
| Campos personales estructuralmente ausentes (DEC-23) | Modelarlos y marcarlos "excluidos por defecto" | Garantía estructural por sobre convención, mismo criterio que DEC-08/09/13/16/17. El override de M5 ("salvo que una plantilla lo requiera") queda sin mecanismo hasta CH-12 |
| `GET /contrato` exenta de `x-tenant-id` (DEC-24) | Exigir el header aunque el handler no lo use | Exigirlo trataría un artefacto tenant-agnóstico como dato de un tenant, la misma inconsistencia que DEC-21 evitó |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | El diff escrito (código + pruebas) sumó ~932 líneas, contra ~355 estimadas en `tasks.md` y un presupuesto de revisión de 400 | El pronóstico subestimó los dos archivos de prueba del catálogo y de la ruta en ~145 líneas combinadas; la relación prueba/producción fue de aproximadamente 2:1 | Se aceptó como observación de proceso (WARNING del verify, no defecto). Los tres commits ya siguen las tres fronteras de rollback que nombra `tasks.md`, así que partir en PRs encadenados sigue siendo trivial si hiciera falta | Nulo en código; es un error de estimación |
| 2 | Durante el apply hubo dos reinicios, autorizados, del registro de intentos del revisor nativo | El registro contaba las líneas cambiadas de todo el candidato, no por intento, y se disparaba por el tamaño del diff (fricción 1), no por un problema de calidad | Se reinició el registro con autorización y se dejó constancia en `sdd/CH-08/apply-progress` y en el verify-report | No cuantificado en los artefactos |
| 3 | **Posterior al cierre:** `insumo.unidadMedida` quedó declarado `obligatorio`, pero Food Store no tiene de dónde derivarlo y ninguna automatización lo lee | El criterio de obligatoriedad de CH-08 se fijó por intuición de dominio, no contra una consulta real que usara el campo | Lo detectó CH-16b (paso 6) al correr las vistas contra la base real. DEC-29 lo pasó a opcional y fijó el criterio general: un campo es obligatorio si y solo si al menos una automatización no puede ejecutarse sin él | Registrado en la bitácora de CH-16b, no en este change |

No hay evidencia de otras fricciones en los artefactos del change; no se inventa ninguna más.

## Verificación

| ID | Condición inicial | Acción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| V-1 | Módulo `src/contrato.ts` | Pruebas de invariantes del catálogo | Exactamente 5 entidades con su obligatoriedad; los 24 campos marcados y con al menos una automatización de `AUTOMATIZACIONES` | `contrato.test.ts` 1.1–1.4 en verde | ✅ |
| V-2 | Catálogo completo | Barrido de nombres personales + triangulación | Ningún campo ni entidad significa domicilio, teléfono, correo o cliente; el barrido dispara ante un caso sembrado | `contrato.test.ts` 1.5 (tres pruebas) en verde | ✅ |
| V-3 | Servidor con la ruta registrada | `GET /contrato`; `POST/PUT/PATCH/DELETE /contrato` | 200 con la proyección igual a `CONTRATO_CANONICO`; 404 para el resto de los métodos | `contrato-rutas.test.ts` 2.1–2.3 en verde | ✅ |
| V-4 | Prisma que lanza error ante `tenant.findUnique` | `GET /contrato` sin header, con header inexistente y con tenant válido | Mismo cuerpo byte a byte en los tres casos; `/contrato-falso` sin header rechazado con 400 | `contexto-tenant.test.ts` 3.1–3.3, incluido el caso contra PostgreSQL real | ✅ |
| V-5 | Árbol posterior a CH-08 | `git diff --stat 47e493f HEAD -- prisma/ src/aislamiento-prisma.ts` | Vacío | Vacío | ✅ |
| V-6 | Árbol posterior a CH-08 | `npx tsc -p tsconfig.json --noEmit` y `npm test` | Sin errores; suite en verde | Exit 0; 248/248 (de 223 en CH-07), corrida en forma independiente en el verify | ✅ |

No se corrió `npm run smoke`: el change no agrega consola, migración ni superficie de conexiones, y su estrategia de pruebas nombra `node:test` + `inject()` como verificación completa.

## Consultas ejecutadas

Ninguna consulta de dominio en este change. El contrato se contrastó recién contra datos reales en CH-16b (fricción 3).

## Notas para la tesis

**Capítulo 4, el contrato como artefacto.** El contrato canónico — la contribución central de la tesis — vive como código versionado y no como dato. La justificación (DEC-21) es citable: es igual para todos los tenants, así que persistirlo como tabla lo trataría como algo que no es.

**Capítulo 6, el contrato se corrigió con datos.** La obligatoriedad de `unidadMedida` se decidió en CH-08 sin ninguna consulta real que la usara, y se cayó al primer contacto con un esquema real (CH-16b, DEC-29). Es evidencia a favor del criterio que quedó (DEC-29): un campo del contrato es obligatorio si y solo si al menos una automatización no puede ejecutarse sin él. Un contrato diseñado solo desde el dominio sobreexige.

**Lo que esta entrada NO sostiene.** Ningún dato de tiempo de trabajo: las marcas de los commits acotan la implementación, no el ciclo completo.
