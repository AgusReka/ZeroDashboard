# ZeroDashboard

Plataforma que ofrece automatizaciones operativas a e-commerce pequeños sin modificar su plataforma de venta. El cliente expone una réplica de solo lectura de su base; ZeroDashboard se conecta, mapea ese esquema a un contrato canónico y ejecuta sobre él un catálogo de automatizaciones que avisan por correo. La consola (`/consola`) es la herramienta del implementador (P1); el panel (`/panel`) es la del administrador del negocio (P2). La página de inicio (`/`) lleva a cada una: «Ir a mi panel» y «Ir a la consola». `/consola/` y `/panel/`, con barra final, redirigen a su ruta.

## Estado actual

La consola, el motor de automatizaciones con aviso por correo, el panel del cliente y la conexión por agente están implementados (CH-01 a CH-35, más la advertencia de frescura de CH-26). Queda como **trabajo a futuro** CH-19d1, CH-19d2 y CH-19e (latido del agente, estado de conectividad y runbook de alta; DEC-179), y CH-27 está fuera de alcance mientras los resultados no se persistan (DEC-93). Esa es la **versión 1.0** (tag `v1.0.0`); qué deja afuera, en la sección «Versión 1.0» de su mapa congelado, [`docs/versiones/v1/02-mapa-de-changes.md`](docs/versiones/v1/02-mapa-de-changes.md).

La **versión 2** está en curso en `master`. Al 2026-11-10 incluye hasta CH-47:
- **Plantillas y avisos:** plantillas escritas desde la consola, con texto del mensaje, mínimo de filas, varios destinatarios y vista previa (CH-37 a CH-42).
- **Telegram:** vínculo desde el panel y canal de aviso (CH-43 y CH-44).
- **Reportes:** catálogo de reportes en la consola, tablero de cada cliente y Chart.js servido para los gráficos (CH-45 a CH-47).

El panel todavía no muestra los reportes: eso llega con CH-48. Detalle por change: [`docs/02-mapa-de-changes.md`](docs/02-mapa-de-changes.md).

**Cómo se usa:** [`docs/guia/`](docs/guia/README.md) (arquitectura, alta de tenant, mapeo, consultas, plantillas, automatizaciones, usuarios, diagnóstico y reportes).

## Versión evaluada en la tesis

