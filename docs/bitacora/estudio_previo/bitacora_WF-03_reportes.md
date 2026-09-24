# Bitácora Técnica — WF-03: Reportes Operativos Diarios

**Proyecto:** Automatización inteligente para e-commerce de PYMES
**Caso de estudio:** Food Store (e-commerce de comidas, PostgreSQL)
**Workflow:** WF-03 — Reporte diario de ventas por correo
**Estado:** Implementado y validado sobre datos reales

> Documento de trabajo. Registra el proceso, las decisiones de diseño con su justificación, la evidencia obtenida y las fricciones técnicas encontradas durante la implementación. Alimenta los Capítulos 4 (arquitectura), 5 (diseño de workflows) y 6 (resultados) de la tesis.

---

## 1. Descripción del proceso

### 1.1 Situación previa (AS-IS)

En el sistema base, obtener una visión del desempeño diario exige que el administrador entre al panel, revise pedidos uno por uno y calcule mentalmente o en una planilla los totales: cuánto se vendió, qué productos salieron más, cuántos pedidos se entregaron o cancelaron. Es una tarea manual, repetitiva y propensa a error, que además rara vez se hace con consistencia diaria.

### 1.2 Situación automatizada (TO-BE)

Un workflow programado se ejecuta cada mañana, consulta la base de datos, agrega la información del día anterior (ventas, ranking de productos, desglose por estado) y envía un correo HTML con el resumen. El administrador recibe el reporte sin intervención: la información de gestión pasa de requerir trabajo activo a llegar sola.

---

## 2. Decisiones de diseño

### 2.1 Alcance del reporte

Se definió un reporte diario con tres bloques de información, seleccionados por su valor operativo para una PYME gastronómica:

- **Ventas del día:** cantidad de pedidos concretados, facturación total y ticket promedio.
- **Productos más vendidos:** ranking (top 5) por unidades vendidas.
- **Pedidos por estado:** desglose de cuántos pedidos quedaron en cada estado (entregado, confirmado, cancelado, etc.).

### 2.2 Periodicidad

Diaria, con resumen del día anterior. El Schedule se configuró para las 8:00, de modo que al iniciar la jornada el reporte del día previo ya está en la bandeja.

### 2.3 Formato

Correo HTML (no archivo adjunto). Justificación: reutiliza la infraestructura de email ya montada para las alertas de stock, se visualiza directamente en la bandeja sin pasos extra, y evita la complejidad de generar archivos PDF/Excel dentro de n8n. La generación de archivo adjunto se documenta como extensión futura.

### 2.4 Tratamiento de pedidos cancelados

Decisión de negocio con impacto en las queries: los pedidos cancelados **se excluyen de la facturación y del ranking de productos** (no son ventas reales), pero **sí se incluyen en el desglose por estado** (donde interesa verlos como métrica operativa). Esta asimetría es deliberada y se refleja en las cláusulas `WHERE` de cada query.

Evidencia de que la lógica opera correctamente: en la prueba del 21/06, la query de ventas contabilizó 3 pedidos ($13.000) mientras que el desglose por estado mostró 4 pedidos (2 entregados, 1 confirmado, 1 cancelado). La diferencia es exactamente el pedido cancelado, excluido de la facturación pero presente en el desglose.

### 2.5 Código de color semántico

El reporte usa azul (`#2563eb`) como color de acento, diferenciándolo de las alertas de stock (ámbar/rojo). El criterio: el reporte es **informativo**, no una alarma. Mantiene coherencia con el sistema de color semántico definido en WF-01.

---

## 3. Arquitectura de nodos

```
Schedule Trigger (diario, 8:00)
   └─→ Ventas (Postgres)
         └─→ ProductosTop (Postgres)
               └─→ Estados (Postgres)
                     └─→ Send Email (combina los tres resultados)
```

Las tres consultas se ejecutan en cadena. El nodo de email referencia cada nodo Postgres por su nombre (`$('Ventas')`, `$('ProductosTop')`, `$('Estados')`), técnica que permite combinar datos de múltiples nodos en un único mensaje sin importar la topología de conexión.

**Decisión de nombres:** los nodos Postgres se renombraron a `Ventas`, `ProductosTop` y `Estados` porque el HTML del email los invoca por nombre. Nombres descriptivos y estables son un requisito, no una cuestión estética.

---

## 4. Queries

### 4.1 Ventas del día

```sql
SELECT
    COUNT(*) AS cantidad_pedidos,
    COALESCE(SUM(p.total), 0) AS facturacion_total,
    COALESCE(ROUND(AVG(p.total), 2), 0) AS ticket_promedio
FROM pedido p
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE p.deleted_at IS NULL
  AND ep.codigo <> 'CANCELADO'
  AND p.created_at >= CURRENT_DATE - INTERVAL '1 day'
  AND p.created_at <  CURRENT_DATE;
```

El uso de `COALESCE` es clave: garantiza que aun sin ventas la query devuelva una fila con ceros en lugar de nulos o vacío, evitando que el reporte muestre campos rotos.

### 4.2 Productos más vendidos

