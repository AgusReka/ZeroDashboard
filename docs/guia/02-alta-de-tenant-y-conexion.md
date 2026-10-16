# Alta de un tenant y su conexión

Esta guía lleva a un negocio nuevo desde cero hasta una conexión probada, con conexión directa o a través de un agente. Todo se hace desde la consola, en `/consola`.

## Antes de empezar

- [ ] Una sesión de operador (ver [Usuarios y permisos](07-usuarios-y-permisos.md)).
- [ ] La réplica del cliente es PostgreSQL y se alcanza desde la aplicación (conexión directa) o desde el host del agente.
- [ ] Un rol de base **de solo lectura** en esa réplica. Con un rol que escribe, o superusuario, la consola se niega a ejecutar (ver [Diagnóstico](08-diagnostico.md)).

```sql
-- Se corre contra la base del cliente, no contra la de ZeroDashboard.
CREATE ROLE lector_zerodashboard LOGIN PASSWORD '<contraseña>';
GRANT CONNECT ON DATABASE <base> TO lector_zerodashboard;
GRANT USAGE ON SCHEMA public TO lector_zerodashboard;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lector_zerodashboard;
```

## Camino rápido

1. **Tenants** → «Nuevo tenant» → escribir el nombre → «Crear y elegir».
2. Comprobar que la barra superior muestra el tenant en «Tenant activo».
3. **Conexiones** → «Nueva conexión» → completar los datos → «Guardar y probar».
4. Leer el resultado de la prueba (`OK · N ms` o `Falló · <categoría>`).

## 1. Crear y elegir el tenant

«Crear tenant» solo crea; «Crear y elegir» además lo deja como tenant activo. Si se creó sin elegirlo, se elige con «Elegir como activo» en la fila, o desde el selector de la barra superior. La elección se recuerda en el navegador.

Las pantallas de **Puesta en marcha** y **Trabajo diario** operan sobre el tenant activo. Con «Ningún tenant seleccionado» no se envía ninguna solicitud y la consola pide elegir uno.

## 2A. Conexión directa

En «Nueva conexión»:

| Campo | Valor |
|---|---|
| Nombre | Libre. Se permiten nombres repetidos; los selectores agregan un fragmento del id para distinguirlos. |
| Servidor y Puerto | Dónde escucha la réplica. El puerto predeterminado es 5432. |
| Base de datos y Usuario | La base y el rol de solo lectura. |
| Cómo llega | «Directa». |
| Contraseña | Se guarda cifrada y no se vuelve a mostrar. |

Si la réplica corre en Docker en la misma máquina que la aplicación, `localhost` no sirve como servidor: dentro del contenedor, es el propio contenedor. Usar `host.docker.internal` o el nombre del servicio en la red de Compose.

## 2B. Conexión por agente

El agente corre junto a la réplica, en la red del cliente, y abre la conexión hacia la aplicación (DEC-94).

1. **Agentes** → «Crear agente». La consola muestra el token una sola vez («Este es el token del agente. Copialo ahora: no se vuelve a mostrar.»). Se copia con «Copiar» y se cierra con «Ya lo guardé».
2. En el host del cliente, completar `.env.agente` a partir de `.env.agente.example` con tres variables y levantar el agente:

   | Variable | Contenido |
   |---|---|
   | `AGENT_SERVER_URL` | Origen de la aplicación: `wss://host[:puerto]`. `ws://` solo se acepta para loopback. |
   | `AGENT_TOKEN` | El token emitido (empieza con `zda_`). |
   | `AGENT_ALLOWED_TARGETS` | Lista separada por comas de `host:puerto` exactos que el agente puede alcanzar. Sin comodines. |

   ```bash
   docker compose -f docker-compose.agente.yml --env-file .env.agente up -d --build
   ```

3. **Conexiones** → «Nueva conexión» → «Cómo llega»: «Por el agente del tenant». «Servidor» y «Puerto» son los que **el agente** ve, y deben figurar en `AGENT_ALLOWED_TARGETS`.

Notas del agente:

- Un tenant tiene un solo agente (DEC-115). «Revocar» corta las conexiones que pasan por él; «Emitir un token nuevo» lo reactiva con el mismo id, así que las conexiones conservan su vínculo.
- «Cómo llega» ofrece el agente solo mientras está activo.
- El agente sale con código 1 (configuración), 2 (credenciales rechazadas o agente revocado) o 3 (reemplazado por otra instancia con el mismo token); estos tres casos requieren intervención.

## 3. Probar

«Guardar y probar» registra la conexión y la prueba en el mismo paso. Si la prueba falla, la conexión queda guardada y el aviso dice «Guardada. La prueba falló: …». Después, «Probar» en la fila repite la prueba.

| Categoría | Significa |
|---|---|
| `tiempo-agotado` | No contestó dentro de `CONNECTION_TEST_TIMEOUT_MS` (5000 ms por defecto). |
| `host-inalcanzable` / `dns-no-resuelve` | No se alcanza el servidor, o su nombre no se resuelve. |
| `credenciales-invalidas` / `base-inexistente` | El destino rechazó el usuario o la contraseña; la base no existe. |
| `error-desconocido` | Otro motivo. Con un agente desconectado, el código es `ESINAGENTE`. |

## Límites

- **Límite.** Solo PostgreSQL (DEC-25). El campo `motor` se guarda, pero la prueba siempre usa el protocolo de PostgreSQL.
- **Límite.** La consola no muestra si el agente está conectado: el latido no hace nada y CH-19d1, CH-19d2 y CH-19e son trabajo a futuro (DEC-179). Un agente caído se ve recién al probar.
- **Límite.** Una conexión registrada no se edita ni se borra desde la consola; se registra otra.

## Siguiente paso

[Mapeo y validación](03-mapeo-y-validacion.md).
