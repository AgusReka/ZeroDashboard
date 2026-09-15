# Mapa de historias de usuario v4 — Plataforma multi-tenant de automatización para e-commerce PYME

**Cambios respecto de v3:**
1. Se cierra D-3: el motor de ejecución es propio. n8n queda documentado como alternativa evaluada y descartada.
2. Aparece el bloque X (motor), con planificación, historial y control de fallos.
3. Se incorpora anti-alcance específico del motor, que es donde el proyecto puede desbordarse sin que se note.

**Estado:** borrador. Cuatro compuertas siguen abiertas.

---

## 1. Decisión cerrada: motor propio

**Qué se construye:** un planificador acotado a un único patrón — *consulta → condición → notificación → registro*. Ese patrón cubre los tres casos ya validados (alerta de stock físico, alerta de stock producible, reporte diario).

**Por qué no n8n**, para el Cap. 4:
- La Sustainable Use License restringe el uso a fines internos y excluye alojar n8n cobrando por el acceso o embeberlo en un producto propio. El modelo multi-tenant de este trabajo cae de ese lado.
- La generalidad de n8n (editor visual, catálogo amplio de integraciones, modelo de ejecución por items) excede lo que el catálogo necesita.

**Qué pasa con los tres workflows actuales:** dejan de ser el artefacto y pasan a ser el estudio previo que define el patrón y el catálogo inicial. No se descartan; se reencuadran. Los capítulos 5 y 6 se reescriben con ese marco.

---

## 2. Compuertas abiertas

| # | Decisión | Opciones | Qué depende |
|---|---|---|---|
| **D-1** | ¿Se persisten los resultados, o solo las consultas? | Solo consultas / Resultados con retención acotada / Completos | Si custodiás datos personales de terceros |
| **D-2** | ¿Cómo llega el motor a la réplica del cliente? | Directa / Agente saliente / VPN | La barrera de entrada, que es tu hipótesis |
| **D-4** | Motores de base admitidos | Solo PostgreSQL / PostgreSQL y MySQL | Una o dos variantes por vista canónica |
| **D-5** | Segundo esquema para el R1 | Saleor, Medusa (PostgreSQL) / WooCommerce, PrestaShop (MySQL) | Depende de D-4 |

Recomendaciones: D-1 solo consultas y metadatos. D-2 agente saliente, porque es lo único que preserva el argumento de baja barrera.

---

## 3. Personas y reglas

| ID | Persona | Superficie | Visión |
|---|---|---|---|
| P1 | Implementador (vos) | Consola | Todos los tenants |
| P2 | Administrador PYME | Panel | Su tenant únicamente |
| P3 | Cliente final | Telegram | Su pedido |
| P4 | Investigador (vos) | Registro | Tiempos y fricciones |

**Reglas que no se negocian:**
1. P2 nunca ejecuta SQL arbitrario.
2. Ninguna consulta del panel puede devolver datos de otro tenant.
3. Toda conexión a base de cliente es de solo lectura, verificado en dos capas.
4. El motor solo ejecuta el patrón consulta-condición-notificación. Cualquier caso que no encaje se documenta como fuera de alcance, no se resuelve agregando capacidades al motor.

---

## 4. Historias

### T — Tenants y aislamiento

| ID | Historia | Criterio de aceptación | Release |
|---|---|---|---|
| T1 | Como P1, quiero dar de alta un tenant | Alta, baja lógica, listado; todo recurso pertenece a un tenant | R1 |
| T2 | Como P1, quiero que toda consulta a mi base esté filtrada por tenant | **Prueba automatizada con dos tenants: ninguna operación devuelve filas del otro** | R1 |
| T3 | Como P2, quiero ver únicamente mi información | Autenticación; el tenant nunca se toma de la petición del cliente | R2 |
| T4 | Como P1, quiero ver siempre contra qué tenant estoy operando | Indicador permanente e inequívoco en la consola | R1 |

### A — Conexiones y credenciales

| ID | Historia | Criterio de aceptación | Release |
|---|---|---|---|
| A1 | Como P1, quiero registrar la conexión a la réplica de un tenant | Prueba de conexión con resultado visible | R0 |
| A2 | Como P1, quiero credenciales cifradas en reposo con clave fuera de la base | Comprometer la base no alcanza para descifrarlas | R1 |
| A3 | Como P1, quiero que solo se admitan sentencias de lectura | Rechazo en la aplicación **y** usuario de base sin escritura | R0 |
| A4 | Como P1, quiero límites de tiempo y filas por consulta | Timeout y tope configurables, con corte y mensaje claro | R1 |
| A5 | Como P1, quiero auditoría de qué se ejecutó, cuándo, contra qué tenant y por quién | Registro consultable, no borrable desde la interfaz | R2 |

### C — Conectividad (depende de D-2)

