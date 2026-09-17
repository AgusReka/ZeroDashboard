# ZeroDashboard

Consola propia de consultas de solo lectura contra la base de un cliente (P1: el implementador). Estado actual: **R0 completo** (CH-01 a CH-05) — conectarse a una base, escribir una consulta, ejecutarla, guardarla y volver a cargarla.

La documentación de arquitectura vive en `docs/` (ver `AGENTS.md` para el índice). Este archivo es la referencia operativa: cómo levantar el entorno y usar la API/consola.

## Levantar el entorno

```bash
cp .env.example .env   # completar POSTGRES_PASSWORD si hace falta
docker compose up -d --build
curl http://localhost:3000/health   # {"status":"ready","db":"connected"}
```

La app corre en `http://localhost:3000`. La base propia de ZeroDashboard (`db`) **no** expone puerto al host — solo es alcanzable desde dentro de la red de Compose. Esto es intencional: la app le habla por el nombre de servicio `db`, nada más necesita llegar a ella desde afuera.

`npm run smoke` levanta todo el stack y corre un checklist de punta a punta contra los specs de CH-01, CH-03, CH-04 y CH-05 (lo baja todo al final).

## Conectar a una base externa (la base del cliente)

La base propia de ZeroDashboard es distinta de la base que se quiere *leer* (la del cliente — "Food Store" en los ejemplos de la tesis). Son dos Postgres separados a propósito (DEC-01/DEC-03): en producción, la base del cliente nunca va a estar en el mismo servidor.

Si la base del cliente corre en Docker en tu misma máquina, **no uses `localhost`** como host al registrar la conexión: el container de la app tiene su propio `localhost` (se refiere a sí mismo). Usá `host.docker.internal`, que Docker Desktop resuelve a tu PC desde cualquier container.

### 1. Registrar una conexión

```
POST /conexiones
Content-Type: application/json

{
  "nombre": "food-store",
  "motor": "postgresql",
  "host": "host.docker.internal",
  "puerto": 5433,
  "baseDeDatos": "food_store",
  "usuarioDb": "lector_zerodashboard",
  "credencial": "…",
  "soloLectura": true          // opcional, default true — informativo, no lo verifica la app
}
```

El nombre de la base la decide el `.env`/`docker-compose.yml` del proyecto food-store al levantarse — si no conecta, confirmá el nombre real con el usuario `postgres` primero (`POST /conexiones/:id/prueba`) antes de asumir que es el mismo que documenta el README de ese proyecto.

Devuelve `201` con la conexión creada (sin `credencial` — nunca se lee de vuelta en ninguna respuesta):

```json
{"conexion":{"id":"…","nombre":"food-store","motor":"postgresql","host":"…","puerto":5433,"baseDeDatos":"team_hero_db","usuarioDb":"postgres","soloLectura":true,"creadaEn":"…","actualizadaEn":"…"}}
```

Validación: `nombre`, `motor`, `host`, `puerto` (1-65535), `baseDeDatos`, `usuarioDb`, `credencial` son obligatorios; cualquier propiedad no reconocida se rechaza. `400 solicitud-invalida` con `campos: [...]` indicando qué falló.

### 2. Probar la conexión

```
POST /conexiones/:id/prueba
```

```json
{"resultado":"ok","categoria":null,"codigo":null,"host":"…","puerto":5433,"duracionMs":28}
```

Si falla, `resultado` es `"fallo"` y `categoria` distingue el motivo: `credenciales-invalidas`, `base-inexistente`, `tiempo-agotado` (no contesta en `CONNECTION_TEST_TIMEOUT_MS`, default 5000ms), u otro. `codigo` es el SQLSTATE crudo cuando aplica. La credencial nunca aparece en la respuesta ni en los logs.

### 3. Ejecutar una consulta

```
POST /consultas/ejecutar
Content-Type: application/json

{
  "conexionId": "…",
  "sql": "SELECT * FROM productos",
  "limite": 50,            // opcional, default 50, máximo 200
  "desplazamiento": 0      // opcional, default 0
}
```

Éxito (siempre `200`, el veredicto vive en el body):

```json
{
  "resultado": "ok",
  "fase": "ejecucion",
  "columnas": ["id", "nombre", "precio"],
  "filas": [[1, "…", 10.5], ...],
  "paginacion": {"limite": 50, "desplazamiento": 0, "hayMas": true, "siguienteDesplazamiento": 50},
  "duracionMs": 12
}
```

Fallo:

