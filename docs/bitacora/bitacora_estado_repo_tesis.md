# Bitácora — estado real del repositorio para cerrar la devolución de la tesis (P16)

**Relevamiento:** 2026-09-30, desde las 20:38 (−03:00). Rama de trabajo: `chore/readme-y-raiz` (creada desde `origin/master`, sin fusionar).
**Alcance:** solo lectura sobre lo ya hecho, salvo el README (paso 5) y este archivo. No se tocó `src/`, `prisma/`, `contrato.ts`, pruebas, vistas ni SQL de los experimentos.
**Convención:** `T` = `congelamiento-tesis-2026-09-24` (commit `a1704bcec01132f79f5eddfc66d9f6125bde6a02`, 2026-09-24 15:35:34 −03:00). Los textos de la tesis no están en el repositorio: las columnas «Coincide / No coincide» comparan contra lo que el encargo dice que la tesis afirma, no contra su texto literal.

## Hallazgo previo que condiciona todo el documento

**`master` local y `origin/master` no son el mismo commit.** El `master` local está 33 commits atrás.

```
$ git log -1 --format='%H %cI %s' master
a4d78dbb73dea6ffba5eff9329a9a1034ba99436 2026-09-29T10:40:47-03:00 Merge pull request #40 from AgusReka/ch13/7-verify-archivo
$ git log -1 --format='%H %cI %s' origin/master
9a0ca4bfb01cdd82700dfd9d1cb29170f4e8a3b5 2026-09-30T15:09:03-03:00 Merge pull request #41 from AgusReka/ch15/1-instrumentacion-de-tiempos-de-alta
$ git rev-list --count master..origin/master
33
```

La cifra «unos 149 archivos modificados» del tribunal corresponde al `master` local (a4d78db, 29/09) y **se reproduce exactamente** (ver 1.4). Lo que hay hoy en GitHub es `origin/master` (`9a0ca4b`, 30/09), con más contenido: CH-14 y CH-15. Este documento informa **ambos**; el resto de los pasos (2 a 5) se hizo sobre `origin/master`, que es la rama principal publicada. No se avanzó el `master` local (no se modificó ninguna rama existente).

---

## Paso 1 — Estado de la rama principal respecto de la etiqueta

### 1.1 Fecha de corte y fetch

```
$ date '+%Y-%m-%d %H:%M:%S %z'
2026-09-30 20:38:31 -0300
$ git fetch --all --tags
(sin salida: no había nada nuevo que traer)
```

**Fecha de corte: 2026-09-30 20:38:31 −03:00.**

### 1.2 Último commit de `master` y de `origin/master`

| Rama | Hash | Fecha (commit) | Mensaje |
|---|---|---|---|
| `master` (local) | `a4d78dbb73dea6ffba5eff9329a9a1034ba99436` | 2026-09-29T10:40:47−03:00 | Merge pull request #40 from AgusReka/ch13/7-verify-archivo |
| `origin/master` | `9a0ca4bfb01cdd82700dfd9d1cb29170f4e8a3b5` | 2026-09-30T15:09:03−03:00 | Merge pull request #41 from AgusReka/ch15/1-instrumentacion-de-tiempos-de-alta |

### 1.3 Commits entre la etiqueta y `master`

```
$ git rev-list --count congelamiento-tesis-2026-09-24..master
100
$ git rev-list --count congelamiento-tesis-2026-09-24..origin/master
133
$ git log --merges --format=%h congelamiento-tesis-2026-09-24..origin/master | wc -l
41
$ git log --no-merges --format=%h congelamiento-tesis-2026-09-24..origin/master | wc -l
92
```

**Coincide / No coincide:** la tesis habla de «cinco commits de bitácoras» → **No coincide**: son 100 (`master` local) o 133 (`origin/master`); 92 sin contar fusiones. Los cinco commits son los que había el 26/09 (auditoría `docs/bitacora/auditoria_mapa_cambios.md`, fila 9). Esos cinco son los 5 commits más viejos de la lista del Apéndice A (hasta `a6e605a`).

La lista completa (fecha, hash, mensaje) de los 133 commits está en el **Apéndice A**.

### 1.4 `git diff --stat` etiqueta → `master`

```
$ git diff --shortstat congelamiento-tesis-2026-09-24 master
 149 files changed, 21087 insertions(+), 171 deletions(-)
$ git diff --shortstat congelamiento-tesis-2026-09-24 origin/master
 183 files changed, 28019 insertions(+), 173 deletions(-)
```

Esas dos salidas usan detección de renombrados (la de git por defecto): las carpetas de `openspec/changes/CH-xx` que pasaron a `archive/` se cuentan como renombres. Para el desglose por carpeta se usó `--no-renames` (cuenta cada archivo por su ruta real), que da totales distintos:

```
$ git diff --no-renames --shortstat congelamiento-tesis-2026-09-24 master
 156 files changed, 21582 insertions(+), 666 deletions(-)
$ git diff --no-renames --shortstat congelamiento-tesis-2026-09-24 origin/master
 190 files changed, 28514 insertions(+), 668 deletions(-)
```

Desglose por carpeta de primer nivel (`git diff --no-renames --numstat T <rama>`, agrupado con `awk` por la primera componente de la ruta):

| Carpeta | `master` local (a4d78db) | `origin/master` (9a0ca4b) |
|---|---|---|
| `src/` | 38 archivos, +8586 −116 | 45 archivos, +11748 −118 |
| `prisma/` | 5 archivos, +234 −23 | 6 archivos, +261 −23 |
| `docs/` | 12 archivos, +3734 −0 | 14 archivos, +4154 −0 |
| `openspec/` | 97 archivos, +8996 −527 | 120 archivos, +12151 −527 |
| `scripts/` | — | 1 archivo, +101 −0 |
| `experimentos/` | 0 | 0 |
| raíz | 4 archivos, +32 −0 | 4 archivos, +99 −0 |
| **Total** | **156, +21582 −666** | **190, +28514 −668** |

Detalle de `openspec/` en `origin/master` (por subcarpeta):

| Subcarpeta | Archivos | Inserciones | Borrados |
|---|---|---|---|
| `openspec/changes/archive/` | 79 | +8385 | −0 |
| `openspec/changes/CH-16d-segunda-automatizacion-y-with/` | 19 | +2143 | −0 |
| `openspec/changes/CH-09-tenant-schema-mapping/` (borrados: se movieron a `archive/`) | 7 | +0 | −503 |
| `openspec/specs/` | 15 | +1623 | −24 |

Los cuatro archivos de la raíz son `.env.example`, `docker-compose.yml`, `package.json` y `package-lock.json` (`git diff --no-renames --name-status`).

Lo que cambió en `src/` (`origin/master`): 25 archivos nuevos y 20 modificados; 24 de los 45 son `*.test.ts`. Sin pruebas: 21 archivos, +4260 −95. Entre los modificados está **`src/contrato.ts`** (+46 −3), por dos commits: `6d1e4be` (2026-09-27, CH-10, DEC-39: tipo semántico por campo) y `ccfb4c9` (2026-09-28, CH-12, DEC-67: etiquetas de automatización). `prisma/schema.prisma` suma los modelos `Plantilla`, `Automatizacion` y `Ejecucion` y 5 migraciones.

**Coincide / No coincide:** «unos 149 archivos modificados, con código nuevo y planificadores» → **Coincide** para el `master` local (149, salida cruda arriba). **No coincide** como descripción del estado publicado: `origin/master` tiene 183 archivos (190 sin detectar renombres), +28019 −173.

### 1.5 Cambios `CH-xx` en `master` desde la etiqueta

Último commit de cada change (lectura de la lista del Apéndice A; el commit «de cierre» es el de archivo/bitácora):

| Change | Último commit | Fecha | Mensaje |
|---|---|---|---|
| CH-09 (bitácora) | `a85b514` (fusión `985a82a`) | 2026-09-28 12:35:03 | CH-09: bitacora del change |
| CH-09 (archivo) | `65a625f` | 2026-09-26 21:28:52 | CH-09: archivo del change y specs actualizadas |
| CH-10 | `7cc19c7` | 2026-09-27 14:46:21 | CH-10: archivo del change, specs actualizadas y bitacora |
| CH-11 | `257b100` | 2026-09-27 20:41:06 | CH-11: archivo del change, specs actualizadas y bitacora |
| CH-12 | `fcd5a18` | 2026-09-28 12:01:34 | CH-12: archivo del change, specs actualizadas y bitacora |
| CH-13 | `6db5f4d` | 2026-09-29 10:22:32 | CH-13: bitacora del change |
| CH-14 | `6c729dc` | 2026-09-29 22:08:42 | sdd-archive: CH-14 close and archive |
| CH-15 | `5489ecc` (fusión `9a0ca4b`) | 2026-09-30 15:08:44 | docs(ch15): bitacora de instrumentacion de tiempos del alta |
| CH-16d | `a6e605a` | 2026-09-25 13:08:07 | CH-16d: segunda automatizacion (stock fisico) y composicion con WITH |
| Mapa de CH-16b/c/d | `4423393` | 2026-09-26 20:27:22 | Mapa de changes: experimentos CH-16b, CH-16c y CH-16d (D-7) |