- **Etiqueta:** [`congelamiento-tesis-2026-09-24`](https://github.com/AgusReka/ZeroDashboard/tree/congelamiento-tesis-2026-09-24), commit [`a1704bc`](https://github.com/AgusReka/ZeroDashboard/commit/a1704bcec01132f79f5eddfc66d9f6125bde6a02) (2026-09-24).
- **La tesis apunta a `master`, que sigue recibiendo cambios.** El estado evaluado es el de la etiqueta; lo posterior se va sumando a `master`. **Al 2026-09-30, `master` incluye hasta CH-15** (instrumentación de tiempos del alta). Los experimentos que identifica la Tabla 3.3 viven en las ramas de abajo, no en `master`.
- **Ramas de experimentos** (publicadas, sin fusionar en `master`):

  | Rama | Último commit | Estado |
  |---|---|---|
  | `experimento/reporte-diario` | [`0e80098`](https://github.com/AgusReka/ZeroDashboard/commit/0e800987c1f566217efcb70d095180cd192ab083) | No es ancestro de `master`. Sin fusionar. |
  | `experimento/odoo` | [`c3ee7b4`](https://github.com/AgusReka/ZeroDashboard/commit/c3ee7b48ce616f3c95a5cbfcbbd7573882bb02cd) | No es ancestro de `master`. Sin fusionar. |
  | `experimento/desempate` | [`d06b7ad`](https://github.com/AgusReka/ZeroDashboard/commit/d06b7ad471896bd29951647e3107dbf65e7437ae) | No es ancestro de `master`. Sin fusionar. |

- **Fecha de corte:** 2026-09-30 20:38:31 -03:00. En ese momento `origin/master` estaba en `9a0ca4b` (hasta CH-15). Detalle y comandos en `docs/bitacora/bitacora_estado_repo_tesis.md`.

## Levantar el entorno

```bash
cp .env.example .env   # completar lo que quede vacío; CREDENTIAL_MASTER_KEY es obligatoria
docker compose up -d --build
curl http://localhost:3000/health   # {"status":"ready","db":"connected"}
```

La app escucha en `APP_PORT` (los ejemplos y `npm run smoke` usan 3000). La base propia (`db`) **no** expone puerto al host: solo es alcanzable dentro de la red de Compose.

Al iniciar, el contenedor aplica las migraciones (`prisma migrate deploy`), corre la siembra (`prisma/seed.ts`) y arranca el servidor. La siembra crea el tenant «Food Store» si no hay ninguno y las plantillas del catálogo inicial que falten.

`CREDENTIAL_MASTER_KEY` es una clave de 32 bytes en base64, una por despliegue. Sin ella, o con una inválida, el contenedor se niega a arrancar: es el comportamiento previsto.

### Variables opcionales

`docker-compose.yml` reenvía estas variables al servicio `app`; sin valor, rige el predeterminado.

| Variable | Para qué |
|---|---|
| `ZONA_HORARIA_AUTOMATIZACIONES` | Zona IANA en que se leen los horarios cron. Predeterminada: `UTC`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_TIMEOUT_MS` | Servidor de correo. Sin `SMTP_HOST` no se envía correo y cada corrida lo registra. Con `SMTP_HOST`, el resto debe ser válido o el contenedor no arranca. |
| `TELEGRAM_BOT_TOKEN` | Token del bot global de Telegram, al que cada negocio vincula un chat desde el panel. Opcional: sin él la app arranca y el panel muestra Telegram como no disponible. |
| `CONNECTION_RETRY_ATTEMPTS`, `CONNECTION_RETRY_PAUSE_MS` | Reintentos de conexión de las corridas programadas (3 intentos y 5000 ms; máximo 5 intentos). |

**Bot de Telegram.** Se crea con [@BotFather](https://t.me/BotFather): `/newbot`, un nombre y un usuario terminado en `bot`. BotFather devuelve el token, que va en `TELEGRAM_BOT_TOKEN` del `.env` y nunca en el repositorio. La app lee los mensajes con `getUpdates`, sin puertos entrantes, y Telegram no lo permite mientras el bot tenga un webhook: con un webhook configurado, ningún vínculo se completa. Si el bot se usó antes con uno, se borra con `deleteWebhook`. El vínculo se hace desde el panel ([Automatizaciones](docs/guia/06-automatizaciones.md#vincular-telegram)).

La aplicación también lee `CONNECTION_TEST_TIMEOUT_MS` (5000 ms), `QUERY_TIMEOUT_MS` (15 000 ms) y `MAX_FILAS_CONSULTA` (200), pero `docker-compose.yml` no las reenvía: con Compose rigen los predeterminados salvo que se agreguen al servicio `app`.

### Primer operador

La consola exige ingreso (DEC-152). El primer operador se crea por línea de comandos; la clave se pide por entrada estándar (mínimo 12 caracteres):

```bash
docker compose exec app node dist/operador-alta.js <nombre>
```

Después, `http://localhost:3000/consola` muestra «Ingresar». Detalle en [Usuarios y permisos](docs/guia/07-usuarios-y-permisos.md).

### Perfiles de Compose

| Perfil | Comando | Qué agrega |
|---|---|---|
| `demo` | `docker compose --profile demo up -d --build` | Réplica de demo con las bases `food_store` y `cafe_demo` (servicio `replica-demo`, sin puerto en el host). Con `SEED_DEMO=1`, la siembra deja operador `demo`, los tenants «Food Store» y «Café del Puerto» con su conexión, mapeo validado, usuario del panel, tablero y automatizaciones activas. |
| `correo` | `docker compose --profile correo up -d` | Mailpit para ver los correos: interfaz en `http://localhost:8026`. Hay que apuntar la app a él con `SMTP_HOST=mailpit` y `SMTP_PORT=1025`. |

La demo exige `SEED_DEMO=1`, `REPLICA_DEMO_PASSWORD`, `DEMO_OPERADOR_CLAVE` (mínimo 12 caracteres), `DEMO_PANEL_CORREO` y `DEMO_PANEL_CLAVE`, en el entorno o en `.env`. Si falta alguna o la réplica no responde, la app no arranca y dice cuál falta. Solo el valor exacto `1` activa la siembra (DEC-171). `DEMO_TELEGRAM_CHAT_ID` es opcional: con un id de chat válido vincula Food Store a Telegram; con un valor mal formado la app no arranca.

### Probar la demo completa

Los dos perfiles se combinan en un solo comando. Antes, en `.env`, cargar las variables de la demo y apuntar el correo a Mailpit (`SMTP_HOST=mailpit`, `SMTP_PORT=1025`):

```bash
docker compose --profile demo --profile correo up -d --build
curl http://localhost:3000/health   # {"status":"ready","db":"connected"}
```

**Qué viene sembrado:**

- Dos negocios: «Food Store» y «Café del Puerto», cada uno con su conexión, su mapeo validado, su usuario del panel y su tablero (cuatro reportes en Food Store, tres en Café). El usuario de Café es `DEMO_PANEL_CORREO` con `+cafe` antes de la `@` (`ana@dominio` pasa a `ana+cafe@dominio`) y la misma `DEMO_PANEL_CLAVE`.
- Una consulta guardada y la automatización diaria de las 09:00 en Food Store; la de Café, también diaria.
- Una automatización de Food Store **cada minuto**, por correo, sobre `stock-fisico`: umbral 10, mínimo de 2 filas y tres destinatarios (`DEMO_PANEL_CORREO`, `encargado@food-store.example` y `compras@food-store.example`). En un par de minutos llega a Mailpit, en `http://localhost:8026`.
- Telegram, solo si están `DEMO_TELEGRAM_CHAT_ID` (el id numérico del chat; negativo si es un grupo) y `TELEGRAM_BOT_TOKEN`, y si quien tiene ese chat ya apretó «Start» en el bot: Food Store queda vinculado y se agrega otra automatización cada minuto, por Telegram. Si ya tenía un vínculo, no se toca. Café nunca se vincula.

Las filas se crean una sola vez: reiniciar no pisa lo que se editó en el panel ni en la consola.

**Arranque limpio.** La réplica de la demo se inicializa solo con el volumen vacío. Un volumen anterior no trae la base de Café y la app no arranca, con un mensaje que pide `down -v`. Para empezar de cero:

```bash
docker compose --profile demo --profile correo down -v
docker compose --profile demo --profile correo up -d --build
```

**Con el agente (opcional).** Con `DEMO_AGENTE_TOKEN` la conexión de Food Store pasa por un agente en lugar de ser directa, y la demo puede mostrar una falla provocada. Es un atajo de demo: el agente comparte la red de la app; en producción vive en la red del cliente y se levanta con `docker-compose.agente.yml` (ver [Conexión por agente](#conexión-por-agente)). El token es de demo y no se reutiliza; la base guarda solo su hash. Se genera uno y se pone en `.env`:

```bash
node -e "console.log('zda_'+require('crypto').randomBytes(32).toString('base64url'))"   # DEMO_AGENTE_TOKEN=zda_...
docker compose --profile demo --profile correo --profile agente up -d --build
```

La conexión queda por agente solo si se crea con el token ya definido: una conexión directa que ya existe no se convierte (para eso, el arranque limpio). Si el tenant ya tenía un agente con otro token, el servicio `agente` termina con código 2.

Al reconstruir `app` (`--build`) hay que recrear también el agente, porque comparte su red:

```bash
docker compose --profile agente up -d --force-recreate agente
```

**Falla provocada.** Con el agente arriba, las ejecuciones de Food Store salen bien. `docker compose stop agente` y, en la siguiente ejecución (en un minuto), falla con código `ESINAGENTE`: la consola muestra la ejecución fallida y el panel la muestra «con falla». `docker compose start agente` y la siguiente vuelve a salir bien. No se siembra nada roto.

El punto de partida es `http://localhost:3000/`, con las dos puertas. Recorrido por la consola, en `http://localhost:3000/consola`, con el operador `demo` y la clave de `DEMO_OPERADOR_CLAVE`, y el tenant «Food Store» elegido:

1. **Consultas, plantillas y automatizaciones.** La demo ya trae una consulta y las automatizaciones sobre la plantilla `stock-fisico`. Guías: [Consultas](docs/guia/04-consultas.md), [Plantillas](docs/guia/05-plantillas.md) y [Automatizaciones](docs/guia/06-automatizaciones.md).
2. **Reportes y tablero del cliente.** Los cuatro reportes y los dos tableros ya están. En **Reportes** se puede crear otro y en **Puesta en marcha → Tablero del cliente** agregarlo. Guía: [Reportes](docs/guia/09-reportes.md#escribir-el-sql).
3. **Panel del cliente.** En `http://localhost:3000/panel`, con `DEMO_PANEL_CORREO` y `DEMO_PANEL_CLAVE` (o la variante `+cafe`), cada negocio ve su tablero con números distintos.

**Detener los avisos cada minuto.** En la consola, en la automatización, «Desactivar»; no se puede reactivar (DEC-79). Un reinicio no la vuelve a crear: la fila sigue existiendo.

**Probar el umbral.** En el panel, subir el umbral de la automatización por correo de 10 a 20 agrega una fila al aviso (el stock es 18, 9 y 4). Bajarlo a 5 deja una sola fila, menos que el mínimo de 2, y la ejecución queda «omitida-bajo-minimo»: no se envía nada.

**Verificar los datos.** El aviso lee los productos sin receta con stock bajo el umbral; con 10 deben salir dos filas:

```bash
docker compose --profile demo exec replica-demo psql -U food_store_owner -d food_store -c   "SELECT nombre, \"stockDisponible\" FROM v_producto pr WHERE activo AND \"stockDisponible\"::numeric <= 10 AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc.\"productoId\" = pr.id) ORDER BY 2"
```

Para bajar todo: `docker compose --profile demo --profile correo down`. Agregar `-v` borra también los volúmenes, y con ellos la base y la demo sembrada.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila con `tsc` a `dist/`. |
| `npm run dev` | Servidor con recarga, con `--env-file=.env`. |
| `npm start` | Corre `dist/server.js`. |
| `npm run migrate` / `npm run prisma:generate` | `prisma migrate deploy` / `prisma generate`. |
| `npm run seed` | Corre la siembra; importa de `dist/`, así que requiere `npm run build` antes. |
| `npm run operador:alta -- <nombre>` | Crea un operador o repone su clave; requiere `dist/`. |
| `npm run smoke` | Levanta el stack completo con Docker y recorre los escenarios de punta a punta; lo baja al terminar. Necesita Docker y un `.env`. |
| `npm test` | Toda la suite (`tsx --test`). Los tests con base real se omiten si no hay Postgres alcanzable. |
| `npm run test:db` | Corre la suite contra su propia base, `zerodashboard_test`, que crea y migra; se niega a usar la de desarrollo. Requiere `TEST_DB_PASSWORD`; usa `TEST_DB_HOST`, `TEST_DB_PORT` (5432), `TEST_DB_USER` (`zerodashboard`) y `TEST_DB_NAME`. |
| `npm run build:agente` | Compila el agente que corre en la red del cliente. |

`db` no publica puerto, así que `test:db` desde el host necesita publicarlo con un `docker-compose.override.yml` local.

## Conexión por agente

El agente corre junto a la réplica del cliente y abre la conexión hacia la aplicación. Se levanta con `docker-compose.agente.yml` y `.env.agente.example`; el paso a paso está en [Alta de tenant y conexión](docs/guia/02-alta-de-tenant-y-conexion.md).

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/guia/`](docs/guia/README.md) | Guías de uso: de la puesta en marcha al diagnóstico. |
| `docs/00-contexto.md` | Qué es el proyecto, usuarios, arquitectura y reglas no negociables. |
| `docs/01-decisiones.md` | Decisiones de arquitectura (DEC-NN) y compuertas. |
| `docs/02-mapa-de-changes.md` | Secuencia de trabajo de la versión en curso (hoy, la 2). |
| `docs/versiones/` | Mapas congelados de cada versión cerrada (`v1/`). |
| `AGENTS.md` | Reglas para quien modifique el repositorio. |
