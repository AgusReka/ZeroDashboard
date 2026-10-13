# Tarea: Reconciliar el estado SDD y auditar la interfaz actual

## 1. Contexto

El proyecto se desarrolla mediante Spec-Driven Development (SDD). Existe un archivo `TODO-ZD-13-10.md` con observaciones realizadas sobre la interfaz visual y el comportamiento actual del sistema, después de un último cambio relacionado con la visual.

El objetivo es revisar esas observaciones contra el estado real del proyecto, identificar qué sigue pendiente y determinar cómo avanzar sin introducir regresiones ni sobrescribir decisiones o cambios posteriores.

**El archivo TODO es un relevamiento de observaciones, no una especificación que deba implementarse literalmente.**

## 2. Objetivos de esta tarea

1. Revisar y reconciliar el estado actual de SDD con el repositorio.
2. Identificar cambios completados, pendientes, obsoletos, reemplazados o en conflicto.
3. Investigar los errores funcionales observados, priorizando la identificación de causas raíz.
4. Definir una propuesta coherente para los cambios de interfaz y los flujos funcionales.
5. Determinar qué trabajo puede cerrarse o archivarse de forma segura.
6. Preparar un plan de implementación acotado, verificable y sin regresiones.

## 3. Fase obligatoria: auditoría antes de modificar

Antes de implementar cambios, inspeccioná:

- Las instrucciones del repositorio y sus convenciones de desarrollo.
- Los artefactos SDD existentes: especificaciones, propuestas, planes, tareas, decisiones y registros de cambios, según las herramientas utilizadas por el proyecto.
- El estado de Git, incluidos los cambios sin commit, la rama actual y el historial relevante.
- El último cambio relacionado con la visual y los cambios posteriores que puedan depender de él.
- La implementación real de las pantallas, los componentes compartidos, las rutas, los servicios, los contratos de API y las pruebas relacionadas.

Reconstruí la secuencia de cambios utilizando la información disponible. No asumas que el último cambio visual es necesariamente el último cambio funcional.

### Protección de cambios existentes

- No reviertas, restaures ni sobrescribas cambios posteriores sin demostrar que existe un conflicto real y definir cómo resolverlo.
- No descartes modificaciones locales, cambios sin commit ni trabajo de otros agentes.
- No archives automáticamente artefactos por antigüedad, duplicación aparente o diferencias con la implementación actual.
- Antes de cerrar un pendiente, verificá si fue implementado, reemplazado por otro cambio o quedó obsoleto. Conservá la trazabilidad de la decisión.
- Si hay conflictos entre artefactos SDD, Git e implementación, documentalos antes de resolverlos.
- No reabras ni modifiques cambios ya cerrados salvo que exista evidencia de un problema vigente.

Si no podés determinar con suficiente confianza qué cambio es el vigente, dejá constancia del conflicto y solicitá una decisión antes de tocar esa parte.

## 4. Revisión del archivo TODO

Analizá todas las observaciones del archivo y agrupá el trabajo en estas áreas:

1. Tenants, navegación y aislamiento del contexto.
2. Conexiones, credenciales y validación de mapeos.
3. Plantillas y consultas.
4. Contrato canónico y frescura de datos.
5. Usuarios y permisos.
6. Automatizaciones, eventos, consultas y acciones.
7. Agentes y funcionalidades futuras.
8. Documentación funcional y técnica.

Para cada observación, determiná:

- Qué comportamiento existe actualmente.
- Qué comportamiento se espera.
- Si existe una especificación que lo respalde.
- Si el problema sigue vigente.
- Qué componentes, APIs, modelos o cambios SDD están involucrados.
- Qué dependencias o riesgos tiene.
- Qué evidencia permitiría considerar el trabajo terminado.

No implementes funcionalidades únicamente porque aparecen mencionadas en el TODO. Primero determiná su propósito y su coherencia con el diseño del sistema.

## 5. Diagnóstico funcional prioritario

### 5.1. Conexiones y mapeo

Investiga el error HTTP 409 con `{"error":"credencial-ilegible"}` observado al probar conexiones y validar mapeos.

Traza el flujo completo desde la interfaz hasta la API y su respuesta. Revisa el contexto del tenant, la conexión seleccionada, las credenciales, los identificadores enviados, las validaciones y el manejo de errores.

Determina si ambos errores comparten una causa raíz. No soluciones el problema agregando identificadores arbitrarios ni suprimiendo validaciones sin comprobar el contrato esperado.

### 5.2. Consultas y plantillas

Determina cómo funcionan actualmente las consultas guardadas, las plantillas y sus parámetros.

Aclara la diferencia entre una plantilla reutilizable y una consulta persistida asociada a una conexión.

Evalúa el flujo esperado para seleccionar una conexión, listar sus consultas, cargar una existente, editarla y crear una nueva. Verifica que cargar una consulta no permita crear accidentalmente un duplicado y que utilizar una plantilla no modifique la plantilla original.

### 5.3. Automatizaciones

Reconstruye el flujo real de ejecución de una automatización: evento o disparador, consulta o fuente de datos, parámetros, resultado, evaluación de condiciones y acción ejecutada.

