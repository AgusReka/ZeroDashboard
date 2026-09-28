# Bitácora — CH-09: Mapeo por tenant

**Fecha de inicio:** 2026-09-23 (DEC-30, exploración, propuesta, specs, diseño y tareas)
**Fecha de cierre:** 2026-09-26 — Unidades 1 y 2 como commits directos a `master`, Unidad 3 (barrido T2), verificación y archivo en tres ramas encadenadas (PR #3, #4, #5)
**Tiempo invertido:** sesión asistida por agente (Claude Code), ciclo SDD completo (explore → propose → spec → design → tasks → apply → verify → archive). DEC-30 se registró a las 10:42 del 23, antes de abrir la exploración formal; la exploración y DEC-31/DEC-32/DEC-33 son de las 11:24; la propuesta y DEC-34, de las 14:43; specs, diseño y DEC-35, de las 14:55 y 14:59; las tareas, de las 15:31. Los dos primeros commits de implementación (Unidad 1: modelo, migración y aislamiento; Unidad 2: rutas) caen entre las 15:35 y las 16:42, todos el 23. Un commit aislado del 24 a las 15:35 documenta una excepción sobre la comprobación de identidad de bytes de la tarea 4.1, por DEC-36 — una decisión ajena a CH-09 que tocó `src/contrato.ts` en el medio. La Unidad 3 (barrido T2) y los chequeos finales son del 26 a las 21:06; el verify report, a las 21:24; el archivo, a las 21:28. La fusión a `master` corrió por los PR #3 (`ch09/1-barrido-t2`), #4 (`ch09/2-verify`) y #5 (`ch09/3-archivo`) entre las 21:32 y las 21:33 del 26. **Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas de los commits acotan la implementación, no la exploración ni las decisiones.

> Esta entrada se escribe el 2026-09-28, dos días después del cierre (2026-09-26), a partir de los artefactos archivados (`openspec/changes/archive/2026-09-26-CH-09-tenant-schema-mapping/`), de los mensajes de commit y de DEC-30 a DEC-35 en `docs/01-decisiones.md`. No reconstruida de memoria.

---

## Qué se construyó

M2 pedía registrar el mapeo del esquema de un tenant: "vistas canónicas generadas o registradas por tenant" (R1). Antes de este change, CH-16b había probado a mano — con SQL de superusuario fuera del sistema, sobre réplicas reales — que las vistas canónicas funcionaban en tres esquemas (Food Store, Medusa, Woo), pero ZeroDashboard no registraba ningún mapeo: CH-10 no tenía nada que validar, CH-12 nada que componer, y CH-15/CH-16 no podían medir el costo de adaptación a través del sistema.

- **Vistas registradas, no generadas** (DEC-30): la operadora escribe el SQL de cada vista canónica; ZeroDashboard solo lo registra. Un generador por correspondencia de columnas no cubría los casos que CH-16b ya había encontrado (atributos como filas en WooCommerce, stock de Medusa detrás de joins con `inventory_level`, mapeo a nivel de variante).
- **Dónde viven y cómo se aplican** (DEC-31): el SQL se guarda como texto inerte en la base propia de ZeroDashboard; se antepondrá como `WITH v_x AS (...)` recién en CH-12. CH-09 no abre ninguna conexión `pg`; nada se parsea, compone ni ejecuta. La vista previa de cero filas quedó explícitamente fuera de alcance.
- **Modelo `VistaCanonica`** (DEC-32, DEC-33): una definición por (`Conexion`, entidad canónica) — no un bloque único por conexión —, con la clave siendo uno de los cinco nombres exactos de `CONTRATO_CANONICO` (`producto`, `pedido`, `item_pedido`, `insumo`, `receta_componente`); asociado a `Conexion`, no a `Tenant`, porque el SQL depende del esquema de origen. Migración aditiva `20260923000000_vista_canonica`; entra en `MODELOS_AISLADOS`.
- **Rutas** (`src/vistas-canonicas.ts`): `PUT /conexiones/:id/vistas-canonicas/:entidad` (`201` la primera vez, `200` al reemplazar — DEC-34, sin historial ni borrado), `GET .../vistas-canonicas` (listado resumen, sin `sql`, ordenado por `entidad`), `GET .../vistas-canonicas/:entidad` (lectura completa). La conexión se busca primero por el delegado aislado: la de otro tenant da `404 conexion-no-encontrada` antes de cualquier lectura o escritura.
- **Aislamiento sin clave foránea compuesta** (DEC-35): el aislamiento sigue siendo el mecanismo único de DEC-13 (búsqueda escopeada antes de cada operación), no una FK compuesta nueva sobre `Conexion`.
- **Cuerpo de la petición:** `additionalProperties:false` más `propertyNames` rechaza `tenantId` o cualquier propiedad desconocida; el tenant siempre sale del contexto (DEC-15).
- **Escritura concurrente:** sin agregar `upsert` al mapa cerrado de `aplicarAlcance`; `findFirst` → `update`/`create`, con un reintento único ante `P2002` para dos primeras escrituras simultáneas al mismo par.

## Decisiones tomadas

DEC-30 a DEC-35 (`docs/01-decisiones.md`), todas decididas por el usuario el 2026-09-23. DEC-30 se resolvió directamente sobre la ambigüedad del mapa de changes, antes de abrir la exploración; DEC-31 a DEC-33 se presentaron en la ronda de exploración; DEC-34 en la propuesta; DEC-35 en el diseño. Las alternativas y los motivos de cada una están en ese archivo; no se repiten acá.

| Decisión | Qué fija |
|---|---|
| DEC-30 | Vistas canónicas registradas por la operadora, no generadas por correspondencia de columnas |
| DEC-31 | Las vistas viven en la base propia de ZeroDashboard y se aplican como `WITH` en cada consulta (CH-12); CH-09 solo registra |
| DEC-32 | El mapeo se registra por entidad canónica, con el nombre del contrato como clave |
| DEC-33 | El mapeo se asocia a la `Conexion`, no al `Tenant` |
| DEC-34 | Re-registrar una entidad reemplaza la definición anterior en el lugar; sin historial ni borrado |
| DEC-35 | Sin clave foránea compuesta por tenant en `VistaCanonica`; el aislamiento sigue siendo DEC-13 |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | Tres rondas de preguntas abiertas frenaron la cadena automática (exploración: DEC-31/32/33; propuesta: DEC-34; diseño: DEC-35), además de DEC-30 resuelta antes de empezar | AGENTS.md: ninguna decisión de arquitectura la toma un agente; el mapa de changes dejaba CH-09 ambiguo entre vistas "registradas o generadas" y sin definir dónde viven ni cómo se aplican | Cada ronda se presentó al usuario y se registró en `docs/01-decisiones.md` antes de seguir | no medido |
| 2 | El Docker daemon estaba caído al aplicar la Unidad 1 | Entorno local sin el contenedor de base de datos disponible en ese momento | La migración se generó fuera de línea con `prisma migrate diff --from-schema <HEAD> --to-schema prisma/schema.prisma --script`, en vez de `prisma migrate dev --create-only` contra una shadow DB; la desviación quedó documentada en `tasks.md` 1.2 y se cerró en la práctica al ejercitar la tabla contra PostgreSQL real en `sdd-verify` (274/274) | no medido |
| 3 | La Unidad 2 (rutas + tests) se commiteó en +741/-14 líneas, sobre el presupuesto de 400 | El pronóstico de `tasks.md` (~700 líneas totales, riesgo Alto) ya lo anticipaba — el retrospectivo de CH-08 sobre el peso 2:1 de tests contra producción se aplicó al pronóstico, pero el diff no se comprimió | Aceptado como parte de la estrategia `auto-chain`/`stacked-to-main`, elegida porque el repositorio no tenía flujo de PR con revisión en ese momento — cada commit fue directo a `master` | no medido |
| 4 | DEC-36 (`producto.activo` pasa a obligatorio), una decisión ajena a CH-09, tocó `src/contrato.ts` el 24/09, entre la Unidad 2 (23/09) y la Unidad 3 (26/09) de CH-09 | La numeración original de esa decisión iba a ser DEC-30, ya usada por "Mapeo por tenant"; se renumeró a DEC-36 (`docs/bitacora/bitacora_DEC-36.md`) | La comprobación de identidad de bytes de la tarea 4.1 (`src/contrato.ts`, `src/consultas.ts`, `src/consulta-ejecucion.ts` byte-identical) se documentó como excepción (commit `a1704bc`) y se comparó contra el estado posterior a DEC-36, no contra el estado previo a CH-09 | no medido |

## Límites del artefacto

- **Sin asistencia para escribir las vistas** (DEC-30, "se resigna"): dar de alta un tenant exige saber SQL y entender el modelo de datos de origen; es la barrera de entrada que CH-16b ya había registrado para la clase entidad-atributo-valor.
- **Las vistas no existen como objetos en la base del cliente** (DEC-31, "se resigna"): no se pueden inspeccionar con herramientas de catálogo del lado del cliente; el armado tendrá que manejar consultas que abren su propio `WITH`, y los nombres de las vistas pasan a ser identificadores reservados dentro de la consulta armada (CH-12).
- **Cada definición debe ser autocontenida** (DEC-32, "se resigna"): una vista que dependa de otra (por ejemplo, una CTE auxiliar compartida) no tiene lugar propio.
- **Un tenant con dos conexiones al mismo esquema registra el mapeo dos veces** (DEC-33, "se resigna"): el mapeo se asocia a la `Conexion`, no al `Tenant`.
- **Sin historial ni borrado** (DEC-34, "se resigna"): una definición reemplazada no deja rastro; una entidad mapeada por error no se puede desmapear en CH-09. El historial queda para B4/CH-25.
- **La garantía de aislamiento es de la aplicación, no de la base** (DEC-35, "se resigna"): no hay clave foránea compuesta; una escritura que evitara el delegado aislado podría crear una fila cruzada. La cobertura es la prueba T2, no una restricción estructural de la base de datos.
- **Vista previa de cero filas excluida** (proposal.md, Out of Scope): el operador puede probar una definición ejecutando su `SELECT` a mano por la consola existente; una vista previa por API habría reintroducido el probe de columnas que es CH-10.
- **Columnas y tipos no se validan en CH-09**: una definición registrada puede citar columnas inexistentes o de tipo incorrecto sin que nada lo detecte hasta CH-10.

## Cambios a especificaciones existentes

- **tenant-schema-mapping**: spec nueva (7 requisitos, 8 escenarios).
- **tenant-isolation**: delta fusionada — el requisito de "Todo modelo escopeado se filtra por el tenant activo" y el barrido T2 se extendieron a `VistaCanonica` (de dos rutas cubiertas a seis).
- **domain-data-model**: delta fusionada — "No Premature Modeling of Out-of-Release Entities" admite ahora `VistaCanonica` en la lista permitida (antes solo `Tenant`, `Conexion`, `ConsultaGuardada`).
- **canonical-contract**: sin cambios (DEC-21); `src/contrato.ts` solo se importa.

## Verificación

**PASS WITH WARNINGS**: 274/274 tests (248 antes de CH-09, 26 nuevos: 18 en `vistas-canonicas.test.ts`, 8 en `aislamiento.test.ts`), `npx tsc --noEmit` sin errores, 10/10 requisitos y 13/13 escenarios de las specs con prueba que pasa, las 7 reglas de AGENTS.md sostenidas, 0 críticos.

- **WARNING-1**: el pronóstico de `tasks.md` estimaba ~700 líneas totales (riesgo Alto); la Unidad 2 sola cerró en +741/-14, sobre el presupuesto de 400. Disclosed y aceptado como elección deliberada de la estrategia `auto-chain`/`stacked-to-main`.
- **WARNING-2**: el escenario de `domain-data-model` ("No Premature Modeling") se verificó por inspección directa de `prisma/schema.prisma`, no por un `node:test` propio — mismo precedente que el verify report de CH-06. Sugerido, no aplicado en CH-09: un test estático análogo al de la tarea 2.11 (que sí guarda la ausencia de ejecución del SQL registrado).
- **WARNING-3**: la migración de la Unidad 1 se generó fuera de línea (`prisma migrate diff`, Docker caído al aplicar), en vez de `prisma migrate dev --create-only` contra una shadow DB. Cerrado en la práctica: la tabla se ejerció contra PostgreSQL real en `sdd-verify` (274/274, incluyendo 16+ pruebas de integración que tocan `VistaCanonica`).

---

**Archivado**: 2026-09-26 — specs sincronizadas, carpeta del change movida a `openspec/changes/archive/2026-09-26-CH-09-tenant-schema-mapping/`.
