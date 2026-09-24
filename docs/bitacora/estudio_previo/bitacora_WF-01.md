# Bitácora Técnica — WF-01: Control de Stock

**Proyecto:** Automatización inteligente para e-commerce de PYMES
**Caso de estudio:** Food Store (e-commerce de comidas, PostgreSQL)
**Workflow:** WF-01 — Control de stock con alertas de reposición
**Estado:** Implementado y validado sobre datos reales

> Documento de trabajo. Registra el proceso, las decisiones de diseño con su justificación, la evidencia obtenida y las fricciones técnicas encontradas durante la implementación. Alimenta directamente los Capítulos 4 (arquitectura), 5 (diseño de workflows) y 6 (resultados) de la tesis.

---

## 1. Descripción del proceso

### 1.1 Situación previa (AS-IS)

En el sistema base, el control de stock es una tarea manual: el administrador debe revisar periódicamente el panel de administración, producto por producto, para detectar cuáles están próximos a agotarse. En un e-commerce de comidas esta revisión tiene una complejidad adicional que el control manual difícilmente captura: el stock real de un producto no siempre es un número almacenado, sino que puede depender de la disponibilidad de sus ingredientes según la receta.

### 1.2 Situación automatizada (TO-BE)

Un workflow programado consulta la base de datos a intervalos regulares, evalúa el nivel de stock de cada producto según su régimen (físico o calculado), y envía una alerta por correo electrónico al administrador únicamente cuando detecta productos por debajo del umbral crítico. La revisión deja de ser una tarea humana periódica y se convierte en un proceso desatendido que solo requiere atención cuando hay algo que resolver.

---

## 2. Hallazgo estructural: dos regímenes de stock

Durante el análisis del modelo de datos real se identificó que los productos del sistema no comparten un único mecanismo de stock, sino que responden a **dos regímenes distintos y mutuamente excluyentes**:

| | Producto standalone | Producto con receta |
|---|---|---|
| Ejemplo | Agua Mineral, Brownie | Hamburguesas |
| Fuente del stock | Campo `stock_quantity` físico | Calculado desde ingredientes |
| Cómo se determina | Número cargado y descontado | `MIN(stock_ingrediente / cantidad_receta)` |
| Persistencia | Se persiste en la tabla `product` | No se persiste; se deriva en tiempo de ejecución |

En los productos con receta, el sistema **ignora** el campo `stock_quantity` y calcula la disponibilidad al vuelo a partir de la lista de ingredientes. Como consecuencia, el `stock_quantity` de estos productos debería estar en 0, pero en la práctica conserva valores residuales que no representan información operativa válida.

Este hallazgo es relevante para la tesis porque **conecta con la distinción perecedero/manufacturado vs. durable** identificada en la revisión de literatura sobre automatización por rubro: el régimen de stock calculado es característico del comercio gastronómico y está ausente en el retail de bienes durables (hardware, ferretería), donde todo producto es de inventario simple.

---

## 3. Decisión de diseño: partición en dos ramas

Dado que existen dos regímenes de stock, un único mecanismo de alerta no puede cubrir ambos correctamente. Se optó por dividir el control en dos ramas complementarias, cada una vigilando el régimen que le corresponde:

- **WF-01a** — vigila productos **sin receta**, contra su `stock_quantity` físico.
- **WF-01c** — vigila productos **con receta**, contra su stock producible calculado.

La partición es limpia: cada producto cae en **exactamente una** de las dos ramas, nunca en ambas ni en ninguna. Esta ausencia de solapamiento y de huecos es un criterio de diseño defendible, ya que elimina la ambigüedad sobre qué mecanismo controla qué producto.

**Presentación conceptual sugerida para la tesis:** no se trata de dos workflows independientes, sino de un único proceso de control de stock que se bifurca según el régimen del producto. Redacción propuesta:

> "El control de stock se bifurca según el régimen del producto: los productos de inventario simple se validan contra su stock físico declarado, mientras que los productos manufacturados (con receta) se validan contra su stock producible, derivado dinámicamente de la disponibilidad de insumos. Esta dualidad refleja una característica estructural del comercio gastronómico ausente en el retail de bienes durables."

---

## 4. WF-01a — Control de stock físico (productos sin receta)

### 4.1 Arquitectura de nodos

`Schedule Trigger → Postgres (Execute Query) → IF → Limit → Send Email`

### 4.2 Query

```sql
SELECT id, name, stock_quantity, available
FROM product p
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND p.stock_quantity <= 20
  AND NOT EXISTS (
        SELECT 1
        FROM product_ingredient pi
        WHERE pi.product_id = p.id
      )
ORDER BY stock_quantity ASC;
```

### 4.3 Lógica