```json
{"resultado": "fallo", "fase": "permisos", "categoria": "rol-superusuario", "codigo": null, "duracionMs": 38}
```

**Dos capas de solo-lectura, en dos fases distintas (`fase`):**

- `fase: "permisos"` — el rol de base conectado tiene privilegios que no debería tener, y la consulta **ni se envía** (DEC-08). `categoria` es una de `rol-superusuario`, `rol-con-escritura-en-tabla`, `rol-con-create-en-esquema`. **Esto es lo que vas a pisar si probás con un usuario `postgres` por defecto**: es superusuario, así que se bloquea siempre, incluso para un `SELECT`. Necesitás un rol de solo lectura de verdad — ver más abajo.
- `fase: "ejecucion"` — la consulta se envió y el propio motor la rechazó (DEC-09: transacción `READ ONLY`, sin parser de SQL). `categoria`: `no-es-lectura` (escritura o DDL), `error-sintaxis`, `error-datos`, `tiempo-agotado` (no termina en `QUERY_TIMEOUT_MS`, default 15000ms), `permiso-denegado`, `error-desconocido`.
- `fase: "conexion"` — no se pudo conectar al servidor de base en absoluto (mismas categorías que la prueba de conexión).

**Crear un rol de solo lectura en la base del cliente** (correlo contra esa base, no contra la propia de ZeroDashboard):

```sql
CREATE ROLE lector_zerodashboard LOGIN PASSWORD 'elegí-algo';
GRANT CONNECT ON DATABASE team_hero_db TO lector_zerodashboard;
GRANT USAGE ON SCHEMA public TO lector_zerodashboard;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lector_zerodashboard;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO lector_zerodashboard;
```

Registrá la conexión con `usuarioDb: "lector_zerodashboard"` y esa contraseña en vez de `postgres`.

### 4. Guardar, listar y cargar consultas

```
POST /consultas-guardadas          { "nombre": "…", "descripcion": "…" (opcional), "sql": "…" }   -> 201 { consultaGuardada }  (incluye sql)
GET  /consultas-guardadas                                                                          -> 200 { consultasGuardadas: [...], truncado }  (sin sql, hasta 200 filas, más nuevas primero)
GET  /consultas-guardadas/:id                                                                      -> 200 { consultaGuardada }  (incluye sql) | 404 { error: "consulta-guardada-no-encontrada" }
```

No hay `update` ni `delete` todavía (CH-05, DEC-10). Nombres repetidos están permitidos (no hay restricción de unicidad). Una consulta guardada **no** está atada a ninguna conexión (DEC-11): al guardarla no se elige conexión, se elige recién al ejecutarla — la misma consulta se puede correr contra cualquier conexión registrada.

### 5. Consola web

`GET /consola` — página HTML mínima: editor de SQL, selector de conexión (por id), tabla de resultados paginada, y la sección de consultas guardadas (guardar la actual, ver la lista, cargar una al editor). Sin autenticación — es la herramienta del implementador (P1), no del cliente.

## ¿Cuántas conexiones y consultas guardadas puedo tener?

Todas las que quieras — no hay límite ni restricción de unicidad en `nombre`, para conexiones ni para consultas guardadas. Lo que **todavía no existe** es multi-tenant real: hoy hay un único tenant sembrado en la base (DEC-06) y todo — conexiones, consultas guardadas — cuelga de ese mismo tenant, resuelto siempre del lado del servidor (nunca lo mandás vos). No hay alta de tenants, ni selector de tenant, ni aislamiento entre tenants todavía.

Eso es **CH-06 (release R1)**: ahí se agrega la entidad tenant utilizable de verdad, con aislamiento probado (dos tenants cargados, cero fuga de datos entre ellos) y un indicador de tenant activo en la interfaz. Hasta entonces, "más de una conexión" sí — "más de un cliente aislado" todavía no.

## Códigos de error comunes

| HTTP | `error` | Cuándo |
|---|---|---|
| 400 | `solicitud-invalida` | Body inválido; `campos` lista qué propiedades fallaron |
| 404 | `conexion-no-encontrada` | `POST /conexiones/:id/prueba` con un id inexistente |
| 404 | `consulta-guardada-no-encontrada` | `GET /consultas-guardadas/:id` con un id inexistente |
| 503 | `tenant-no-inicializado` | No hay tenant sembrado (no debería pasar fuera de una base recién creada sin `seed`) |

`POST /consultas/ejecutar` nunca devuelve un error HTTP por un fallo de la consulta en sí — siempre `200`, con el veredicto en `resultado`/`fase`/`categoria` como se explicó arriba.
