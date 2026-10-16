# ZeroDashboard

Plataforma que ofrece automatizaciones operativas a e-commerce pequeños sin modificar su plataforma de venta. El cliente expone una réplica de solo lectura de su base; ZeroDashboard se conecta, mapea ese esquema a un contrato canónico y ejecuta sobre él un catálogo de automatizaciones que avisan por correo. La consola (`/consola`) es la herramienta del implementador (P1); el panel (`/panel`) es la del administrador del negocio (P2).

## Estado actual

La consola, el motor de automatizaciones con aviso por correo, el panel del cliente y la conexión por agente están implementados (CH-01 a CH-35). Queda como **trabajo a futuro** CH-19d1, CH-19d2 y CH-19e (latido del agente, estado de conectividad y runbook de alta; DEC-179). CH-26 sigue pendiente y CH-27 está fuera de alcance mientras los resultados no se persistan (DEC-93). Detalle por change: [`docs/02-mapa-de-changes.md`](docs/02-mapa-de-changes.md).

**Cómo se usa:** [`docs/guia/`](docs/guia/README.md) (arquitectura, alta de tenant, mapeo, consultas, plantillas, automatizaciones, usuarios y diagnóstico).

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
| `CONNECTION_RETRY_ATTEMPTS`, `CONNECTION_RETRY_PAUSE_MS` | Reintentos de conexión de las corridas programadas (3 intentos y 5000 ms; máximo 5 intentos). |

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
| `demo` | `docker compose --profile demo up -d --build` | Réplica de demo `food_store` (servicio `replica-demo`, sin puerto en el host). Con `SEED_DEMO=1`, la siembra deja operador `demo`, tenant «Food Store», conexión, mapeo validado, una consulta, un usuario del panel y una automatización activa. |
| `correo` | `docker compose --profile correo up -d` | Mailpit para ver los correos: interfaz en `http://localhost:8026`. Hay que apuntar la app a él con `SMTP_HOST=mailpit` y `SMTP_PORT=1025`. |

La demo exige `SEED_DEMO=1`, `REPLICA_DEMO_PASSWORD`, `DEMO_OPERADOR_CLAVE` (mínimo 12 caracteres), `DEMO_PANEL_CORREO` y `DEMO_PANEL_CLAVE`, en el entorno o en `.env`. Si falta alguna o la réplica no responde, la app no arranca y dice cuál falta. Solo el valor exacto `1` activa la siembra (DEC-171).

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
| `docs/02-mapa-de-changes.md` | Secuencia de trabajo y estado de cada change. |
| `AGENTS.md` | Reglas para quien modifique el repositorio. |