- El bloque `NOT EXISTS` descarta cualquier producto que aparezca en `product_ingredient`, dejando pasar solo productos **sin receta**, donde `stock_quantity` es un dato real y confiable.
- `available = true` evita alertar sobre productos ya desactivados manualmente.
- `deleted_at IS NULL` respeta el borrado lógico del sistema.
- Umbral: 20 unidades (parametrizable).

### 4.4 Validación

Con los datos de producción, la query no devuelve resultados (los productos standalone superan el umbral). Se validó forzando `stock_quantity = 8` en "Agua Mineral 500ml", que hizo aparecer el producto en la alerta. Revertido posteriormente a 200.

---

## 5. WF-01c — Control de stock producible (productos con receta)

### 5.1 Arquitectura de nodos

`Schedule Trigger → Postgres (Execute Query) → IF → Limit → Send Email`

Misma estructura que WF-01a; cambia la query (más compleja) y el contenido de la alerta.

### 5.2 Query

```sql
SELECT
    p.id,
    p.name,
    FLOOR(MIN(i.stock_quantity::numeric / pi.quantity)) AS stock_producible,
    (ARRAY_AGG(i.name ORDER BY i.stock_quantity::numeric / pi.quantity ASC))[1] AS ingrediente_critico,
    (ARRAY_AGG(i.stock_quantity ORDER BY i.stock_quantity::numeric / pi.quantity ASC))[1] AS stock_ingrediente_critico
FROM product p
JOIN product_ingredient pi ON pi.product_id = p.id
JOIN ingredient i
       ON i.id = pi.ingredient_id
      AND i.deleted_at IS NULL
WHERE p.deleted_at IS NULL
  AND p.available = true
  AND pi.quantity > 0
GROUP BY p.id, p.name
HAVING FLOOR(MIN(i.stock_quantity::numeric / pi.quantity)) <= 10
ORDER BY stock_producible ASC;
```

### 5.3 Lógica

- `JOIN` (no `LEFT JOIN`): solo entran productos con receta.
- `MIN(stock_ingrediente / cantidad)`: el ingrediente que primero se agota determina el máximo producible (cuello de botella).
- `FLOOR`: redondeo hacia abajo (no se puede producir una fracción de unidad); replica la división entera (`//`) del backend.
- `ARRAY_AGG(...)[1]`: identifica el ingrediente limitante y su stock, información accionable para reposición.
- `HAVING ... <= 10`: umbral de unidades producibles.

Esta query **replica la lógica de negocio del backend** (`_compute_available_stock`), que calcula `min(stock_ingrediente // cantidad)` para productos con receta.

### 5.4 Decisión de diseño: alertar por producto, no por ingrediente

Se optó por emitir la alerta a nivel de **producto** y no de ingrediente. Justificación:

- El producto es la unidad de venta y la métrica accionable para operaciones.
- El ingrediente limitante viaja como dato dentro de cada alerta de producto, aportando el diagnóstico de causa raíz sin necesidad de una alerta separada.
- Si un ingrediente escasea, los productos afectados aparecen progresivamente en la alerta, ordenados por urgencia, sin generar alertas redundantes a nivel de insumo.

Redacción propuesta para la tesis:

> "Se optó por alertar a nivel de producto porque es la unidad de venta y la métrica accionable para operaciones; el ingrediente limitante se incluye como diagnóstico, evitando alertas redundantes a nivel de insumo."

### 5.5 Validación y evidencia real

Con los datos de producción, la query no devuelve resultados (el producto con menor stock producible es "Hamburguesa BBQ Bacon" con 20 unidades, por encima del umbral de 10). Esto es el comportamiento correcto: sin crisis de stock, no hay alerta.

Para validar la detección, se forzó `stock_quantity = 5` en el ingrediente "Bacon". Resultado:

| Producto | Stock producible | Ingrediente crítico | Stock ingrediente |
|---|---|---|---|
| Hamburguesa BBQ Bacon | 2 | Bacon | 5 |

**Observación técnica relevante:** con 5 unidades de Bacon, el stock producible resultó **2**, no 5. Esto confirma que la receta consume **más de una unidad de Bacon por hamburguesa** (`pi.quantity > 1`), y que el cálculo respeta la proporción de la receta en lugar de hacer una resta ingenua. Este matiz —que el control manual difícilmente captura— es parte del valor de la automatización. Bacon revertido posteriormente a 40.

---

## 6. Diseño de las notificaciones

Ambos workflows envían correos HTML con formato visual consistente (estilos inline y estructura de tablas, para compatibilidad con clientes de correo). Comparten el mismo esqueleto: encabezado con color de acento, texto explicativo, tabla de datos y pie.

**Código de color semántico** (decisión de UX):

