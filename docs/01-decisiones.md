# 01 — Decisiones y compuertas

Registro de decisiones de arquitectura. **Este archivo es la fuente del capítulo de arquitectura de la tesis.** Cada entrada debe poder leerse como una subsección: qué se decidió, qué alternativas había, por qué esta, y qué se resigna.

Regla: ninguna decisión de arquitectura la toma un agente. Si durante el desarrollo aparece una decisión no registrada, se frena, se registra acá, y recién después se implementa.

Formato de cada entrada: contexto, opciones, decisión, consecuencias, estado.

---

## Decisiones tomadas

### DEC-01 — Acceso por SQL directo, no por API de la plataforma

**Contexto.** Para leer el estado del e-commerce hay dos caminos: consultar la base, o consumir endpoints del backend del cliente.

**Opciones.** (a) SQL directo sobre réplica. (b) Endpoints expuestos por el cliente.

**Decisión.** SQL directo.

**Por qué.** La opción (b) exige que el cliente desarrolle y mantenga endpoints, lo que presupone equipo técnico disponible y contradice la premisa de baja barrera. La opción (a) solo requiere acceso de lectura.

**Se resigna.** Se duplica lógica de negocio: reglas de cálculo que viven en el backend del cliente se reimplementan en las consultas. Un cambio de regla exige actualizar ambos artefactos.

**Estado:** firme. Heredada del trabajo previo con los tres workflows.

---

### DEC-02 — Motor de ejecución propio, no n8n

**Contexto.** Los tres workflows previos se implementaron en n8n. Al pasar a un modelo multi-tenant alojado por el implementador, hay que decidir si n8n sigue siendo el motor.

**Opciones.** (a) n8n manejado por su API. (b) Planificador propio acotado al patrón consulta-condición-notificación.

**Decisión.** Motor propio.

**Por qué.**
1. **Licencia.** La Sustainable Use License de n8n restringe el uso a fines internos de negocio y excluye explícitamente alojar n8n cobrando por el acceso, y embeberlo en un producto propio. El modelo multi-tenant cae de ese lado. *(Verificado en la documentación oficial de n8n. Para uso comercial, confirmar con el proveedor.)*
2. **Alcance.** La generalidad de n8n excede lo que el catálogo necesita: todas las automatizaciones responden al mismo patrón lineal.

**Se resigna.** Todo lo que n8n resolvía pasa a ser responsabilidad propia: planificación, reintentos, solapamientos, ejecuciones interrumpidas, historial. Es el bloque X del mapa de historias.

**Efecto sobre la tesis.** Los tres workflows dejan de ser el artefacto y pasan a ser el estudio previo que define el patrón y el catálogo inicial.

**Estado:** firme.

---

### DEC-03 — Arquitectura multi-tenant alojada por el implementador

**Contexto.** La consola es una herramienta del implementador y se usa para todos los clientes. Una instalación por cliente implicaría una consola por cliente.

**Opciones.** (a) Instalación completa por cliente. (b) Multi-tenant alojado por el implementador.

**Decisión.** Multi-tenant.

**Se resigna.** Concentración de credenciales de todos los clientes en un solo lugar; necesidad de aislamiento estricto entre inquilinos; y la conectividad se invierte, lo que abre D-2.

**Estado:** firme, con D-2 pendiente.

---

### DEC-04 — Dos superficies separadas

**Contexto.** El implementador escribe SQL; el administrador de la PYME no debe hacerlo.

**Decisión.** Consola (P1) y panel (P2) son superficies distintas con permisos distintos.

**Por qué.** Si el cliente escribe consultas, el producto pierde su diferencial frente a herramientas de BI existentes y hereda sus riesgos de seguridad sin ninguna de sus ventajas.

**Estado:** firme.

---

### DEC-05 — Stack tecnológico: Node.js + TypeScript, base propia en PostgreSQL

**Contexto.** D-3 quedaba abierta con el criterio "el que el autor domina", sin consumir más de una jornada. CH-01 (esqueleto de aplicación y entorno) no se puede especificar sin esto resuelto.

**Opciones.** Lenguaje/runtime: (a) Node.js + TypeScript. (b) Python. (c) .NET / C#. Motor de la base propia (distinto de D-4, que es sobre la réplica del cliente): (a) PostgreSQL. (b) MySQL. (c) SQLite.

**Decisión.** Node.js + TypeScript para la aplicación; PostgreSQL para la base propia.

**Por qué.** Confirmado por el autor como el stack que domina.

**Se resigna.** El framework web específico y la herramienta de ORM/migraciones dentro de Node.js + TypeScript quedan sin fijar acá: se resuelven a nivel de diseño de cada change (empezando por CH-01), no como una compuerta de arquitectura nueva.

**Estado:** firme. Cierra D-3.

---

## Compuertas abiertas

No bloquean el R0. Bloquean el R2. Cerrarlas antes de modelar la persistencia definitiva.

### D-1 — ¿Se persisten los resultados de las consultas?

Opciones: solo consultas y metadatos / resultados con retención acotada / resultados completos.

**Qué depende.** Si el sistema custodia datos personales de los clientes del cliente. Cambia por completo el apartado de consideraciones éticas y legales.

**Inclinación actual:** solo consultas y metadatos de ejecución; el resultado viaja al correo y no se guarda.

**Estado:** abierta.

---

### D-2 — ¿Cómo llega el motor a la réplica del cliente?

Opciones: conexión directa (el cliente expone su base) / agente saliente instalado junto a la réplica / VPN.

**Qué depende.** La barrera de entrada, que es la hipótesis central del trabajo. Pedirle a una PYME que exponga su base a internet contradice esa hipótesis.

**Inclinación actual:** agente saliente. Cuesta más desarrollo y preserva el argumento.

**Pendiente de verificar:** cómo lo resuelven productos comparables.

**Estado:** abierta.

---

### D-3 — Stack tecnológico (cerrada)

Resuelta como DEC-05: Node.js + TypeScript, base propia en PostgreSQL.

**Estado:** cerrada. Ver DEC-05 en "Decisiones tomadas".

---

### D-4 — Motores de base admitidos

Opciones: solo PostgreSQL / PostgreSQL y MySQL.

**Qué depende.** Si cada vista canónica necesita una o dos variantes. Las consultas ya escritas usan construcciones específicas de PostgreSQL que no tienen equivalente directo en MySQL.

**Estado:** abierta.

---

### D-5 — Segundo esquema para la validación de genericidad

Candidatos a verificar: Saleor y Medusa (PostgreSQL), WooCommerce y PrestaShop (MySQL).

**Qué depende.** El release R1, que es el que sostiene el capítulo de resultados.

**Advertencia:** si el segundo esquema corre sobre otro motor, se prueban dos cosas a la vez (mapeo de esquema y portabilidad de dialecto) y un fallo no distingue cuál falló.

**Pendiente de verificar:** motor de base de cada candidato, y si modelan insumos y recetas. Su ausencia deja inaplicable la automatización de stock producible, lo cual es un resultado esperado y reportable.

**Estado:** abierta, depende de D-4.

---

### D-6 — Declaración de uso de asistentes de IA

**Qué depende.** Requisitos de la institución sobre declarar el uso de herramientas de IA en el desarrollo.

**Estado:** abierta. Consultar el reglamento antes de la entrega.