| ID | Historia | Criterio de aceptación | Release |
|---|---|---|---|
| C1 | Como P1, quiero conectar sin que el cliente exponga su base a internet | El cliente no abre puertos entrantes | R2 |
| C2 | Como P1, quiero detectar un tenant inalcanzable | Estado visible, con aviso antes de que falle una ejecución programada | R2 |
| C3 | Como P4, quiero registrar cuánto costó resolver la conectividad en cada alta | Bitácora fechada por tenant | R2 |

### B — Consola: consultas

| ID | Historia | Criterio de aceptación | Release |
|---|---|---|---|
| B1 | Como P1, quiero escribir una consulta y ver el resultado | Editor, ejecución, tabla paginada, error legible | R0 |
| B2 | Como P1, quiero guardar una consulta con nombre y descripción | Persistencia en la base propia | R0 |
| B3 | Como P1, quiero parametrizar una consulta | Parámetros declarados, sustituidos de forma segura, nunca por concatenación | R1 |
| B4 | Como P1, quiero versionar los cambios de una consulta guardada | Historial con fecha; se puede volver atrás | R3 |

### M — Contrato canónico y mapeo

| ID | Historia | Criterio de aceptación | Release |
|---|---|---|---|
| M1 | Como P1, quiero ver qué entidades y campos exige el contrato | Listado con obligatorios y opcionales, y qué automatización depende de cada uno | R1 |
| M2 | Como P1, quiero registrar el mapeo del esquema de un tenant | Vistas canónicas generadas o registradas por tenant | R1 |
| M3 | Como P1, quiero validar el mapeo antes de activar nada | Verificación de columnas, tipos y reglas; falla ruidosamente | R1 |
| M4 | Como P1, quiero ver qué automatizaciones quedan inaplicables por datos ausentes | Lista con el motivo, visible también en el panel | R1 |
| M5 | Como P1, quiero que el contrato excluya campos personales innecesarios | Las vistas no exponen domicilio, teléfono ni correo salvo que una plantilla lo requiera | R1 |

### X — Motor de ejecución (**bloque nuevo**)

| ID | Historia | Criterio de aceptación | Release |
|---|---|---|---|
| X1 | Como P2, quiero que una automatización corra sola en el horario configurado | Planificador que dispara según expresión horaria por tenant | R1 (mínimo) |
| X2 | Como P1, quiero que cada ejecución quede registrada | Inicio, fin, duración, filas devueltas, estado, error si lo hubo | R1 |
| X3 | Como P2, quiero que la notificación se envíe solo si se cumple la condición | Sin filas, no se envía nada | R1 |
| X4 | Como P1, quiero que una automatización no se solape consigo misma | Si la ejecución anterior sigue corriendo, la nueva no arranca y queda registrado | R2 |
| X5 | Como P1, quiero que un fallo transitorio se reintente de forma acotada | Política de reintentos con tope; agotado el tope, se marca como fallida | R2 |
| X6 | Como P2, quiero no recibir el mismo aviso dos veces por un mismo evento | Control de envío: una ejecución produce como máximo una notificación | R2 |
| X7 | Como P1, quiero que una ejecución interrumpida no deje estado inconsistente | Al reiniciar el servicio, las ejecuciones colgadas se marcan como fallidas, no quedan "en curso" para siempre | R2 |
| X8 | Como P1, quiero que un fallo de un tenant no afecte a los demás | Aislamiento de errores en la ejecución; una conexión caída no detiene el planificador | R2 |

> X1 a X3 son el esqueleto mínimo: sin ellos no hay automatización, solo un editor de consultas. X4 a X8 son lo que separa un cron de juguete de algo presentable. X6 es el equivalente de la fricción del correo duplicado que ya documentaste en la bitácora de WF-01, ahora resuelto por diseño en vez de con un nodo de límite.

### N — Notificación y formato

| ID | Historia | Criterio de aceptación | Release |
|---|---|---|---|
| N1 | Como P2, quiero recibir el resultado por correo con formato legible | Reutiliza el HTML ya validado en los tres workflows | R1 |
| N2 | Como P2, quiero que el correo se vea bien también cuando no hay datos | Degradación elegante con mensaje, sin campos rotos | R1 |
| N3 | Como P1, quiero definir el formato de salida en la plantilla | Plantilla de correo asociada a la plantilla de automatización | R2 |

### D — Catálogo de plantillas

| ID | Historia | Criterio de aceptación | Release |
|---|---|---|---|
| D1 | Como P1, quiero definir una plantilla reutilizable | Consulta sobre vistas canónicas + parámetros + condición + formato + tolerancia de frescura | R1 |
| D2 | Como P1, quiero instanciar una plantilla para un tenant | Alta en dos pasos: elegir plantilla, completar parámetros | R2 |
| D3 | Como P1, quiero que el catálogo inicial cubra los casos validados | Stock físico, stock producible, reporte diario | R2 |

### F — Frescura de datos

| ID | Historia | Criterio de aceptación | Release |
|---|---|---|---|
| F1 | Como P1, quiero declarar cada cuánto se regenera la réplica de un tenant | Ventana de desactualización registrada por tenant | R2 |
| F2 | Como P1, quiero que cada plantilla declare qué antigüedad tolera | Atributo de la plantilla, no del tenant | R2 |
| F3 | Como P2, quiero que me adviertan si activo algo que mi réplica no sostiene | Advertencia explícita al activar; decide el cliente, informado | R3 |

