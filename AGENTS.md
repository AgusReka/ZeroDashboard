# AGENTS.md

Instrucciones para cualquier agente (humano o IA) que trabaje sobre este repositorio.

Este archivo no reemplaza la documentación del proyecto: la referencia. No resume ni duplica su contenido — léela antes de proponer o implementar cualquier cambio.

## Documentos de referencia

| Documento | Contenido |
|---|---|
| `docs/00-contexto.md` | Qué es el proyecto, usuarios, arquitectura, restricciones, entidades del dominio |
| `docs/01-decisiones.md` | Decisiones de arquitectura tomadas y compuertas abiertas |
| `docs/02-mapa-de-changes.md` | Secuencia de trabajo del proyecto, un change a la vez |
| `docs/mapa-historias.md` | Historias de usuario completas, agrupadas por bloque y release |

## Reglas no negociables

Transcriptas literalmente de la sección 5 de `docs/00-contexto.md`. Valen para toda feature. Un agente que trabaje sobre este repositorio debe respetarlas sin que se le recuerde.

1. **P2 nunca ejecuta SQL arbitrario.** El panel del cliente no tiene editor de consultas.
2. **Aislamiento entre tenants.** Ninguna consulta originada en el panel puede devolver datos de otro tenant. El identificador de tenant nunca se toma de la petición del cliente.
3. **Solo lectura, en dos capas.** Rechazo de sentencias que no sean de lectura en la aplicación, más usuario de base sin permisos de escritura.
4. **Sin concatenación de SQL.** Toda parametrización es por parámetros del driver.
5. **Minimización de datos.** El contrato canónico no expone campos personales que ninguna automatización necesite.
6. **El motor solo ejecuta el patrón.** Si un caso no encaja, se documenta como límite del artefacto; no se amplía el motor.
7. **Secretos fuera del repositorio.** Variables de entorno y archivo de ejemplo sin valores reales.

## Decisiones de arquitectura

Ninguna decisión de arquitectura se toma sin registrarla antes en `docs/01-decisiones.md`. Si durante la exploración, la especificación o la implementación de un change aparece una decisión de arquitectura no registrada, el trabajo se frena, la decisión se registra ahí (contexto, opciones, decisión, consecuencias, estado) y recién después se continúa. Esto no lo resuelve un agente por su cuenta.

## Anti-alcance

El anti-alcance descrito en la sección 6 de `docs/00-contexto.md` (y detallado en la sección 6 de `docs/mapa-historias.md`) no se amplía. Esto aplica en particular al motor de ejecución: es el límite más frágil del proyecto, el que más fácil se desborda sin que se note. Ante un caso que casi encaja, se documenta como límite del artefacto — no se le agrega capacidad al motor ni al producto para cubrirlo.

## Compuertas abiertas

Hay cuatro compuertas abiertas registradas en `docs/01-decisiones.md`: **D-1, D-2, D-4, D-5**. Ningún change de R2 en adelante se implementa sin que estén cerradas.