- **WF-01a → ámbar (#f59e0b):** advertencia, reposición recomendada.
- **WF-01c → rojo (#dc2626):** crítico, riesgo de no poder producir.

El color no es decorativo sino informativo: permite al operario distinguir la gravedad de un vistazo, incluso desde la bandeja de entrada (reforzado con emojis ⚠️ / 🔴 en el asunto).

---

## 7. Decisión de arquitectura: SQL directo vs. API

Para obtener el stock calculado, se evaluaron dos caminos:

**Opción 1 — SQL directo (adoptada):** el workflow recalcula el stock producible con su propia query contra la base. Ventaja: implementable sin modificar la plataforma; una PYME solo necesita otorgar acceso de lectura a la base de datos, sin tocar el código de su aplicación. Desventaja: **duplica la lógica de negocio** (la fórmula de cálculo vive tanto en el backend como en la query del workflow); un cambio en la regla exige actualizar ambos.

**Opción 2 — Consumo vía API (documentada como alternativa):** el workflow llamaría a un endpoint del backend que expone el stock calculado. Ventaja: preserva la fuente única de verdad. Desventaja: requiere que la plataforma exponga endpoints, lo que el sistema base no hace.

**Justificación de la elección:** se priorizó la Opción 1 por alineación con la hipótesis de baja barrera de entrada (la PYME no modifica su plataforma) y por viabilidad inmediata. Se declara explícitamente el riesgo de mantenibilidad:

> "El workflow replica la regla de cálculo del backend; un cambio en dicha regla exige actualizar ambos artefactos. En un entorno productivo se recomendaría exponer la lógica de cálculo vía API para preservar una fuente única de verdad."

Este trade-off es material para la sección de análisis crítico de decisiones de diseño (Cap. 4).

---

## 8. Fricciones técnicas encontradas

Registro de los obstáculos de implementación. Son relevantes para la tesis porque constituyen evidencia directa de la **barrera de entrada técnica** que enfrenta una PYME sin perfil técnico: cada una de estas fricciones es un punto donde un usuario no técnico podría abandonar.

| # | Fricción | Causa | Resolución |
|---|---|---|---|
| 1 | El contenedor de n8n no alcanzaba PostgreSQL del host | Docker aísla la red; `localhost` dentro del contenedor no es el host | `extra_hosts: host.docker.internal:host-gateway` en docker-compose |
| 2 | PostgreSQL rechazaba conexiones externas | `listen_addresses = localhost`; solo escuchaba en 127.0.0.1 | Ajuste de `postgresql.conf` (`listen_addresses = '*'`) |
| 3 | Autorización de conexión denegada | `pg_hba.conf` no autorizaba la subred de Docker | Regla acotada a la base y usuario para la subred `172.17.0.0/16` con `scram-sha-256` |
| 4 | Fallo de autenticación SMTP (`535 BadCredentials`) | Configuración inicial de credenciales de correo | Uso de contraseña de aplicación de Google + corrección de la dirección de correo |
| 5 | El workflow enviaba el correo duplicado | n8n ejecuta un nodo una vez por cada item de entrada | Nodo `Limit` (Max Items = 1) antes del envío |

**Reflexión para la tesis:** la fricción #5 ilustra un punto clave sobre las herramientas low-code. El modelo de "procesamiento por items" de n8n es un concepto no evidente para un usuario sin experiencia técnica; el bajo código reduce la barrera de programación pero **no la elimina por completo**. Persiste una curva de aprendizaje de la lógica de la herramienta. Asimismo, la fricción #4 (un error críptico causado por un simple error de tipeo en el correo) ejemplifica cómo un mensaje de error técnico puede paralizar a un usuario no técnico, mientras que para un perfil con experiencia es trivial de diagnosticar.

---

## 9. Entorno técnico registrado

- **Base de datos:** PostgreSQL 16, archivos de configuración en `/etc/postgresql/16/main/`
- **n8n:** desplegado en Docker con base interna PostgreSQL propia (separada de la base del e-commerce)
- **Subred Docker:** `172.17.0.0/16`
- **Correo:** SMTP Gmail, puerto 465 con SSL, contraseña de aplicación
- **Conexión n8n → base del e-commerce:** directa vía nodo Postgres, acceso de solo lectura

---

## 10. Pendientes y notas para otros capítulos

- **Cap. 6 (Resultados):** el hallazgo de la sección 5.5 (receta multi-unidad, stock producible ≠ resta ingenua) y la partición de regímenes (sección 2) son evidencia real que reemplaza datos pendientes previos.
- **Carrito no persistente:** el sistema base no persiste el estado del carrito. El workflow de recuperación de carritos abandonados no es implementable sin modificar la plataforma. Documentar como limitación de la plataforma base y línea de mejora propuesta.
- **Productos con receta y `stock_quantity` residual:** existe la oportunidad de un workflow complementario de integridad de datos (detectar productos con receta y `stock_quantity != 0` para normalizarlos a 0). Registrado como sub-caso de calidad de datos, no prioritario.
