# Bitácora — CH-15: Instrumentación de tiempos del alta

**Fecha de inicio:** 2026-09-30 (exploración, decisiones, propuesta, specs, diseño, tareas y apply)
**Fecha de cierre:** pendiente (falta verify y archive)
**Tiempo invertido:** sesión asistida por agente (Claude Code), ciclo SDD. **Completar con el tiempo real percibido antes de citar este dato en la tesis.**

> Se escribe durante el apply (2026-09-30), apoyada en los artefactos del change (`openspec/changes/CH-15-onboarding-timing-instrumentation/`) y en DEC-87 a DEC-92.

---

## Qué se construyó

G1 pide medir cuánto tardó cada etapa del alta de un tenant (conexión, mapeo, validación, primera ejecución). Las columnas ya existían; nada derivaba ni registraba las marcas.

- **Script** `scripts/marcas-alta.sql` (DEC-87, DEC-91): una sola sentencia `SELECT`, sin parámetros (DEC-90), que devuelve una fila por `Conexion` con estas columnas: `tenant_id`, `tenant_activo`, `conexion_id`, `alta_inicio`, `conexion_registrada`, `mapeo_inicio`, `mapeo_fin`, `validacion_ultima`, `validacion_estado`, `automatizacion_creada`, `primera_ejecucion`, `primera_ejecucion_estado`, `primera_ejecucion_fase` y `primera_ejecucion_ok` (DEC-88, DEC-89). Una etapa no alcanzada es `null`. Incluye los tenants desactivados (DEC-14).
- **Test** `src/marcas-alta.test.ts`: casos estáticos (ningún módulo de `src/` referencia el script; sin `$n` ni `\`; una sola sentencia de lectura) y una suite en vivo que corre el archivo tal cual, como consulta con nombre, dentro de `BEGIN READ ONLY`, con el rol descartable `ch15_lector`, que solo tiene `SELECT` sobre las columnas que lee (DEC-92). La suite se saltea si no hay base.
- Sin migración, sin ruta, sin panel de consola y sin cambios en el motor ni en el planificador.

## Decisiones tomadas

| Decisión | Qué fija |
|---|---|
| DEC-87 | SQL versionado sobre columnas existentes, con salidas fechadas |
| DEC-88 | La marca de conexión es `Conexion.creadaEn` (registro) |
| DEC-89 | Marcas restantes y una fila por conexión |
| DEC-90 | Sin parámetro de tenant; herramienta de P4 fuera de la aplicación |
| DEC-91 | Ubicación `scripts/marcas-alta.sql` |
| DEC-92 | Solo lectura: rol por columnas en el test; transacción de solo lectura en la corrida manual |

Verificado en el apply (tarea 1.2): node-pg 8.23.0 prepara siempre una consulta con `name` (`requiresPreparation`), así que un segundo statement se rechaza en Parse (SQLSTATE 42601). Prisma 7.10.0 respeta un `actualizadaEn` explícito en `create`, aunque el campo sea `@updatedAt`, así que no hizo falta el `UPDATE` de respaldo.

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | Docker Desktop estaba apagado y ninguna base era alcanzable | Estado del entorno | Se inició Docker Desktop. Al arrancar, levantó solo los contenedores de otros proyectos (Saleor, Food Store) | no medido |
| 2 | El puerto 5432 quedó tomado por la base de Saleor | Contenedor de otro proyecto con reinicio automático | Los tests corrieron contra `zd-ch09-testdb` (puerto 5434) con `TEST_DB_PORT=5434` | no medido |
| 3 | La base propia (`zerodashboard-db-1`) tiene aplicadas 2 de 8 migraciones y no tiene `VistaCanonica`, `Automatizacion` ni `Ejecucion` | El stack de Compose no se levanta desde CH-06; las pruebas usan bases de test | La corrida sobre la base propia falla (ver abajo). No se migró la base propia en este apply | no medido |
| 4 | Las tareas citan `docs/bitacora/_plantilla.md`, pero la plantilla está en `docs/_plantilla.md` | Ruta mal escrita en las tareas | Se usó `docs/_plantilla.md` | no medido |

## Verificación

| ID | Condición inicial | Acción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| V-1 | Base de test migrada (puerto 5434) | `TEST_DB_PORT=5434 npx tsx --test src/marcas-alta.test.ts` | 13 casos pasan | 13 pass, 0 fail | OK |
| V-2 | Script con un defecto introducido a mano (orden de validación, filtro `ok`, `JOIN` interno) | Mismo comando | Falla el caso correspondiente | Falla en los tres casos; el archivo se restauró | OK |
| V-3 | Suite completa | `TEST_DB_PORT=5434 npm test` | Todo pasa | 633 pass, 0 fail, 0 skipped | OK |
| V-4 | Sesión con `default_transaction_read_only=on` | `DELETE FROM "Tenant" WHERE false;` por `psql` | Rechazo | `cannot execute DELETE in a read-only transaction` | OK |

## Consultas ejecutadas

Script: `scripts/marcas-alta.sql`. Commit: pendiente (el archivo todavía no está commiteado; la rama sale de `6c729dc`). Comando exacto:

```
docker exec -i -e PGOPTIONS="-c default_transaction_read_only=on" zerodashboard-db-1 psql -X -v ON_ERROR_STOP=1 -P pager=off -U zerodashboard -d zerodashboard < scripts/marcas-alta.sql
```

```sql
-- ejecutada 2026-09-30 sobre la base propia; universo: todas las conexiones
ERROR:  relation "VistaCanonica" does not exist
LINE 5:   FROM "VistaCanonica"
               ^
-- exit 3. La base propia tiene aplicadas solo 20260915224714_init_domain_model y
-- 20260917000000_tenant_activo. Hay que repetir la corrida después de levantar el stack,
-- que aplica las migraciones.
```

Corrida de control sobre la base de test local (`zd-ch09-testdb`, mismas migraciones que el repositorio), con el mismo comando y otro contenedor. No es la base propia y no produce datos citables:

```sql
-- ejecutada 2026-09-30 sobre la base de test local zd-ch09-testdb; universo: todas las conexiones
 tenant_id | tenant_activo | conexion_id | alta_inicio | conexion_registrada | mapeo_inicio | mapeo_fin | validacion_ultima | validacion_estado | automatizacion_creada | primera_ejecucion | primera_ejecucion_estado | primera_ejecucion_fase | primera_ejecucion_ok 
-----------+---------------+-------------+-------------+---------------------+--------------+-----------+-------------------+-------------------+-----------------------+-------------------+--------------------------+------------------------+----------------------
(0 rows)
```

Los cierres de alta siguientes pegan su salida fechada en la bitácora de su propio change, citando la ruta y el commit del script (G3).

## Límites del artefacto (aceptados)

| Límite | Origen | Notas |
|---|---|---|
| La marca de validación es mutable: re-registrar el SQL la anula y re-validar la sobrescribe | DEC-41, DEC-44, DEC-87 | Se captura la salida al cerrar cada alta. Por conexión se toma la validación más reciente entre sus vistas |
| Las marcas miden tiempo transcurrido, no esfuerzo | DEC-87 | Incluyen horas ociosas, SQL escrito fuera del sistema y la espera del cron. `automatizacion_creada` separa esa espera |
| La conexión es el registro, no una conexión exitosa comprobada | DEC-88 | Sobreestima el avance |
| No hay orden estricto entre marcas | DEC-87 | Mezclan el reloj de la base (`now()`) y el de la aplicación (validación, planificador). El test no compara marcas entre sí |
| Sin *backfill* ni medición retroactiva de CH-16 | DEC-87 | Uso prospectivo |
| El `creadoEn` del tenant Food Store es la hora del seed, no el inicio real del alta | `prisma/seed.ts` | El seed crea el tenant con `creadoEn` por defecto (`now()`); no debe leerse como el inicio de esa alta |
| En la corrida manual la base aplica una sola capa de solo lectura | DEC-92 | La otra capa es la revisión del archivo. La base propia no tiene login de solo lectura |
| La salida cubre todos los tenants | DEC-90 | Quien la pega en una bitácora elige las filas que corresponden |

## Notas para la tesis

Alimenta el capítulo de resultados (G1: tiempos del alta). La afirmación que sostiene es que las marcas salen de columnas que el sistema ya escribía, con una consulta identificable y fechada (G3). Mientras la base propia no esté migrada no hay una corrida citable: la primera captura válida es la del cierre de la próxima alta.