```sql
SELECT
    dp.producto_nombre,
    SUM(dp.cantidad) AS unidades_vendidas,
    SUM(dp.subtotal) AS total_generado
FROM detalle_pedido dp
JOIN pedido p ON p.id = dp.pedido_id
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE dp.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND ep.codigo <> 'CANCELADO'
  AND p.created_at >= CURRENT_DATE - INTERVAL '1 day'
  AND p.created_at <  CURRENT_DATE
GROUP BY dp.producto_nombre
ORDER BY unidades_vendidas DESC
LIMIT 5;
```

### 4.3 Pedidos por estado

```sql
SELECT
    ep.descripcion AS estado,
    COUNT(*) AS cantidad
FROM pedido p
JOIN estado_pedido ep ON ep.id = p.estado_id
WHERE p.deleted_at IS NULL
  AND p.created_at >= CURRENT_DATE - INTERVAL '1 day'
  AND p.created_at <  CURRENT_DATE
GROUP BY ep.descripcion
ORDER BY cantidad DESC;
```

Nota: esta query, a diferencia de las otras dos, **no** excluye cancelados (ver decisión 2.4).

**Sobre fechas dinámicas vs. fijas:** durante el desarrollo se usó un rango fijo (`'2026-06-21'`) para validar contra datos existentes; en producción se usa el rango dinámico `CURRENT_DATE - INTERVAL '1 day'` a `CURRENT_DATE`, que siempre toma el día anterior sin intervención.

---

## 5. Fricciones técnicas encontradas

| # | Fricción | Causa | Resolución |
|---|---|---|---|
| 1 | Combinar tres queries en un solo email | Cada query es un nodo independiente | Referir a cada nodo por nombre (`$('Ventas')`, etc.) en el HTML |
| 2 | Campos en `undefined` en días sin ventas | Nodos que no devuelven filas rompen el `.map()`/`.all()` del HTML | Activar "Always Output Data" + HTML tolerante a vacíos |
| 3 | Tablas vacías poco prolijas cuando no hay datos | El `.map()` sobre array vacío no genera contenido | Ternario con mensaje "Sin ventas / Sin pedidos en el período" |

**Reflexión para la tesis:** la fricción #2 es especialmente ilustrativa. Un reporte que funciona perfecto en un día con ventas puede mostrar `undefined` en un día sin ventas —un caso límite que solo aparece al probarlo en la condición correcta. Un implementador sin experiencia podría no anticiparlo y desplegar un reporte que falla silenciosamente los días de baja actividad. La robustez ante datos vacíos no es opcional en un proceso desatendido: el workflow corre solo, sin nadie mirando, y debe comportarse bien en todos los escenarios, no solo en el feliz.

---

## 6. Diseño del correo

El correo HTML mantiene el sistema visual de las notificaciones de WF-01 (estilos inline, tablas para compatibilidad, encabezado con color de acento, pie discreto). Tres secciones diferenciadas:

- **Ventas del día:** filas con métrica y valor, facturación resaltada en verde.
- **Productos más vendidos:** tabla con producto, unidades y total; unidades resaltadas en azul.
- **Pedidos por estado:** tabla estado/cantidad.

Cada sección degrada con elegancia a un mensaje "Sin datos para el período" cuando no hay información, garantizando un reporte presentable todos los días.

---

## 7. Validación

Prueba realizada con datos reales del 21/06/2026:

- **Ventas:** 3 pedidos concretados, $13.000 de facturación, ticket promedio $4.333,33.
- **Productos top:** Hamburguesa Clásica (3 unidades, $4.500), Hamburguesa Nueva (2 unidades, $7.000).
- **Estados:** 2 entregados, 1 confirmado, 1 cancelado.

Prueba de día vacío (con rango dinámico apuntando a un día sin pedidos): el reporte llegó correctamente con ventas en cero y las tablas mostrando los mensajes de "sin datos", sin campos rotos. Ambos escenarios validados.

---

## 8. Entorno técnico registrado

- **Disparador:** Schedule Trigger, diario a las 8:00
- **Base de datos:** conexión directa de solo lectura a `food_store` (PostgreSQL 16)
- **Correo:** SMTP Gmail, puerto 465 con SSL, contraseña de aplicación (misma credencial que WF-01)
- **Nodos:** 1 Schedule + 3 Postgres + 1 Send Email

---

## 9. Notas para otros capítulos

- **Cap. 5 (Diseño):** este workflow demuestra capacidad analítica (agregaciones SQL: SUM, COUNT, AVG, GROUP BY, ranking con LIMIT), diferenciándose de los workflows de alerta que solo filtran.
- **Cap. 6 (Resultados):** el reporte convierte trabajo de gestión manual (revisar y calcular a mano) en un proceso desatendido; el valor no es velocidad sino **consistencia y disponibilidad** (el reporte llega todos los días sin depender de que alguien se acuerde de armarlo).
- **Extensión futura:** generación de archivo adjunto (PDF/Excel) para archivo histórico; reportes semanales/mensuales con comparativas de tendencia; inclusión de la sección de stock crítico integrada al mismo reporte.