Determina cómo se relacionan las automatizaciones con las consultas y las plantillas, sin asumir que comparten el mismo mecanismo.

Identifica las acciones realmente soportadas por el sistema y las limitaciones existentes. Si faltan definiciones funcionales, propone un diseño con criterios de aceptación antes de implementarlo.

### 5.4. Tenants y permisos

Revisa cómo se selecciona el tenant, cómo se mantiene el contexto entre pantallas y cómo se garantiza que las operaciones se ejecuten sobre el tenant correcto.

Evalúa la necesidad de confirmaciones, indicadores de contexto y protecciones ante operaciones sensibles. Verifica las restricciones en el backend: la seguridad no debe depender exclusivamente de la interfaz.

## 6. Criterios de diseño para la propuesta

Considera las siguientes observaciones del TODO como objetivos a evaluar:

- Crear tenants y usuarios mediante flujos de creación claros, con formularios y confirmación cuando corresponda.
- Revisar la navegación administrativa y hacer explícito el tenant activo.
- Incorporar selección y uso de plantillas al crear consultas, preservando las plantillas originales.
- Evitar formularios de edición incrustados encima de las tablas cuando una vista dedicada sea más coherente con el resto del sistema.
- Mejorar las instrucciones, ejemplos, validaciones y mensajes de error.
- Explicar las funcionalidades cuyo propósito no resulta evidente.
- Evaluar qué funcionalidades no están suficientemente definidas y deben permanecer como trabajo futuro.

No impongas una solución visual concreta sin revisar primero los componentes, patrones y convenciones existentes.

## 7. SDD, pendientes y archivo de cambios

Una vez reconciliado el estado actual:

- Clasifica cada pendiente como completado, pendiente vigente, reemplazado, obsoleto o bloqueado.
- Cierra o archiva únicamente los elementos cuyo estado esté respaldado por evidencia.
- Mantén abiertos los elementos incompletos, ambiguos o que dependan de decisiones.
- Si corresponde actualizar especificaciones, propuestas, planes o tareas, identifica exactamente cuáles y por qué.
- No crees cambios SDD redundantes si existe uno vigente que pueda actualizarse según las convenciones del proyecto.
- Respeta el flujo de aprobación y archivo definido por las herramientas SDD utilizadas.

No ejecutes un cierre masivo ni archives trabajo simplemente para limpiar el listado.

## 8. Documentación

Evalúa cómo incorporar documentación versionada que explique el sistema desde el punto de vista de un desarrollador y de un administrador.

Como mínimo, la propuesta debe contemplar:

- Introducción a la arquitectura y los conceptos principales.
- Alta de un tenant y configuración de una conexión.
- Configuración y validación del mapeo.
- Creación, parametrización y ejecución de consultas.
- Uso de plantillas.
- Configuración de automatizaciones y su flujo de ejecución.
- Administración de usuarios y permisos.
- Diagnóstico de errores frecuentes.

La documentación debe reflejar funcionalidades verificadas. No documentes como disponibles características que todavía no estén implementadas.

## 9. Restricciones

Durante esta primera tarea:

- No realices una refactorización general.
- No rediseñes todas las pantallas de forma indiscriminada.
- No cambies contratos de API, modelos de datos ni permisos sin justificar su necesidad.
- No agregues dependencias ni funcionalidades nuevas por conveniencia.
- No dupliques artefactos SDD.
- No marques como resuelto ningún error que no hayas reproducido o verificado mediante evidencia suficiente.
- No modifiques áreas ajenas a los problemas identificados, salvo que exista una dependencia demostrable.

## 10. Entregables de esta primera fase

Al terminar la auditoría, presenta:

1. **Estado del proyecto:** rama, estado de Git, último cambio visual identificado y cambios posteriores relevantes.
2. **Matriz de reconciliación:** observación original, estado actual, evidencia, artefactos afectados y decisión propuesta.
3. **Diagnóstico técnico:** causas confirmadas, hipótesis pendientes y pruebas necesarias.
4. **Conflictos y riesgos:** especialmente los que puedan implicar sobrescribir cambios posteriores.
5. **Plan de implementación:** fases ordenadas por dependencias y prioridad, con alcance y criterios de aceptación.
6. **Plan de cierre SDD:** elementos que se pueden cerrar, archivar, actualizar o deben permanecer abiertos.
7. **Documentación propuesta:** ubicación, estructura y contenidos necesarios.

Cada conclusión debe distinguir entre hechos verificados, hipótesis y decisiones pendientes.

## 11. Condición de finalización

Esta primera tarea termina cuando la auditoría y la propuesta están documentadas y existe una ruta de implementación coherente.

**No comiences la implementación masiva durante esta fase.** Si encuentras un error que requiere una intervención inmediata para evitar pérdida de datos o un riesgo de seguridad, detente, documenta el impacto y solicita autorización antes de aplicar una corrección.

Al finalizar, informa qué revisaste, qué pudiste verificar, qué queda pendiente y cuál es el siguiente cambio SDD recomendado.

Prioriza preservar el estado válido del proyecto y reducir el riesgo de regresiones por encima de la cantidad de cambios realizados.