CH-14 y CH-15 **no** están en el `master` local (solo en `origin/master`). CH-16b y CH-16c ya estaban en la etiqueta; desde ella solo se agregó CH-16d.

### 1.6 Ramas de experimentos: ¿son ancestros de `master`?

```
$ git merge-base --is-ancestor 0e80098 origin/master ; echo $?     # reporte-diario
1
$ git merge-base --is-ancestor c3ee7b4 origin/master ; echo $?     # odoo
1
$ git merge-base --is-ancestor d06b7ad origin/master ; echo $?     # desempate
1
```

(La misma prueba contra `master` local da también «no ancestro» en los tres casos; también para `385b170`.)

| Rama | Último commit | ¿Ancestro de `master`? | Cómo entró |
|---|---|---|---|
| `experimento/reporte-diario` | `0e80098` (2026-09-25 15:44:04) | **No** | **No entró.** |
| `experimento/odoo` | `c3ee7b4` (2026-09-26 19:29:19) | **No** | **No entró.** |
| `experimento/desempate` | `d06b7ad` (2026-09-29 13:08:31) | **No** | **No entró.** |

Verificación de que tampoco entraron por *cherry-pick*:

```
$ git cherry origin/master origin/experimento/reporte-diario   →  2 commits con '+' (ninguno equivalente en master)
$ git cherry origin/master origin/experimento/odoo             →  6 commits con '+'
$ git cherry origin/master origin/experimento/desempate        → 10 commits con '+'
$ git merge-base origin/master origin/experimento/odoo
a6e605a1295d8a9e8bb0b8d1d8defa6c70f9dcc9
```

