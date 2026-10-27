# Bitácora — CH-36: Reorganización de `src/` en carpetas por dominio

**Fecha de inicio:** 2026-10-23 (exploración y DEC-181)
**Fecha de cierre:** pendiente (falta mergear #199 a #202)
**Tiempo invertido:** sesión asistida por agente (Claude Code), llevada en forma directa, sin ciclo SDD, por decisión del usuario.

| Momento | Marca |
|---|---|
| Exploración y mapa de dependencias | 4,6 min de agente |
| DEC-181 | Commit `eb1ac69`, 16:23 |
| Implementación de los tres cortes | 10,5 min de agente, en un escritor delegado |
| Cortes | Commits `24aefc7` (16:29), `21eb448` (16:32) y `9c9bc91` (16:34) |
| Verificación independiente | A continuación, en la misma sesión |
| PRs #199 a #202 | Abiertos a las 19:36 |

**Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas acotan los commits y las corridas del agente, no la conversación previa ni la revisión.

> Se escribe el 2026-10-23, apoyada en DEC-181, en el informe de exploración, en el informe del escritor y en la verificación hecha después de los tres cortes. No reconstruida de memoria.

---

## Qué se construyó

Al cerrar la v1, `src/` tenía 133 archivos en una sola carpeta. CH-36 los mueve a 17 carpetas por dominio sin cambiar el comportamiento, como paso previo a la v2, que suma dominios nuevos (reportes y canales).

- **Corte 1, preparación** (`ch36/preparacion`, #200):
  - `camposInvalidos` y su helper `nombreDelCampo` pasan de `src/conexiones.ts` a `src/compartido/campos-invalidos.ts`, como copia literal. Sus 13 importadores apuntan al módulo nuevo, y así se corta el ciclo `agente` ↔ `conexiones`.
  - `marcas-alta.test.ts` y `validacion-mapeo-rutas.test.ts` pasan a escanear `src/` en forma recursiva, sin `generated/`.
- **Corte 2, módulos base** (`ch36/base`, #201): se mueven `compartido`, `aislamiento`, `ejecucion`, `contrato`, `auditoria`, `agente`, `conexiones` y `tenants`. Son 60 archivos movidos con `git mv` y 56 con imports reescritos.
- **Corte 3, dominios restantes** (`ch36/dominios`, #202):
  - Se mueven `app`, `consultas`, `plantillas`, `mapeo`, `automatizaciones`, `panel`, `consola`, `usuarios` y `semillas`: 65 archivos movidos y 18 modificados.
  - Se actualizan las referencias vivas: `prisma/seed.ts`, `openspec/config.yaml` y las dos copias de la skill `zerodashboard-design`.
- **Lo que no se movió** (DEC-181): `server.ts`, `operador-alta.ts`, `agente-protocolo.ts` (con sus tests), `agente-proceso/` y `generated/`. Por eso no se tocaron `package.json`, el `Dockerfile`, el entrypoint ni la frontera del agente.
- Sin migración, sin dependencias nuevas y sin cambios de comportamiento.

## Decisiones tomadas

| Decisión | Qué fija |
|---|---|
| DEC-181 | Carpetas por dominio, asignación por contenido y no por prefijo, archivos que no se mueven, extracción de `camposInvalidos` y escaneos recursivos. Se descartaron el movimiento puro, las carpetas gruesas por superficie y las capas hexagonales |

Se decidió con el usuario el 2026-10-23, eligiendo la opción recomendada. La forma de llevarlo, en directo y sin SDD, también la eligió el usuario.

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | Dos tests habrían pasado sin probar nada después de mover | `marcas-alta.test.ts` y `validacion-mapeo-rutas.test.ts` escaneaban solo la carpeta plana | Se hicieron recursivos en el corte 1, todavía con la estructura plana. En cada corte se comprobó que fallan con una violación temporal en una subcarpeta, y la violación se revirtió | no medido |
| 2 | La reescritura de imports rompió la prueba F1 de `frontera.test.ts` | La expresión regular también reescribió imports sintéticos dentro de los fixtures del test | Se revirtió ese archivo: queda sin cambios | no medido |
| 3 | `gentle-ai review assess` evaluó primero solo los cambios sin commitear de `.atl/` | Sin `--base-ref`, evalúa el árbol de trabajo, no los commits | Se corrió con `--base-ref eb1ac69 --committed-only` y el inventario de no rastreados. Dio riesgo alto, pero solo por señales de ruta: se movieron un test de `auth` y uno de procesos | no medido |
| 4 | El tamaño medido en local no coincidió con el de GitHub | Con `git diff -M90%`, tres archivos no se detectan como renombres (`rutas.ts`, `conexiones.ts` y `usuarios-panel-apoyo.ts`) y el corte 3 mide 928 líneas. GitHub mide 586 | Se corrigió la cifra en la descripción de #202 | no medido |
| 5 | Los cortes 2 y 3 pasan el tope de 400 líneas (628 y 586) | Cada línea es un `import` con la ruta cambiada | Se explicó la excepción en cada PR. El repo no tiene una etiqueta de tamaño y no se creó | no medido |
| 6 | El mapa de changes mostraba 112 líneas cambiadas por dos ediciones de una línea | Tenía líneas con finales `\r\r\n` rotos, que la edición normalizó | Se aclaró en #199; el contenido cambió solo en dos filas | no medido |
| 7 | `npm test` sin base da 41 fallas y 438 canceladas | Las suites con base no tienen credenciales | La comparación se hizo siempre con `test:db` contra `zerodashboard_test` (puerto 5434) | no medido |

## Límites del artefacto (aceptados)

| Límite | Origen | Notas |
|---|---|---|
| No hay capas dentro de cada dominio | DEC-181 | Rutas, reglas y acceso a datos siguen conviviendo en los mismos módulos. Queda como trabajo futuro |
| `src/consola/consola.ts` sigue siendo un string de unas 5.400 líneas | DEC-181, DEC-124 | Se movió sin partirse |
| El ciclo `panel` ↔ `usuarios` sigue | DEC-181 | Lo cierra solo el fixture `usuarios-panel-apoyo.ts` |
| `git blame` necesita `-C` o `--follow` | DEC-181 | Para atravesar el movimiento |
| Las menciones históricas a `src/<archivo>.ts` no se reescribieron | DEC-181 | En decisiones, bitácora y specs archivadas |
| Quedan menciones viejas en comentarios vivos | Informe del escritor | En `scripts/smoke.sh`, `scripts/marcas-alta.sql`, `prisma/schema.prisma`, `.claude/skills/guidelines/consola.md` y el encabezado de `src/compartido/listados.ts`. No rompen nada |

**Rollback:** revertir #202, #201 y #200, en ese orden. No hay migración ni cambio de datos.

## Verificación

Línea base en `ch36/decision` (`eb1ac69`), antes de mover nada:
- `npm run build` y `npm run build:agente`: compilan.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 1495 de 1499. Las 4 fallas son los falsos positivos conocidos de `conexiones.test.ts` (5.1, 5.3, 5.4 y CH-07), que aparecen porque la respuesta contiene `"motor":"postgres"` cuando la clave es `postgres`.

Cada corte dio exactamente lo mismo que la línea base, con las mismas 4 fallas.

Verificación independiente sobre `ch36/dominios`:
- **El diff:** con detección de renombres al 90%, fuera de los `import`, solo cambian las rutas a `public/ui` y `scripts/`, los dos escaneos recursivos y los mensajes de aserción con las rutas nuevas.
- **La extracción:** `camposInvalidos` y su helper son copia literal.
- **El build y la suite:** `build`, `build:agente` y `test:db` corridos de nuevo dan los mismos 1495 de 1499.
- **La semilla:** `dist/plantillas/catalogo-inicial.js`, `dist/semillas/semilla-demo.js` y `dist/generated/prisma/client.js` existen, y su import dinámico resuelve los exports que usa `seed.ts`. La semilla no se ejecutó.

## Pendientes fuera de CH-36

- Actualizar las menciones viejas a `src/` en los comentarios listados en los límites.
- CH-37, el primer change de código de la v2.
