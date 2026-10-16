# Usuarios y permisos

Hay dos tipos de cuenta, una por superficie (DEC-04): el **operador**, que usa la consola y ve todos los tenants, y el **usuario del panel**, que pertenece a un tenant y solo ve sus automatizaciones.

## Operador de la consola

### Crear o reponer una cuenta

Las cuentas de operador se crean **solo por línea de comandos** (DEC-153). No hay pantalla para hacerlo.

```bash
npm run operador:alta -- <nombre>
# Con Docker Compose, dentro del contenedor (la forma que usa npm run smoke):
docker compose exec app node dist/operador-alta.js <nombre>
```

`npm run operador:alta` ejecuta `node dist/operador-alta.js`, así que necesita el código compilado (`npm run build`).

| Regla | Detalle |
|---|---|
| Nombre | De 1 a 64 caracteres, sin espacios. |
| Clave | Mínimo 12 caracteres. Se lee por entrada estándar: con terminal se pide dos veces y no se muestra; sin terminal (una tubería) se toma la primera línea. Nunca es un argumento ni una variable de entorno. |
| Nombre existente | Reemplaza la clave y cierra todas sus sesiones. Es también la salida ante un bloqueo. |
| Salida | Código 0 hecho; 1 nombre o clave inválidos, sin escribir nada; 2 sin base de datos. |

El comando lee solo `DATABASE_URL`. Con la demo (`SEED_DEMO=1`) la semilla crea el operador `demo` con la clave de `DEMO_OPERADOR_CLAVE`.

### Ingresar

`/consola` sin sesión muestra «Ingresar» con los campos «Nombre» y «Clave». Un nombre inexistente y una clave errónea dan la misma respuesta: «Nombre o clave incorrectos.» La sesión dura 12 horas y la barra superior muestra «Operador: <nombre>» y «Salir». Si la sesión vence, la consola vuelve a la pantalla de ingreso. El ingreso es obligatorio y no se puede desactivar (DEC-152).

**Límite.** No hay roles dentro del implementador: todos los operadores pueden lo mismo, y no hay permisos distintos por tenant. Se documenta como límite en lugar de ampliar el alcance.

## Usuarios del panel

Pantalla **Usuarios del panel**, del tenant activo.

1. «Nuevo usuario» → «Correo» y «Nombre (opcional)» → «Crear usuario».
2. El sistema **genera la clave** (nadie la escribe) y la muestra una sola vez: «Esta es la clave del usuario. Pasásela por un canal seguro: no se vuelve a mostrar.» Se copia con «Copiar» y se cierra con «Ya la guardé» (DEC-155).

| Acción | Efecto |
|---|---|
| «Reponer clave» | Genera otra clave y cierra las sesiones abiertas del usuario. Pide confirmar en la fila (DEC-156). |
| «Desactivar» | El usuario no puede ingresar y sus sesiones se cierran. Se revierte con «Reactivar», que no toca la clave (DEC-158). |

El correo es el identificador y es **único en todo el sistema**, no solo en el tenant: si está en uso, «Ese correo ya está en uso.» (DEC-157). Se guarda en minúsculas.

El usuario ingresa en `/panel` con «Correo» y «Contraseña»; la sesión dura 30 días. Ve «Mis automatizaciones» y puede ajustar «Cantidad mínima», «Hora de envío», días y correo. Si su tenant está dado de baja, ve «Tu negocio no está activo en este momento. Comunicate con quien te dio acceso.»

El panel no tiene editor de SQL (regla 1), y su tenant sale siempre de la sesión (regla 2).

## Secretos que se muestran una sola vez

| Secreto | Dónde | Se descarta |
|---|---|---|
| Token del agente | **Agentes** | Con «Ya lo guardé», al cambiar de pantalla o de tenant. |
| Clave de un usuario del panel | **Usuarios del panel** | Igual que el token. |
| Contraseña de la conexión | «Nueva conexión» | Se vacía al enviar; se guarda cifrada y no vuelve a mostrarse. |

Si se pierde, no se recupera: se emite un token nuevo o se repone la clave.

## Dar de baja un tenant

**Tenants** → «Dar de baja» en la fila. El pop-up «Dar de baja un tenant» nombra el tenant y avisa que no se puede deshacer. El botón «Dar de baja <nombre>» queda deshabilitado hasta escribir el nombre **exacto** (sin recortar espacios ni ignorar mayúsculas) en «Escribí el nombre del tenant para confirmar». La API también lo exige: sin coincidencia responde 409 `confirmacion-no-coincide` (DEC-175).

La baja es irreversible: no hay ruta de reactivación. El tenant ya no se puede elegir ni operar, sus agentes se desconectan, el planificador no lo corre y los datos quedan como registro (DEC-14).

## Auditoría

Pantalla **Auditoría**, del tenant activo: qué se ejecutó contra su réplica, cuándo y por quién.

- Filtros: «Desde», «Hasta» (por día) y «Resultado» (Todos, OK, Falló), con «Filtrar».
- Columnas: Fecha y hora, Operador, Origen, Conexión, Consulta, SQL, Filas, Duración, Resultado.
- «Origen»: Consulta, Prueba de plantilla, Validación de mapeo, Prueba de conexión. «Consulta» dice «nombre vN» si se corrió una consulta guardada sin editar, «Plantilla <id>» o «Ad hoc».
- Se guarda la sentencia tal como se ejecutó, nunca los valores de los parámetros ni las filas (DEC-160).
- Es un registro que ni la API ni la base permiten modificar o borrar (DEC-162). Muestra las 200 más recientes.
- No incluye las corridas programadas: esas están en las ejecuciones de cada automatización (DEC-159).

## Tiempos de alta

Pantalla **Tiempos de alta**, del tenant activo: un bloque por conexión con las etapas «Alta del tenant», «Conexión registrada», «Inicio del mapeo», «Última edición del mapeo», «Última validación», «Primera automatización», «Primera ejecución» y «Primera ejecución OK». Cada una muestra fecha, detalle y el tiempo desde la etapa anterior, o «Pendiente».

**Límite.** Las marcas miden tiempo transcurrido, no esfuerzo; la validación muestra solo la última (DEC-178).

## Siguiente paso

[Diagnóstico](08-diagnostico.md).
