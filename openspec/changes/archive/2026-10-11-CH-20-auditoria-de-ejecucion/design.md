# Design: CH-20 — Query execution audit

Inputs: proposal.md, specs (`execution-audit`, `query-execution` and `query-console` deltas), DEC-159 to DEC-163, the exploration's map of execution paths.

## 1. Modules

| File | Role |
|---|---|
| `prisma/schema.prisma` + new migration | Table `RegistroEjecucion`, index `(tenantId, creadoEn)`, the immutability trigger |
| `src/aislamiento-prisma.ts` | `RegistroEjecucion` joins `MODELOS_AISLADOS` |
| `src/auditoria.ts` (new) | Pure: `filaDeAuditoria` (verdict + context → row data), `analizarFiltros` (query string → filters or `campos`). Effects: `registrarEjecucion(prisma, log, datos)`, `registerAuditoriaRoutes(app, prisma)` (`GET /auditoria`), `consultaGuardadaVerificada(prisma, id, version, sql)` |
| `src/consultas.ts` | Body takes `consultaGuardadaId` and `version`; records after the engine answers |
| `src/plantilla-prueba.ts`, `src/validacion-mapeo-rutas.ts`, `src/conexiones.ts` | One `registrarEjecucion` call each, after the engine answers |
| `src/rutas.ts` | Registers `GET /auditoria` |
| `src/consola.ts` | Sends the loaded query's id and version when the editor still holds its text |

## 2. Schema, migration and trigger

```prisma
model RegistroEjecucion {
  id                 String   @id @default(uuid())
  tenantId           String
  tenantNombre       String
  operadorId         String
  operadorNombre     String
  origen             String   // consulta | plantilla-prueba | validacion-mapeo | conexion-prueba
  conexionId         String
  consultaGuardadaId String?
  consultaVersion    Int?
  consultaNombre     String?
  plantillaId        String?
  sql                String
  resultado          String   // ok | fallo
  fase               String?
  categoria          String?
  codigo             String?
  filas              Int?
  duracionMs         Int?
  creadoEn           DateTime @default(now())

  @@index([tenantId, creadoEn])
}
```

No relations on purpose (DEC-162): the trigger forbids deletes, so a foreign key to `Tenant` would make deleting a tenant (test cleanup) fail. The migration, after the generated `CREATE TABLE`, adds:

```sql
CREATE FUNCTION registro_ejecucion_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'RegistroEjecucion es inmutable (DEC-162)';
END $$;
CREATE TRIGGER registro_ejecucion_sin_cambios BEFORE UPDATE OR DELETE ON "RegistroEjecucion"
  FOR EACH ROW EXECUTE FUNCTION registro_ejecucion_inmutable();
CREATE TRIGGER registro_ejecucion_sin_truncar BEFORE TRUNCATE ON "RegistroEjecucion"
  FOR EACH STATEMENT EXECUTE FUNCTION registro_ejecucion_inmutable();
```

Rollback in the header: `DROP TABLE "RegistroEjecucion"; DROP FUNCTION registro_ejecucion_inmutable();` (dropping the table drops its triggers). `prisma migrate diff` does not model triggers, so the drift check compares the table only; that is expected and noted in the migration header.

## 3. Recording