### P — Panel del cliente

| ID | Historia | Criterio de aceptación | Release |
|---|---|---|---|
| P1h | Como P2, quiero ver mis automatizaciones activas y las disponibles | Estado, última ejecución, próxima | R2 |
| P2h | Como P2, quiero ajustar umbrales y horarios sin pedir nada | Formulario validado; efecto en la próxima ejecución | R2 |
| P3h | Como P2, quiero enterarme si algo falló | Estado de error visible y notificación | R2 |
| P4h | Como P2, quiero ver el último resultado sin abrir el correo | Tabla o gráfico armado, sin SQL a la vista. **Sujeto a D-1** | R3 |

### G — Instrumentación (tesis)

| ID | Historia | Criterio de aceptación | Release |
|---|---|---|---|
| G1 | Como P4, quiero medir cuánto llevó cada etapa del alta de un tenant | Marcas de tiempo de conexión, mapeo, validación y primera ejecución | R1 |
| G2 | Como P4, quiero registrar cada fricción con síntoma, causa y resolución | Bitácora fechada, escrita durante | R0 |
| G3 | Como P4, quiero que todo dato citado tenga consulta y fecha | Cada tabla de resultados remite a una consulta identificable | R0 |

---

## 5. Releases

**R0 — Consola mínima, local, un cliente.** A1, A3, B1, B2, G2, G3.
No depende de ninguna compuerta. Empezable hoy.

**R1 — Tenants, contrato, motor mínimo y segundo esquema.** T1, T2, T4, A2, A4, B3, M1–M5, X1–X3, N1, N2, D1, G1.
*Cierre:* dos tenants aislados, un esquema ajeno mapeado y validado, y una automatización corriendo sola de punta a punta. **Es el release que sostiene el capítulo de resultados.**

**R2 — Endurecimiento del motor, catálogo, panel y conectividad.** T3, A5, C1–C3, X4–X8, N3, D2, D3, F1, F2, P1h–P3h.
Requiere D-1 y D-2 cerradas.

**R3 — Refinamiento.** B4, F3, P4h.

---

## 6. Anti-alcance

### Del producto

| No se construye | Motivo |
|---|---|
| SQL arbitrario en el panel del cliente | Rompe el diferencial y hereda los riesgos |
| Constructor visual de consultas sin código | Territorio de herramientas de BI existentes |
| Capa de IA | Extensión futura ya documentada |
| Facturación y cobro | Fuera del alcance académico |

### Del motor (**crítico**)

El motor puede crecer indefinidamente sin que se note. Estos límites son la defensa:

| No se construye | Motivo |
|---|---|
| Editor visual de flujos | Es la mitad del valor de n8n y nada de lo que el catálogo necesita |
| Nodos de integración genéricos | El catálogo tiene destinos fijos: correo y Telegram |
| Ramificaciones, bucles y transformaciones encadenadas | El patrón es lineal: consulta, condición, notificación |
| Ejecución por items al estilo n8n | Una ejecución produce una notificación |
| Disparadores por webhook | Todo es programado, salvo el bot, que es caso aparte |

> Si aparece un caso de uso que el patrón no cubre, se documenta como límite del artefacto. No se amplía el motor. Ese registro es material del Cap. 6.

---

## 7. Riesgos a documentar (Cap. 4 y Cap. 6)

1. **Concentración de credenciales.** Comprometerte a vos compromete a todos los clientes.
2. **Aislamiento entre tenants.** Modo de falla clásico de la arquitectura.
3. **Barrera de conectividad.** Si el cliente debe exponer su base, la hipótesis de baja barrera queda en tensión.
4. **Frescura.** Las alertas valen lo que vale la última sincronización.
5. **Ejecución de SQL desde interfaz web.** Inyección, credenciales, consumo de recursos.
6. **Confianza en el mapeo.** Un mapeo incorrecto produce reportes plausibles y falsos.
7. **Fiabilidad del motor propio.** Lo que n8n resuelve por vos ahora es tuyo: solapamientos, reintentos, ejecuciones colgadas.
8. **Restricción de licencia como barrera no técnica.** El hallazgo sobre la Sustainable Use License.

---

## 8. Trazabilidad a la tesis

| Bloque | Alimenta |
|---|---|
| T, A, C | Cap. 4 arquitectura y análisis crítico; consideraciones éticas |
| M | Cap. 4, Cap. 7 contribución principal |
| X, N | Cap. 4 decisión de motor propio con alternativa evaluada; Cap. 5 diseño |
| D, P | Cap. 5 diseño |
| F | Cap. 4 decisiones, Cap. 6 limitaciones |
| R1 completo | Cap. 6 resultados, Cap. 8 generalización |
| G | Cap. 3 instrumentos, Cap. 6 barreras |
| Hallazgo de licencia | Cap. 4 decisión, Cap. 6 barreras no técnicas |