Las tres ramas parten de `a6e605a` (25/09, CH-16d, en `master`) y tienen 2, 6 y 10 commits propios (`git rev-list --count origin/master..origin/experimento/<rama>`). Las ramas se apilan: `odoo` contiene los 2 de `reporte-diario`, `desempate` contiene los 6 de `odoo`. No hay ninguna fusión de esas ramas en `master` (la única fusión con «experim» en el nombre es el PR #2, `docs/mapa-experimentos-ch16`, que es documentación). `master` no tiene carpeta `experimentos/` (0 archivos en la tabla anterior).

**Coincide / No coincide:** no se dispone de una afirmación de la tesis sobre esto; se informa el hecho: el código de los experimentos vive **solo** en las ramas; `master` no los contiene.

---

## Paso 2 — Pruebas y automatizaciones

### 2.1 `npm test`

Se corrió en la rama `chore/readme-y-raiz`, cuyo árbol es exactamente `origin/master` (`9a0ca4b`) más el cambio de README. PostgreSQL disponible: contenedor `zd-ch09-testdb` (puerto 5434) y `zerodashboard-db-1`.

**Corrida A — puerto por defecto (5432).** 2026-09-30 20:39:21, duración 10 s.

```
$ npm test
ℹ tests 633
ℹ suites 93
ℹ pass 410
ℹ fail 19
ℹ cancelled 204
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 8557.1636
  Authentication failed against the database server, the provided database credentials for `zerodashboard` are not valid
      at ... src\vistas-canonicas.test.ts:139:22)
exit=1
```

Causa: en esta máquina el 5432 lo ocupa la base de Saleor; el chequeo de alcance pasa y el login falla (**ya registrado** en `docs/bitacora/CH-10`, `CH-11` y `CH-13`). Esta corrida **no sirve** como resultado de las pruebas.

**Corrida B — `TEST_DB_PORT=5434` (el procedimiento que registran las bitácoras de CH-10, CH-11 y CH-13).** 2026-09-30 20:40:15, duración 14 s.

```
$ TEST_DB_PORT=5434 npm test
ℹ tests 633
ℹ suites 93
ℹ pass 632
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13730.1161
✖ failing tests:
test at src\planificador.test.ts:329:3
✖ 4.5 an unexpected throw closes its run as error-interno and the siblings still run (532.9692ms)
  AssertionError [ERR_ASSERTION]: fbe5267c-3737-41ab-83e5-7dafd6908bd5
  2 !== 1
      at TestContext.<anonymous> (src\planificador.test.ts:343:14)
exit=1
```

**Corrida C — repetición de B** (2026-09-30 20:40:38): misma salida (`tests 633`, `suites 93`, `pass 632`, `fail 1`, `cancelled 0`, `skipped 0`), mismo test fallado (`4.5 an unexpected throw closes its run as error-interno…`).

**Corrida D — solo ese archivo** (`TEST_DB_PORT=5434 npx tsx --test src/planificador.test.ts`, 20:40:59):

```
ℹ tests 17
ℹ pass 17
ℹ fail 0
```

**Lectura (sin diagnosticar la causa):** el test falla de forma reproducible (2 de 2) dentro de la corrida completa y pasa aislado (17/17). El `assert` de la línea 343 espera 1 fila de ejecución para la automatización y encuentra 2; lo compatible con el resultado es interferencia entre suites que comparten la base, pero **no se investigó** (el encargo es de solo lectura). Las bitácoras de CH-14 y CH-15 no registran un `npm test` con 0 fallas en `master` que permita comparar. Es un punto para el autor (ver Dudas).

**Nota:** la suite `notificador-mailpit.test.ts` se saltea si no hay Mailpit con el perfil `correo`, y no suma a `skipped` (registrado en `docs/bitacora/CH-14`, fila 9). Por eso `skipped` es 0.

**Cifras para la tesis (salida cruda, no de corridas anteriores):** 633 pruebas, 93 suites; con la base de pruebas correcta, **632 pasan, 1 falla, 0 salteadas**.

### 2.2 Código que ejecuta automatizaciones

Misma búsqueda que la fila 6 de la auditoría, pero sobre `origin/master` (la auditoría la hizo sobre la etiqueta):

```
$ git grep -n -i -E "cron|schedul|setInterval|nodemailer|smtp|sendmail|planificador" origin/master -- src package.json
```

Archivos de código (no de prueba) con coincidencias, con conteo de líneas: `package.json` 2, `src/aislamiento-prisma.ts` 1, `src/automatizaciones-rutas.ts` 13, `src/automatizaciones.ts` 36, `src/config.ts` 10, `src/consola.ts` 10, `src/contexto-tenant.ts` 2, `src/correo.ts` 3, `src/notificador.ts` 51, `src/planificador.ts` 20, `src/server.ts` 12. Más 14 archivos de prueba (`*.test.ts`). Total: 25 archivos.

Puntos de ejecución concretos:

```
$ git grep -n -E "setInterval|setTimeout\(|CronExpressionParser|createTransport" origin/master -- 'src/*.ts' ':!*.test.ts'
src/automatizaciones.ts:1:import { CronExpressionParser } from 'cron-parser';
src/automatizaciones.ts:69:    CronExpressionParser.parse(campos.join(' '), { tz: zona }).next();
src/automatizaciones.ts:100:  const siguiente = CronExpressionParser.parse(campos.join(' '), { currentDate: desde, tz: zona })
src/planificador.ts:47:    const temporizador = setTimeout(fn, ms);
src/notificador.ts:1:import { createTransport, type SendMailOptions, type SMTPTransportOptions } from 'nodemailer';
src/notificador.ts:237:  const transporte = createTransport(opcionesTransporte(smtp, o.timeoutMs));
src/server.ts:38:    const planificador = crearPlanificador({ … notificador … })   # línea 38
src/server.ts:79:    planificador.iniciar();
```

(`setInterval` no aparece: el planificador reprograma con `setTimeout`.) Modelos de `prisma/schema.prisma` en `origin/master`: `Tenant` (18), `Conexion` (30), `ConsultaGuardada` (54), `VistaCanonica` (86), **`Plantilla` (118), `Automatizacion` (146), `Ejecucion` (179)**.

**Qué hace hoy el prototipo:** `origin/master` arranca un planificador dentro del proceso del servidor que, por tenant y por horario cron, ejecuta la consulta de una `Plantilla` sobre las vistas canónicas, registra cada corrida en `Ejecucion` y envía (si hay SMTP configurado) un correo por nodemailer con el resultado, sin enviar cuando no hay filas; cubierto por pruebas de integración, y por una prueba en vivo opcional contra Mailpit. **No hay evidencia en el repositorio de una corrida productiva de punta a punta con un cliente real** (no hay un comando ni salida que la registre), y las propias bitácoras de CH-12 (DEC-69) aclaran que CH-12 no escribe la consulta canónica de `reporte-diario`. La frase «de punta a punta» solo puede afirmarse para el flujo cubierto por pruebas, no para un despliegue. Este es el punto más delicado para la tesis: **en la etiqueta (24/09) no había nada de esto; en `master` sí.**

**Coincide / No coincide:** la tesis afirma (según la auditoría, fila 6) que el prototipo **no ejecuta ninguna** automatización → **Coincide solo para la etiqueta; No coincide para `master`**.

---

## Paso 3 — Tres verificaciones que la tesis afirma

### 3.1 Sección 6.2 — comparación original vs. canónica de Food Store (CH-16b)

**Ubicación:** `docs/bitacora/bitacora_CH-16b_tres_esquemas.md`, líneas 38 (V-3 sobre la base real) y 94 (V-3 sobre el fixture). Consultas: `openspec/changes/CH-16b-vistas-canonicas/sql/02_query_original.sql` y `04_consulta_canonica.sql`.

Texto literal, línea 38:

> `| V-3 (real) | Ambas consultas disponibles contra la base real | Diferencia simétrica entre `02_query_original.sql` y `04_consulta_canonica.sql` (sin modificar), comparando por `id::text` | `solo en ORIGINAL: 0` / `solo en CANÓNICA: 0` / `intersección: 6` | ✅ **equivalencia probada contra la base real** |`

Línea 94: «**Diferencia simétrica de conjuntos** entre el resultado de la consulta original y el de la canónica | Cero filas de diferencia en las dos direcciones | `solo en ORIGINAL: 0` / `solo en CANÓNICA: 0` / `intersección: 6`».

**La consulta de la diferencia simétrica de CH-16b no está guardada en el repositorio.** Se buscó `EXCEPT`, `solo en ORIGINAL` e `id::text` en `docs/` y `openspec/` (`git grep`) y en la historia con `git log --all -S"solo en ORIGINAL"` (único commit: `fc54f19`, que solo agrega la tabla de la bitácora). Lo único registrado es el criterio («comparando por `id::text`») y el resultado.

Lo que sí se puede afirmar con los archivos del repositorio:

- Las dos consultas **no tienen las mismas columnas**. La original (`02_query_original.sql`) devuelve `p.id, p.name, stock_producible, ingrediente_critico`. La canónica (`04_consulta_canonica.sql`) devuelve `id, nombre, stock_producible, insumo_limitante, stock_insumo_limitante`. **La original no calcula la existencia del insumo limitante**, así que una comparación fila a fila de «las tres columnas» (stock producible, insumo limitante, existencia del insumo limitante) no puede haberse hecho con `02_query_original.sql` tal como está.
- La comparación registrada es por `id::text` → compara **el conjunto de identificadores** (6 = 6, 0 sobrantes en cada lado). No hay evidencia registrada de una comparación de valores.
- Contraste: en CH-16d el mismo método sí compara valores (`docs/bitacora/bitacora_CH-16d.md`, línea 302): `count(*) FILTER (WHERE … o.name IS DISTINCT FROM c.nombre OR o.stock_quantity IS DISTINCT FROM c."stockDisponible") AS interseccion_con_valores_distintos`, con salida `solo_original 0 | solo_canonica 0 | interseccion 3 | interseccion_con_valores_distintos 0`. Esa comparación de valores es de **otra consulta** (stock físico, dos columnas: nombre y stock), no del stock producible.

**Coincide / No coincide:** si la tesis dice que la diferencia simétrica se calculó fila a fila sobre las tres columnas → **No coincide**: el registro dice que se comparó por identificador. La consulta exacta de esa comparación no se conserva; para mostrarla habría que reconstruirla (no se hizo: requeriría crear las vistas en la base real, que es una escritura). Queda como duda para el autor.

### 3.2 Sección 6.3.3 — `m_stock_producible.sql` de Odoo

**Ubicación:** rama `experimento/odoo` (y `desempate`): `experimentos/odoo/sql/manual/m_stock_producible.sql` (45 líneas). No existe en `master`.

```
$ git show origin/experimento/odoo:experimentos/odoo/sql/manual/m_stock_producible.sql | cat -n
```

Líneas que muestran el comportamiento:

- L16–21: `disponible AS (SELECT q.product_id, SUM(q.quantity) - SUM(q.reserved_quantity) AS disp FROM stock_quant q WHERE q.location_id IN (… usage = 'internal') GROUP BY q.product_id)` — la existencia de **cada producto** se toma de `stock_quant`.
- L22–32: `consumo AS (SELECT c.producto, l.product_id AS componente, SUM(l.product_qty * ul.factor / uc.factor) / (c.bom_qty * c.f_bom / c.f_prod) AS por_unidad FROM candidatas c JOIN mrp_bom_line l ON l.bom_id = c.bom …)` — **una sola lista de materiales** por producto (la elegida en `candidatas`, L4–15).
- L40–43: `FROM consumo k JOIN product_product cp ON cp.id = k.componente … LEFT JOIN disponible d ON d.product_id = k.componente` — el stock de cada componente (incluso si el componente tiene su propia lista de materiales) se toma **de su existencia física** (`d.disp`).
- No hay `WITH RECURSIVE` ni una segunda unión a `mrp_bom` a partir de `k.componente`. La única unión a `mrp_bom` está en L10, para el producto de nivel superior.

(La línea 10 admite `b.type IN ('normal','phantom')`, es decir, el producto de nivel superior puede ser un kit; pero el componente de la línea no se expande.)

**Coincide / No coincide:** el cálculo manual toma el stock de un intermedio como su existencia física (**un solo nivel**; no explota listas de materiales en varios niveles) → **Coincide con la afirmación «un solo nivel»**, si es lo que dice la tesis. Si la tesis dice que explota varios niveles → **No coincide**.

### 3.3 Sección 6.3.3 — preregistro previo de la replicación sobre Odoo (`385b170`)

```
$ git log -1 --format='%H %cI %s' 385b170
385b170469328118ef8743f7393551d701f66650 2026-09-26T13:21:00-03:00 Odoo: preregistro de consultas canonicas, criterios y modificacion controlada
$ git show --stat 385b170   →   experimentos/odoo/PREREGISTRO.md | 82 +++ (único archivo)
$ git show 385b170:experimentos/odoo/PREREGISTRO.md | sed -n 32,40p
```

Texto literal de la sección «2. Criterios de refutación» (líneas 32–40):

```
## 2. Criterios de refutación

- **R1.** Alguna consulta canónica necesita editar su texto para ejecutar sobre Odoo.
- **R2.** El stock producible difiere del cálculo manual, o la modificación controlada no produce exactamente el resultado esperado.
- **R3.** Algún resultado del reporte diario difiere del cálculo manual, o la modificación controlada no produce exactamente los efectos esperados.

Que un atributo no tenga correspondencia (clase 4) no refuta nada: se reporta como tal.

Si después de este commit cambia el texto de una consulta canónica (su SHA-256 deja de coincidir), la evaluación de esa consulta se considera refutada y se reporta todo lo demás.
```

Son **tres** criterios (R1, R2, R3), más una cláusula general (un atributo sin correspondencia no refuta; cambio del SHA-256 refuta esa consulta). Este commit está en `experimento/odoo` y `experimento/desempate`, no en `master`.

**Coincide / No coincide:** si la tesis lista un número distinto de criterios o los numera distinto (p. ej., R1–R4) → **No coincide**. Numeración literal del repositorio: R1, R2, R3.

---

## Paso 4 — Colisión de DEC-39 a DEC-44

### 4.1 Entradas `DEC-39` en adelante de `docs/01-decisiones.md` en `origin/master`

El archivo tiene 92 entradas `### DEC-`; las de DEC-39 en adelante empiezan en la línea 713. Las entradas tienen `Decidido por` (con fecha) y `Estado`. Todas: **decidió el autor («el usuario (autor)»), «no inferido por el agente»**.

| DEC | Título | Fecha | Decidió | Estado |
|---|---|---|---|---|
| DEC-39 | Cada campo del contrato declara un tipo semántico, validado con un mapeo tolerante desde Postgres | 2026-09-26 | el autor, exploración CH-10 | firme |
| DEC-40 | La validación del mapeo es una acción explícita y su resultado se persiste | 2026-09-26 | el autor, exploración CH-10 | firme |
| DEC-41 | Registrar de nuevo el SQL de una entidad invalida su validación guardada | 2026-09-26 | el autor, exploración CH-10 | firme |
| DEC-42 | La validación del mapeo es solo estructural: consulta de cero filas | 2026-09-26 | el autor, exploración CH-10 | firme |
| DEC-43 | Una vista con columnas que el contrato no define no pasa la validación | 2026-09-26 | el autor, propuesta CH-10 | firme |
| DEC-44 | El resultado de la validación se guarda en columnas de `VistaCanonica` | 2026-09-26 | el autor, propuesta CH-10 | firme |
| DEC-45 | Los tipos Postgres fuera de la tabla de categorías no pasan la validación, con una pista de cast | 2026-09-26 | el autor, diseño CH-10 | firme |
| DEC-46 | Una automatización inaplicable y bloqueada a la vez se informa como inaplicable, con todos los motivos | 2026-09-26 | el autor, diseño CH-10 | firme |
| DEC-47 a DEC-60 | CH-11 (parámetros en consultas) — 14 entradas | 2026-09-27 | el autor, exploración (47–54) o propuesta (55–60) de CH-11 | firme |
| DEC-61 a DEC-73 | CH-12 (plantillas) — 13 entradas | 2026-09-27 | el autor, exploración (61–69) o propuesta (70–73) de CH-12 | firme |
| DEC-74 a DEC-80 | CH-13 (motor: planificación y ejecución) — 7 entradas | 2026-09-28 | el autor, exploración (74–77) o propuesta (78–80) de CH-13 | firme; DEC-80 además «aplicadas en CH-13» |
| DEC-81 a DEC-86 | CH-14 (condición y notificación) — 6 entradas | 2026-09-29 | el autor, exploración de CH-14 | firme; DEC-86 «firme, con addendum» |
| DEC-87 a DEC-92 | CH-15 (instrumentación de tiempos del alta) — 6 entradas | 2026-09-30 | el autor (DEC-87: exploración de CH-15) | firme |

Títulos de DEC-47 a DEC-92 (`grep -n -E "^### DEC-" docs/01-decisiones.md`):

- DEC-47 Los parámetros se escriben con nombre (`:nombre`) y se reescriben a `$n` al ejecutar · DEC-48 Los parámetros se declaran en la consulta guardada y en la ejecución suelta · DEC-49 Los parámetros tienen un vocabulario de tipos propio: texto, numero, booleano, fecha · DEC-50 Todo parámetro declarado es obligatorio; no hay valores por defecto · DEC-51 El valor de un parámetro se valida en dos capas: forma en la aplicación, tipo final en Postgres · DEC-52 La declaración de parámetros y la sustitución segura quedan reutilizables por la plantilla de CH-12 · DEC-53 Los parámetros declarados ocupan `$1…$n`; la paginación usa `$(n+1)` y `$(n+2)` · DEC-54 CH-11 no agrega parámetros a las vistas canónicas · DEC-55 La declaración de parámetros de una consulta guardada es una columna JSON en `ConsultaGuardada` · DEC-56 Un parámetro declarado que el SQL no usa se rechaza · DEC-57 Un marcador `:x` sin declarar en el SQL se rechaza · DEC-58 Un valor enviado para un nombre no declarado se rechaza · DEC-59 Un `$n` escrito a mano en el SQL del usuario se rechaza siempre · DEC-60 Formato de valor por tipo de parámetro.
- DEC-61 La plantilla es un catálogo global persistido · DEC-62 CH-12 incluye composición `WITH` y un endpoint de prueba · DEC-63 La plantilla declara explícitamente sus entidades canónicas · DEC-64 "Condición" no agrega campo en CH-12 · DEC-65 "Formato" es un enum con un único valor: `correo-html` · DEC-66 Tolerancia de frescura: minutos, guardada y no aplicada · DEC-67 La plantilla se vincula a `AUTOMATIZACIONES` (cierra DEC-22) · DEC-68 La plantilla se reemplaza en el lugar por id · DEC-69 CH-12 no escribe la consulta canónica de `reporte-diario` · DEC-70 Alias de cada vista compuesta: `v_<entidad>` · DEC-71 El endpoint de prueba exige validación aprobada de cada vista · DEC-72 La excepción de campos personales de M5 se posterga · DEC-73 `parametros` y `entidades` de la plantilla se guardan como JSON.
- DEC-74 La asociación plantilla-tenant para el motor vive en una entidad mínima nueva · DEC-75 El planificador corre dentro del proceso de la aplicación · DEC-76 El horario se expresa en cron estándar con una librería de cálculo de próximo disparo · DEC-77 Los horarios se interpretan en una zona horaria global configurada por variable de entorno · DEC-78 Las automatizaciones se crean por API con alcance de tenant y una consola mínima · DEC-79 Una automatización se detiene con un flag de activo · DEC-80 El registro de ejecuciones se lee por API con alcance de tenant y una vista en la consola.
- DEC-81 El correo se envía por SMTP con nodemailer, con Mailpit para desarrollo · DEC-82 El destinatario es una única dirección en la automatización · DEC-83 El resultado de la notificación se registra en una columna de `Ejecucion`; un envío fallido marca la ejecución como fallida · DEC-84 Sin filas no se envía; la degradación elegante cubre datos incompletos · DEC-85 El HTML del correo lo arma un renderizador genérico que reimplementa el diseño validado · DEC-86 Sin SMTP configurado, la automatización corre igual y registra que no se notificó.
- DEC-87 Las marcas de tiempo del alta se derivan con SQL versionado sobre columnas existentes · DEC-88 La marca de «conexión» es el registro de la conexión · DEC-89 Definición de las marcas restantes y agregación por conexión · DEC-90 El script de marcas del alta no lleva parámetro de tenant y se corre fuera de la aplicación · DEC-91 El script vive en `scripts/marcas-alta.sql` · DEC-92 Solo lectura del script de marcas: rol de prueba y transacción de solo lectura.

**Las «propuestas» del reporte diario no figuran en `docs/01-decisiones.md` de `master`:** los números DEC-39 a DEC-44 de `master` son las decisiones de CH-10 (tabla anterior).

### 4.2 Apariciones de `DEC-39` a `DEC-44` en las ramas de experimentos

```
$ git grep -n -E "DEC-(39|4[0-4])" origin/experimento/reporte-diario   → 21 líneas
$ git grep -n -E "DEC-(39|4[0-4])" origin/experimento/odoo             → 24 líneas
$ git grep -n -E "DEC-(39|4[0-4])" origin/experimento/desempate        → 24 líneas
```

`odoo` y `desempate` dan exactamente las mismas 24 líneas (`diff` vacío); `reporte-diario` las mismas 21 sin las 3 de `bitacora_odoo.md`. Por archivo:

| Archivo | `reporte-diario` | `odoo` | `desempate` |
|---|---|---|---|
| `docs/bitacora/bitacora_reporte_diario.md` | 16 | 16 | 16 |
| `docs/bitacora/bitacora_odoo.md` | 0 | 3 | 3 |
| `experimentos/reporte_diario/PREREGISTRO.md` | 1 | 1 | 1 |
| `experimentos/reporte_diario/salidas/p3_foodstore_vistas_input.sql` | 1 | 1 | 1 |
| `experimentos/reporte_diario/salidas/p3_saleor_vistas_input.sql` | 1 | 1 | 1 |
| `experimentos/reporte_diario/vistas/v_pedido_foodstore.sql` | 1 | 1 | 1 |
| `experimentos/reporte_diario/vistas/v_pedido_saleor.sql` | 1 | 1 | 1 |

En las ramas de experimentos no hay ninguna referencia a DEC-45 o superiores (`git grep -E "DEC-(4[5-9]|[5-9][0-9])" -- docs experimentos` no devuelve nada). `desempate` no tiene menciones propias en `bitacora_desempate.md`.

**Definiciones** (las «propuestas», en `docs/bitacora/bitacora_reporte_diario.md`, sección 7 «Propuestas de decisión (sin aplicar)», línea 496 en adelante; el texto dice «Numeradas desde DEC-39»):

| Línea | Definición |
|---|---|
| 500 | `### DEC-39 (propuesta) — Dominio canónico mínimo de pedido.estado` |
| 510 | `### DEC-40 (propuesta) — item_pedido.precioUnitario pasa a obligatorio` |
| 517 | `### DEC-41 (propuesta) — Etiquetas reporte-diario que la consulta no respalda` |
| 525 | `### DEC-42 (propuesta) — pedido.moneda en el reporte` |
| 534 | `### DEC-43 (propuesta) — Semántica de los montos` |
| 543 | `### DEC-44 (propuesta) — Tipo y zona de pedido.fechaCreacion` |
| 498 | texto introductorio: «Numeradas desde DEC-39. Se registran acá como **propuestas**…» |

**Menciones** (todas las demás, tal como figuran en `git grep`):

| Archivo:línea | Qué menciona |
|---|---|
| `bitacora_reporte_diario.md:151` | DEC-44 propuesta (tipo de `fechaCreacion`) |
| `bitacora_reporte_diario.md:152` | «(DEC-39 propuesta)» (estados de Food Store) |
| `bitacora_reporte_diario.md:197` | «(ver DEC-39 propuesta)» (estados de Saleor) |
| `bitacora_reporte_diario.md:200` | «Ver 6 y DEC-42» (moneda) |
| `bitacora_reporte_diario.md:215` | «No cumple la propuesta DEC-39» |
| `bitacora_reporte_diario.md:426` | «Ver 6 y DEC-42» (advertencia: la facturación suma dos monedas) |
| `bitacora_reporte_diario.md:484` | «Ver DEC-40» |
| `bitacora_reporte_diario.md:564` | «(DEC-42)» |
| `bitacora_reporte_diario.md:566` | «no cumple DEC-39» |
| `bitacora_odoo.md:228` | «DEC-39 propuesta» (fila de estado) |
| `bitacora_odoo.md:242` | «igual que DEC-39 a DEC-44 en el P12» |
| `bitacora_odoo.md:272` | «como propone DEC-44 en el P12» |
| `experimentos/reporte_diario/PREREGISTRO.md:85` | «Se asume la **propuesta DEC-39**» |
| `…/salidas/p3_foodstore_vistas_input.sql:4` | comentario «propuesta DEC-39» |
| `…/salidas/p3_saleor_vistas_input.sql:5` | comentario «propuesta DEC-39» |
| `…/vistas/v_pedido_foodstore.sql:3` | comentario «propuesta DEC-39» |
| `…/vistas/v_pedido_saleor.sql:4` | comentario «propuesta DEC-39» |

(Las líneas 152, 197 y 426 están cortadas en la tabla; el texto completo sale de `git grep -n -E "DEC-(39|4[0-4])" origin/experimento/reporte-diario -- docs/bitacora/bitacora_reporte_diario.md`.)

**Colisión confirmada:** en `master`, DEC-39 a DEC-44 son decisiones firmes de CH-10 (tipos semánticos, validación del mapeo); en las ramas de experimentos, los mismos números nombran propuestas del reporte diario (estado de pedido, moneda, tipo de fecha, etc.). Las dos series no tienen nada que ver entre sí.

### 4.3 Esquema de renombrado propuesto (no aplicado)

**Este paso no renombró nada.** Propuesta, en el mismo orden que usa la tesis:

| Hoy en las ramas de experimentos | Pasaría a |
|---|---|
| `DEC-39 (propuesta)` — Dominio canónico mínimo de `pedido.estado` | `PRD-1` |
| `DEC-40 (propuesta)` — `item_pedido.precioUnitario` obligatorio | `PRD-2` |
| `DEC-41 (propuesta)` — Etiquetas `reporte-diario` no respaldadas | `PRD-3` |
| `DEC-42 (propuesta)` — `pedido.moneda` en el reporte | `PRD-4` |
| `DEC-43 (propuesta)` — Semántica de los montos | `PRD-5` |
| `DEC-44 (propuesta)` — Tipo y zona de `pedido.fechaCreacion` | `PRD-6` |

Reglas de reemplazo: cada ocurrencia de `DEC-3x/4x` **que se refiera a una propuesta del reporte diario** se sustituye por el `PRD-n` correspondiente. **No se puede hacer un reemplazo ciego del patrón**: dos menciones en `bitacora_odoo.md` necesitan revisión humana. En la línea 242 «igual que DEC-39 a DEC-44 en el P12» sería «igual que PRD-1 a PRD-6 en el P12», y en la 272 «como propone DEC-44» sería «como propone PRD-6». Las menciones a decisiones reales de `master` (p. ej., a CH-10) no existen en estas ramas (ver 4.2), así que no hay riesgo de tocar una decisión real.

**Archivos que habría que tocar en cada rama** (mismos 6 archivos en las tres; `bitacora_odoo.md` solo en `odoo` y `desempate`):

1. `docs/bitacora/bitacora_reporte_diario.md` — 16 líneas (en `reporte-diario`, `odoo`, `desempate`).
2. `docs/bitacora/bitacora_odoo.md` — 3 líneas (en `odoo`, `desempate`).
3. `experimentos/reporte_diario/PREREGISTRO.md` — 1 línea (85). **Es un documento de preregistro**: tocarlo después del hecho altera un registro fechado. Recomendación: **no renombrar ahí** y dejar una nota de equivalencia en la bitácora.
4. `experimentos/reporte_diario/salidas/p3_foodstore_vistas_input.sql` — 1 comentario (4). Es una **salida registrada** (entrada de una corrida); no modificarla.
5. `experimentos/reporte_diario/salidas/p3_saleor_vistas_input.sql` — 1 comentario (5). Ídem.
6. `experimentos/reporte_diario/vistas/v_pedido_foodstore.sql` — 1 comentario (3).
7. `experimentos/reporte_diario/vistas/v_pedido_saleor.sql` — 1 comentario (4).

Los archivos 3, 4 y 5 son registros de corridas; los 6 y 7 son SQL de los experimentos (cambiarían solo un comentario, pero el encargo prohíbe tocarlos hoy). Los hashes SHA-256 preregistrados (`PREREGISTRO.md` de `reporte_diario` y de `odoo`) cubren `c1_ventas.sql`, `c2_ranking.sql`, `c2_ranking_top5.sql`, `c3_estados.sql` y `04_consulta_canonica.sql`: **ninguno de los archivos de la lista lo altera** (`v_pedido_*.sql` no figura en esas listas de hash). Renombrar en las ramas exige commits nuevos en cada una de las tres (están apiladas: `desempate` contiene a `odoo`, que contiene a `reporte-diario`), o un *rebase* que cambiaría los hashes `0e80098`, `c3ee7b4` y `d06b7ad` que la tesis cita. Alternativa que no toca las ramas: dejarlas como están y agregar a la tesis y al README una tabla de equivalencias `DEC-39…44 (ramas de experimentos) ↔ PRD-1…6`. Decide el autor.

---

## Paso 5 — README y raíz del repositorio

Rama: `chore/readme-y-raiz`, creada con `git switch -c chore/readme-y-raiz --no-track origin/master` (parte de `9a0ca4b`; el `master` local estaba desactualizado, ver «Hallazgo previo»). Publicada con `git push -u origin chore/readme-y-raiz`, **sin fusionar**. El hash final no se puede escribir acá sin cambiarlo: es el de la punta de la rama (`git rev-parse origin/chore/readme-y-raiz`); el commit con README y bitácora es `76c751a`.

### 5.1 README

Se agregó en `README.md` la sección «Versión evaluada en la tesis», con: la etiqueta `congelamiento-tesis-2026-09-24` y su commit `a1704bc` con enlaces a GitHub; la aclaración de que `master` siguió avanzando y de que la tesis evalúa solo el estado etiquetado y los experimentos de su Tabla 3.3; las tres ramas de experimentos con su último commit y estado (no ancestros de `master`, sin fusionar); y la fecha de corte (2026-09-30 20:38:31 −03:00) y el `origin/master` en ese momento (`9a0ca4b`). No se tocó nada más del README. (Observación: la línea 3 del README sigue diciendo «Estado actual: **R0 completo** (CH-01 a CH-05)»; está desactualizada, pero arreglarla excede el encargo.)

### 5.2 Raíz del repositorio

```
$ git ls-tree --name-only master          # idéntico a origin/master
.agents  .atl  .dockerignore  .env.example  .gitignore  200  AGENTS.md  Dockerfile  README.md
docker-compose.yml  docker-entrypoint.sh  docs  files.zip  openspec  package-lock.json  package.json
prisma.config.ts  prisma  scripts  skills-lock.json  src  tsconfig.json
```

(`git ls-tree --name-only origin/master` da la misma lista de 22 entradas.)

| Entrada | Clasificación | Evidencia / propuesta |
|---|---|---|
| `.dockerignore`, `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh` | necesaria | Entorno de ejecución. |
| `.env.example`, `.gitignore` | necesaria | Configuración (sin secretos, regla 7). |
| `package.json`, `package-lock.json`, `tsconfig.json`, `prisma.config.ts` | necesaria | Configuración del proyecto. |
| `src/`, `prisma/`, `scripts/` | necesaria | Código y esquema. |
| `docs/`, `openspec/` | necesaria | Documentación viva y artefactos SDD. |
| `AGENTS.md`, `README.md` | necesaria | Documentación viva. |
| `.agents/`, `.atl/`, `skills-lock.json` | **dudosa** | Herramientas de agentes (`.agents/skills/fastify-best-practices/…`, `.atl/skill-registry.md` y caché, `skills-lock.json`). No son del producto. Proponer: **dejarlas** si el autor quiere que el agente las tenga; si no, moverlas a `.gitignore`. Decide el autor. |
| **`200`** | **sobrante** | Archivo **vacío** (0 bytes, `git cat-file -s` → 0), agregado por accidente en el commit `5be9714` «CH-006 Tenants y aislamiento» (17/09). Proponer **borrar** (`git rm 200`). |
| **`files.zip`** | **sobrante** | 14504 bytes, agregado en `1f9fbcb` (CH-01, 15/09). Contiene cinco archivos de `docs` (`00-contexto.md`, `01-decisiones.md`, `02-mapa-de-changes.md`, `_plantilla.md`, `mapa-historias.md`) con fecha 2026-09-15 17:32: son **versiones del 15/09** de los documentos que hoy viven en `docs/` (p. ej. `01-decisiones.md` mide 6214 bytes en el zip, y hoy el archivo tiene 92 entradas DEC). Proponer **borrar** (`git rm files.zip`); el historial lo conserva. |
| `prisma` (carpeta) vs. carpeta `prisma;C` | **sobrante (no versionado)** | `prisma;C` es una carpeta **vacía** del disco local (2026-09-15 19:45), residuo de un comando de consola mal escrito; **no está versionada**. Proponer borrar del disco, no del repositorio. |
| `0`, `run` | **sobrante (no versionados)** | Archivos **vacíos** (0 bytes) en el disco local, aparecen como `??` en `git status`. No están en el repositorio. Borrar del disco a criterio del autor. |
| `experimentos/` (solo en el disco local) | **sobrante local / ignorado** | Carpeta vacía `experimentos/odoo/` ignorada por git (aparece en `git status --ignored`). En las ramas de experimentos hay una carpeta `experimentos/` versionada con contenido; en `master` no existe. No borrar sin OK del autor. |

**Propuesta:** `git rm 200 files.zip` en un commit aparte. No se hizo. Los residuos locales (`0`, `run`, `prisma;C`) se mencionan para que el autor decida.

---

## Paso 6 — Figura 5.3 de la tesis

**No se encontró el archivo fuente. Paso detenido.**

```
$ git ls-tree -r --name-only <rama> | grep -i -E "\.(png|jpe?g|svg|drawio|puml|plantuml|mmd|dot|vsdx|excalidraw|pptx|pdf|gif|webp)$|fig|diagrama|uml"
```

Se ejecutó sobre `origin/master` y las tres ramas de experimentos: solo devuelve `openspec/config.yaml`, `prisma.config.ts`, `src/config.ts`, `src/config.test.ts`, `tsconfig.json` y `.agents/skills/fastify-best-practices/rules/configuration.md`, que coinciden por contener «fig» en «config»: **no son figuras**. En la historia completa (`git log --all --diff-filter=A --name-only`) no hay ningún archivo de imagen ni de diagramación. En el árbol de trabajo (`find . -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.svg" -o -iname "*.drawio" -o -iname "*.puml" -o -iname "*.vsdx" -o -iname "*.mmd" \)`, sin `node_modules` ni `.git`) y en `OneDrive/Documentos` (hasta 4 niveles) tampoco. `files.zip` contiene solo Markdown. La tesis y la Figura 5.1 tampoco están en el repositorio.

**No se creó `docs/figuras/fig-5-3-corregida/`.** Lo único que se puede verificar desde el repositorio es el punto 4 del encargo (rangos de cambios):

```
$ git show congelamiento-tesis-2026-09-24:docs/02-mapa-de-changes.md | grep -n -E "CH-(0[89]|1[0-9])"
45:| CH-09 | Mapeo de esquema por tenant | M2 | Vistas canónicas registradas o generadas por tenant |
46:| CH-10 | Validación de mapeo | M3, M4 | …
47:| CH-11 | Parámetros en consultas | B3 | Por parámetros del driver, nunca concatenación |
48:| CH-12 | Plantillas de automatización | D1 | Consulta + parámetros + condición + formato + tolerancia de frescura |
49:| CH-13 | Motor: planificación y ejecución | X1, X2 | Planificador por horario. Registro de ejecución con inicio, fin, duración, filas, estado |
50:| CH-14 | Motor: condición y notificación por correo | X3, N1, N2 | Sin filas no se envía. Reutilizar el HTML ya validado. Degradación elegante sin datos |
51:| CH-15 | Instrumentación de tiempos de alta | G1 | …
52:| CH-16 | Mapeo del segundo esquema | — | …
```

- Planificador: **CH-13** (X1, X2). Plantillas: **CH-12**. Condición y notificación: **CH-14**. Parámetros: **CH-11**. «CH-11 a CH-13» **No coincide** con el rótulo del planificador: CH-11 son parámetros en consultas; el planificador es solo CH-13.
- Además: en la etiqueta (24/09) CH-12, CH-13 y CH-14 **no estaban iniciados** (auditoría, fila 5) y `src/` no tenía planificador, plantillas ni correo (fila 6). Un componente «Planificador» dibujado como existente choca con la leyenda «Estado etiquetado al 24/09/2026». Decisión del autor.

Los puntos 1, 2, 3 y 5 del encargo (sentido de la flecha, «Agente saliente», leyenda, Figura 5.1) no se pueden hacer ni verificar sin el fuente.

---

## Resumen para la tesis

### Fechas de corte y hashes a citar

| Dato | Valor |
|---|---|
| Fecha de corte | **2026-09-30 20:38:31 −03:00** |
| Etiqueta | `congelamiento-tesis-2026-09-24` → `a1704bcec01132f79f5eddfc66d9f6125bde6a02` (2026-09-24 15:35:34 −03:00) |
| `origin/master` | `9a0ca4bfb01cdd82700dfd9d1cb29170f4e8a3b5` (2026-09-30 15:09:03 −03:00) |
| `master` local (desactualizado) | `a4d78dbb73dea6ffba5eff9329a9a1034ba99436` (2026-09-29 10:40:47 −03:00) |
| Commits etiqueta → `origin/master` | 133 (41 fusiones, 92 sin fusión); → `master` local: 100 |
| `git diff --shortstat` etiqueta → `origin/master` | 183 archivos, +28019 −173 (190, +28514 −668 con `--no-renames`) |
| `git diff --shortstat` etiqueta → `master` local | 149 archivos, +21087 −171 (156, +21582 −666 con `--no-renames`) |
| `experimento/reporte-diario` | `0e80098` (no ancestro de `master`) |
| `experimento/odoo` | `c3ee7b4` (no ancestro de `master`) |
| `experimento/desempate` | `d06b7ad` (no ancestro de `master`) |
| Preregistro de Odoo | `385b170` (2026-09-26 13:21:00 −03:00) |
| `npm test` (`TEST_DB_PORT=5434`) | 633 pruebas, 93 suites, 632 pasan, 1 falla, 0 salteadas |

### Puntos que la tesis debe corregir (No coincide)

1. «Cinco commits de bitácoras» después de la etiqueta: son 133 en `origin/master` (100 en el `master` local).
2. Descripción de `master`: hay código nuevo (45 archivos de `src/`, 11748 inserciones), modelos nuevos de datos y un planificador con notificación por correo; `src/contrato.ts` también cambió.
3. «El prototipo no ejecuta ninguna automatización»: cierto solo en la etiqueta.
4. Sección 6.2: la comparación de CH-16b es por `id::text`, no fila a fila en tres columnas.
5. DEC-39 a DEC-44: duplicados entre `docs/01-decisiones.md` (decisiones de CH-10) y las ramas de experimentos (propuestas del reporte diario).
6. Rótulo «CH-11 a CH-13» del planificador: CH-11 es parámetros; el planificador es CH-13.

### Dudas para el autor

1. **¿`master` local o `origin/master`?** El número del tribunal (149 archivos) corresponde al local, que está 33 commits atrás de GitHub. ¿Cuál quiere citar? (Este documento da ambos.)
2. **Fallo de `npm test`:** `planificador.test.ts` 4.5 falla 2/2 en corrida completa y pasa aislado. ¿Se investiga antes de citar «632/633»?
3. **Sección 6.2:** la consulta de la diferencia simétrica de CH-16b no está guardada; la original no calcula la existencia del insumo limitante. ¿Se reconstruye y se corre (requiere crear vistas en la base real, una escritura) o se corrige la tesis?
4. **Renombrado DEC→PRD:** ¿se aplica en las ramas (cambiaría los hashes `0e80098`, `c3ee7b4`, `d06b7ad` que la tesis cita y tocaría `PREREGISTRO.md` y las salidas registradas) o se deja una tabla de equivalencias?
5. **Raíz:** ¿se aprueba `git rm 200 files.zip`? ¿Se mantienen `.agents/`, `.atl/` y `skills-lock.json`?
6. **Figuras 5.1 y 5.3:** no están en el repositorio; hay que darme el archivo fuente (o el lugar donde está) para el paso 6.
7. **Figura 5.3:** ¿«Planificador» debe rotularse «CH-13» solamente?, y ¿se dibuja como existente si la leyenda dice «estado etiquetado»?
8. El README sigue diciendo «Estado actual: R0 completo (CH-01 a CH-05)»; ¿se actualiza en otra rama?

---

## Apéndice A — `git log --format='%cI %h %s' congelamiento-tesis-2026-09-24..origin/master` (133 commits)

```
2026-09-30T15:09:03-03:00 9a0ca4b Merge pull request #41 from AgusReka/ch15/1-instrumentacion-de-tiempos-de-alta
2026-09-30T15:08:44-03:00 5489ecc docs(ch15): bitacora de instrumentacion de tiempos del alta
2026-09-30T15:08:44-03:00 87c3e8e CH-15: script de marcas de tiempo del alta y su test (DEC-87..92)
2026-09-30T15:08:43-03:00 087b085 docs(ch15): DEC-87..92 y artefactos SDD archivados de CH-15
2026-09-29T22:08:42-03:00 6c729dc sdd-archive: CH-14 close and archive
2026-09-29T22:05:55-03:00 7f72c00 docs(ch14): bitacora, verify report and task 4.8 port note
2026-09-29T21:56:32-03:00 f6d9026 docs(ch14): mark slice 6 tasks done and record apply progress
2026-09-29T21:55:34-03:00 63cc7a8 CH-14: la consola pide el destinatario y muestra la notificacion de cada corrida
2026-09-29T21:53:48-03:00 0d3fc75 CH-14: destinatario al crear y notificacion en el listado de corridas (DEC-82, DEC-83)
2026-09-29T21:48:00-03:00 3ddede1 docs(ch14): mark slice 5b tasks done and record apply progress
2026-09-29T21:47:18-03:00 e3fa12a CH-14: T2 prueba que cada tenant recibe solo sus filas en su destinatario (regla 2)
2026-09-29T21:47:18-03:00 770df6f CH-14: el servidor arma el notificador SMTP al arrancar (DEC-86, N1)
2026-09-29T21:11:26-03:00 271b430 docs(ch14): mark slice 5a tasks done and record apply progress (5a1/5a2 split)
2026-09-29T21:10:37-03:00 53c6cbc CH-14: fallos del envio en el planificador sin fila abierta ni fugas (DEC-83, R1)
2026-09-29T21:09:51-03:00 3f019eb CH-14: paso de notificacion del planificador y cierre unico (X3, N1, DEC-83)
2026-09-29T20:59:53-03:00 dfca3a4 docs(ch14): mark slice 4 tasks done and record apply progress (4a/4b/4c split)
2026-09-29T20:58:31-03:00 f34c976 CH-14: prueba en vivo opcional del notificador contra Mailpit (DEC-81)
2026-09-29T20:56:54-03:00 9fffc22 CH-14: limite externo del envio y notificador SMTP de produccion (R2, DEC-86)
2026-09-29T20:56:25-03:00 576f0c5 CH-14: envio del notificador: mensaje, categorias cerradas y opciones endurecidas (DEC-81)
2026-09-29T20:48:00-03:00 2d4016b CH-14: lectura de SMTP_* del notificador (leerSmtp, DEC-86 y addendum)
2026-09-29T20:43:50-03:00 c4cfc84 docs(ch14): mark slice 3 tasks done and record apply progress (3a/3b split)
2026-09-29T20:40:17-03:00 6ac0ea8 CH-14: cierre con notificacion y tipos de cierre ampliados (R1, R3, DEC-83)
2026-09-29T20:40:06-03:00 568a6eb CH-14: precedencia pura de la notificacion (decidirNotificacion, DEC-83, DEC-84, DEC-86)
2026-09-29T20:32:56-03:00 2a3dca8 CH-14: avance de apply de la fase 2 (division 2a/2b)
2026-09-29T20:32:09-03:00 b45c111 CH-14: composicion pura del correo: HTML, texto y avisos (N1, N2, DEC-84, DEC-85)
2026-09-29T20:31:34-03:00 3b1043b CH-14: auxiliares puros del correo: destinatario, celdas, escape y asunto (DEC-82, DEC-84, DEC-85)
2026-09-29T20:18:25-03:00 f40d93c CH-14: avance de apply de la fase 1
2026-09-29T20:17:31-03:00 b05d60e CH-14: la prueba de columnas de Ejecucion incluye notificacion
2026-09-29T20:16:25-03:00 c1130c2 CH-14: servicio Mailpit bajo el perfil correo y variables SMTP_* (DEC-81, DEC-86)
2026-09-29T20:15:46-03:00 6c4e046 CH-14: presupuesto de envio SMTP_TIMEOUT_MS en la configuracion (R2)
2026-09-29T20:14:40-03:00 975c7aa CH-14: columnas destinatario y notificacion (DEC-82, DEC-83)
2026-09-29T20:13:34-03:00 b208e00 CH-14: dependencia nodemailer fijada en 10.0.12 (DEC-81)
2026-09-29T20:12:25-03:00 ce5bea5 CH-14: planning artifacts and decisions DEC-81..DEC-86
2026-09-29T10:40:47-03:00 a4d78db Merge pull request #40 from AgusReka/ch13/7-verify-archivo
2026-09-29T10:40:38-03:00 1b453cb Merge pull request #39 from AgusReka/ch13/6b-consola-alta
2026-09-29T10:40:28-03:00 8601b1c Merge pull request #38 from AgusReka/ch13/6a-consola-lectura
2026-09-29T10:40:18-03:00 4b7f6b7 Merge pull request #37 from AgusReka/ch13/5-rutas-ejecuciones-t2
2026-09-29T10:40:08-03:00 eb3151e Merge pull request #36 from AgusReka/ch13/4b-planificador-ciclo
2026-09-29T10:39:57-03:00 d3ae07b Merge pull request #35 from AgusReka/ch13/4a-planificador
2026-09-29T10:39:47-03:00 3d78c17 Merge pull request #34 from AgusReka/ch13/3b-consulta-desactivar
2026-09-29T10:39:38-03:00 7400e8b Merge pull request #33 from AgusReka/ch13/3a-alta-automatizacion
2026-09-29T10:39:28-03:00 5fca82a Merge pull request #32 from AgusReka/ch13/2b-cierre-ejecucion
2026-09-29T10:39:17-03:00 84b9345 Merge pull request #31 from AgusReka/ch13/2a-cron-ventana
2026-09-29T10:39:06-03:00 1483d6e Merge pull request #30 from AgusReka/ch13/1-esquema-aislamiento-config
2026-09-29T10:22:32-03:00 6db5f4d CH-13: bitacora del change
2026-09-29T10:21:55-03:00 68c20a5 CH-13: archivo del change y specs principales actualizadas
2026-09-29T10:19:26-03:00 fd77c56 CH-13: informe de verificacion (PASS WITH WARNINGS)
2026-09-29T10:08:23-03:00 5422970 CH-13: formulario de alta de automatizaciones en la consola (6b)
2026-09-29T10:05:18-03:00 fa4ffde CH-13: seccion Automatizaciones de la consola: listado, desactivacion y ejecuciones (6a)
2026-09-29T09:56:49-03:00 91c2ca8 CH-13: listado de ejecuciones por automatizacion y barrido T2 ampliado (5)
2026-09-29T09:51:12-03:00 253a11a CH-13: avance de apply de la fase 4 (4b)
2026-09-29T09:50:46-03:00 4c6a60f CH-13: ciclo del planificador, captura por corrida y arranque con el servidor (4b)
2026-09-29T09:41:05-03:00 42ab413 CH-13: tick del planificador con vencimiento, contexto por tenant y compuerta (4a)
2026-09-29T09:35:09-03:00 0a8f987 CH-13: consulta y desactivacion de automatizaciones (3b)
2026-09-28T21:21:11-03:00 9d1f0b1 CH-13: alta de automatizaciones por tenant (3a)
2026-09-28T20:52:45-03:00 52e1e8b CH-13: avance de apply de la fase 2
2026-09-28T20:52:45-03:00 b6f7f42 CH-13: cierre de una ejecucion con categorias cerradas (X2)
2026-09-28T20:52:36-03:00 85e4b87 CH-13: validez de cron y ventana de vencimiento (DEC-76, DEC-77)
2026-09-28T20:43:32-03:00 21e76ad CH-13: avance de apply de la fase 1
2026-09-28T20:43:12-03:00 bbc9100 CH-13: zona horaria global de las automatizaciones (DEC-77)
2026-09-28T20:43:11-03:00 c928e9a CH-13: modelos Automatizacion y Ejecucion aislados por tenant (DEC-74, X2)
2026-09-28T20:43:10-03:00 c12912f CH-13: dependencia cron-parser fijada en 5.10.1 (DEC-76)
2026-09-28T20:37:30-03:00 b82bd03 CH-13: planning artifacts and decisions DEC-74..DEC-80
2026-09-28T12:35:19-03:00 985a82a Merge pull request #29 from AgusReka/docs/bitacora-ch09
2026-09-28T12:35:03-03:00 a85b514 CH-09: bitacora del change
2026-09-28T12:33:42-03:00 23184b3 Merge pull request #28 from AgusReka/ch12/6-verify-archivo
2026-09-28T12:33:35-03:00 c58da9b Merge pull request #27 from AgusReka/ch12/5b-ejecucion-prueba
2026-09-28T12:33:27-03:00 3b9b9b6 Merge pull request #26 from AgusReka/ch12/5a-compuerta-prueba
2026-09-28T12:33:18-03:00 feb8658 Merge pull request #25 from AgusReka/ch12/4-reemplazo
2026-09-28T12:33:10-03:00 b9b7c10 Merge pull request #24 from AgusReka/ch12/3b-catalogo-consulta
2026-09-28T12:33:02-03:00 1b78311 Merge pull request #23 from AgusReka/ch12/3a-catalogo-alta
2026-09-28T12:32:55-03:00 061a483 Merge pull request #22 from AgusReka/ch12/2-plantillas-puro
2026-09-28T12:32:46-03:00 f5b6192 Merge pull request #21 from AgusReka/ch12/1-esquema-exencion
2026-09-28T12:32:38-03:00 c6d9780 Merge pull request #20 from AgusReka/ch11/8-verify-archivo
2026-09-28T12:32:31-03:00 8bb37a7 Merge pull request #19 from AgusReka/ch11/7-consola-errores
2026-09-28T12:32:22-03:00 2cc2379 Merge pull request #18 from AgusReka/ch11/6-consola
2026-09-28T12:32:13-03:00 2c06e5d Merge pull request #17 from AgusReka/ch11/5-persistencia-guardadas
2026-09-28T12:32:06-03:00 4ba7dc4 Merge pull request #16 from AgusReka/ch11/4-ejecucion
2026-09-28T12:31:57-03:00 62dd023 Merge pull request #15 from AgusReka/ch11/3-valores-preparacion
2026-09-28T12:31:49-03:00 1ceb868 Merge pull request #14 from AgusReka/ch11/2-validacion-preparacion
2026-09-28T12:31:41-03:00 42f284f Merge pull request #13 from AgusReka/ch11/1-escaner-reescritura
2026-09-28T12:31:33-03:00 08e32df Merge pull request #12 from AgusReka/ch10/6-archivo
2026-09-28T12:31:25-03:00 be2759d Merge pull request #11 from AgusReka/ch10/5-barrido-t2
2026-09-28T12:31:17-03:00 6c90c84 Merge pull request #10 from AgusReka/ch10/4b-casos-borde
2026-09-28T12:31:09-03:00 dff195d Merge pull request #9 from AgusReka/ch10/4a-rutas-validacion
2026-09-28T12:31:02-03:00 2d2f0d0 Merge pull request #8 from AgusReka/ch10/3-logica-validacion
2026-09-28T12:30:53-03:00 024b247 Merge pull request #7 from AgusReka/ch10/2-sesion-y-columnas
2026-09-28T12:30:45-03:00 c4b81a5 Merge pull request #6 from AgusReka/ch10/1-contrato-tipos
2026-09-28T12:01:34-03:00 fcd5a18 CH-12: archivo del change, specs actualizadas y bitacora
2026-09-28T11:55:59-03:00 dc10011 CH-12: checkpoint final, verify report (PASS WITH WARNINGS) y ajuste de redaccion de la spec de mapeo
2026-09-28T11:43:53-03:00 c1e21b9 CH-12: ejecucion de la ruta de prueba de plantillas sobre las vistas compuestas (5b)
2026-09-28T11:10:01-03:00 6b73b58 CH-12: compuerta de la ruta de prueba de plantillas (5a)
2026-09-28T11:03:40-03:00 ccfb4c9 CH-12: reemplazo en el lugar de plantillas y cierre de DEC-22
2026-09-27T22:59:10-03:00 41c4d40 CH-12: listado y consulta por id del catalogo de plantillas
2026-09-27T22:58:05-03:00 75afed3 CH-12: alta de plantillas en el catalogo global, con validacion al guardar
2026-09-27T22:49:07-03:00 81b6f9f CH-12: modulo puro de plantillas, compuerta de vistas y composicion WITH
2026-09-27T22:43:53-03:00 5ddf411 CH-12: modelo Plantilla global y exencion exacta de sus rutas de catalogo
2026-09-27T22:38:39-03:00 75d51ba CH-12: decisiones DEC-61..DEC-73 y artefactos de planificacion
2026-09-27T20:41:06-03:00 257b100 CH-11: archivo del change, specs actualizadas y bitacora
2026-09-27T20:34:53-03:00 7ff6bbf CH-11: checkpoint final y verify report (PASS)
2026-09-27T20:21:08-03:00 abced69 CH-11: errores legibles de parametros en la consola
2026-09-27T16:30:18-03:00 980a682 CH-11: parametros en la consola (B3)
2026-09-27T16:23:16-03:00 c320d9d CH-11: parametros en la consulta guardada (DEC-55)
2026-09-27T16:18:41-03:00 30ff753 CH-11: ejecucion con parametros y numeracion de la paginacion (DEC-48, DEC-53)
2026-09-27T16:13:41-03:00 90c64fe CH-11: validacion de valores y sentencia preparada (DEC-50, DEC-58, DEC-60)
2026-09-27T16:12:03-03:00 dce3d6b CH-11: validacion de declaracion y analisis estatico de la sentencia (DEC-49, DEC-56, DEC-57, DEC-59)
2026-09-27T15:58:41-03:00 c186ebc CH-11: escaner de parametros y reescritura a $n (DEC-47, DEC-59)
2026-09-27T15:54:22-03:00 213fdbd CH-11: exploracion, propuesta, specs, diseno y tareas; DEC-47 a DEC-60
2026-09-27T14:46:21-03:00 7cc19c7 CH-10: archivo del change, specs actualizadas y bitacora
2026-09-27T14:36:39-03:00 4217d8d CH-10: verify report y campos tipoObservado/pista en el diseno
2026-09-27T14:25:42-03:00 28c4447 CH-10: barrido T2 de las rutas de validacion de mapeo y avance de aplicacion
2026-09-27T14:23:08-03:00 2ff90db CH-10: casos borde de la validacion (savepoint, cero filas, CTE, permisos, conexion, escritura obsoleta)
2026-09-27T14:22:29-03:00 0b0f099 CH-10: rutas de validacion de mapeo, registro en el servidor y reinicio al re-registrar
2026-09-27T14:16:04-03:00 5959f0b CH-10: diagnostico de mapeo por campo e informe de aplicabilidad (logica pura)
2026-09-27T14:12:22-03:00 c3886a4 CH-10: sesion de solo lectura reutilizable, sondeo de estructura y columnas de validacion
2026-09-27T14:07:21-03:00 6d1e4be CH-10: tipo semantico por campo del contrato canonico (DEC-39)
2026-09-27T14:03:59-03:00 69e399a CH-10: exploracion, propuesta, specs, diseno y tareas; DEC-39 a DEC-46
2026-09-26T21:33:03-03:00 33387bf Merge pull request #5 from AgusReka/ch09/3-archivo
2026-09-26T21:32:57-03:00 01750cf Merge pull request #4 from AgusReka/ch09/2-verify
2026-09-26T21:32:50-03:00 68c5f40 Merge pull request #3 from AgusReka/ch09/1-barrido-t2
2026-09-26T21:28:52-03:00 65a625f CH-09: archivo del change y specs actualizadas
2026-09-26T21:24:13-03:00 6994924 CH-09: verify report
2026-09-26T21:06:53-03:00 c1ac5f6 CH-09: barrido T2 de vistas canonicas y verificaciones finales
2026-09-26T20:34:05-03:00 91827ee Merge pull request #2 from AgusReka/docs/mapa-experimentos-ch16
2026-09-26T20:27:22-03:00 4423393 Mapa de changes: experimentos CH-16b, CH-16c y CH-16d (D-7)
2026-09-26T20:18:40-03:00 e903967 Merge pull request #1 from AgusReka/auditoria/mapa-cambios
2026-09-26T19:52:34-03:00 f034405 Auditoria: nota sobre la publicacion de las ramas de experimentos
2026-09-26T19:37:09-03:00 1bcf01d Auditoria: mapa de cambios contra la tesis y empates en Food Store
2026-09-25T13:08:07-03:00 a6e605a CH-16d: segunda automatizacion (stock fisico) y composicion con WITH
2026-09-24T23:35:20-03:00 333d34c Bitacora: columnas con datos personales en food_store
2026-09-24T23:11:03-03:00 43c9138 Bitacora de reproduccion: segunda ronda de WF-01a, WF-01c y WF-03
2026-09-24T22:52:06-03:00 0bb9a3d Matriz de correspondencias: nota de receta_componente.productoId como decidida
2026-09-24T22:48:09-03:00 8081363 Matriz de correspondencias: reclasificacion con el criterio refinado
```