- `registrarEjecucion(prisma, log, datos)` runs inside the request, so the tenant context is active: `prisma.registroEjecucion.create({ data: conTenantInyectado({ ...fila }) })`. `tenantNombre` comes from the active tenant (`exigirTenantActivo()`), the operator from `request.operador`.
- The whole write is inside `try/catch`: on failure, `log.error({ origen, conexionId, error: nombre }, 'audit write failed')` — never the statement — and the function returns. Routes `await` it before replying, so a test sees the row, but its failure cannot change the reply.
- `filaDeAuditoria` maps the engine verdict: `ok` → `filas` (the page's rows) and `duracionMs`; `fallo` → `fase`, `categoria`, `codigo`, `duracionMs`. One mapping for the three engine paths.
- Per path:
  - `consulta`: `sql` is the request's `sql` as sent; saved query fields from the verification below.
  - `plantilla-prueba`: `sql` is the composed statement the engine ran; `plantillaId`.
  - `validacion-mapeo`: `sql` is the probe statements joined by `;\n`; `resultado` `fallo` if the session or any entity failed, with the session's or the first failing entity's `fase`/`categoria`/`codigo`; `filas` null.
  - `conexion-prueba`: `sql` is the probe's fixed `SELECT 1`; the probe's category and duration.
- Requests refused before the engine (validation 400s, 404s, 409s) return before the call, so they record nothing.

## 4. Saved query verification (`POST /consultas/ejecutar`)

- Body: `consultaGuardadaId: { type: 'string', minLength: 1 }`, `version: { type: 'integer', minimum: 1 }`; one without the other is a 400 (checked in the handler, as `campos: ['/version']` or `['/consultaGuardadaId']`).
- `consultaGuardadaVerificada(prisma, id, version, sql)`: scoped `consultaGuardada.findUnique({ where: { id } })`; if `version` equals the row's `version`, compare with the row's `sql`; otherwise read `consultaGuardadaVersion` by `(consultaGuardadaId, version)` and compare with its `sql`. Byte-for-byte `===`. Returns `{ id, version, nombre }` (the row's current name) or `null`. Runs after the engine answered, only when both fields came; it never affects the answer.

## 5. Listing (`GET /auditoria`)

- Query string: `desde`, `hasta` (parsed with `Date.parse`, must be ISO-like and valid), `resultado` (`ok` | `fallo`). Unknown keys are ignored like every GET in the project. Invalid → 400 `solicitud-invalida`, `campos: ['/desde']` etc.
- `findMany` scoped, `orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }]`, `take: LIMITE_LISTADO + 1`, `truncado`.
- Answers every column except `tenantId` (the tenant is the header's).

## 6. Console

The CH-25 state `consultaCargada` holds the loaded query's `id` and `nombre` only; it gains `version` and `sql` (the statement as loaded), set where it is assigned today. In `ejecutar()`, when `consultaCargada !== null` and `entradaSql.value === consultaCargada.sql`, the body adds `consultaGuardadaId` and `version`. Loading another query, switching tenant or editing the text changes nothing else; the comparison runs at send time.

## 7. Tests

| File | Covers |
|---|---|
| `src/auditoria.test.ts` (pure) | `filaDeAuditoria` for ok/fallo of each origin; `analizarFiltros` valid and invalid |
| `src/auditoria-tabla.test.ts` (live DB) | Scoped model; a direct `delete`, `update` and `TRUNCATE` are refused by the trigger; deleting a tenant with audit rows works |
| `src/auditoria-rutas.test.ts` (live DB) | `GET /auditoria`: order, filters, cap, 400s, two-tenant isolation |
| `src/auditoria-registro.test.ts` (live DB, real local target) | Each of the four routes writes one row with the operator; refused requests write nothing; bound values absent; a forced write failure keeps the 200 and logs `error` |
| `src/consultas-auditoria.test.ts` (live DB) | Saved query matched, edited text, unknown version, another tenant's id, one field without the other |
| `src/consola.test.ts` | The body carries id and version only while the loaded text is unchanged |
| `src/aislamiento.test.ts` | Model list adds `RegistroEjecucion` |

The recording tests use the local Compose database as the target connection, as the existing `consultas` route tests do.

## 8. Trade-offs
- **A write per page.** Paging re-executes the statement, so each page leaves a row. That is what ran.
- **No foreign keys.** Integrity of names is a snapshot, not a reference: renaming a tenant does not rewrite history, which is what an audit wants.
- **The trigger is outside Prisma's model.** Documented in the migration; a test proves it exists.

## 9. Size forecast
PR1 ~400 · PR2 ~350 · PR3 ~250. Total ~1000.
