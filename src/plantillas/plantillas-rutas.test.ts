import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import { LIMITE_LISTADO } from '../consultas/consultas-guardadas.js';
import { registerPlantillaRoutes, type UsoDePlantillas } from './plantillas-rutas.js';

/**
 * CH-12 units 3 and 4: the template catalog's create, list, get (tasks 3.1–3.3) and
 * in-place replace (task 4.1, DEC-68). No request here carries `x-tenant-id`: the catalog
 * is global (DEC-61) and its routes are exempt by exact row, so every case below is also
 * a proof of that exemption.
 */

/** A body that passes every save-time check; each case overrides one field. */
const VALIDA = {
  nombre: 'CH-12 stock bajo',
  sql: 'SELECT * FROM v_producto WHERE "stockDisponible" < :umbral',
  parametros: [{ nombre: 'umbral', tipo: 'numero' }],
  entidades: ['producto'],
  automatizacion: 'stock-fisico',
  formato: 'correo-html',
  toleranciaFrescuraMinutos: 30,
};

/** What a body without client or message texts echoes back for them (DEC-182, DEC-188). */
const SIN_TEXTOS = { titulo: null, descripcion: null, encabezadoMensaje: null, lineaMensaje: null };

/** A valid pair of message texts and the test columns that cover its placeholders (CH-39). */
const MENSAJE = {
  encabezadoMensaje: 'Productos con poco stock',
  lineaMensaje: '{producto}: quedan {cantidad} unidades',
  columnasPrueba: ['producto', 'cantidad'],
};

interface CuerpoRechazo {
  error: string;
  campos: string[];
  terminos?: string[];
  marcadores?: string[];
  rechazados?: unknown[];
  problemas?: { parametro: string | null; motivo: string }[];
}

/**
 * Signature pin (Threat Matrix "an exempt handler reaching a scoped model"): the
 * registrar takes the `plantilla` delegate and the use port (CH-38, DEC-191), never the
 * client. Checked by `tsc --noEmit`; never called.
 */
export function firmaSoloDelegado(
  app: FastifyInstance,
  cliente: PrismaAislado,
  uso: UsoDePlantillas,
): void {
  // @ts-expect-error — the full client is not a `plantilla` delegate.
  registerPlantillaRoutes(app, cliente, uso);
  // The shape the catalog routes are wired with: (app, delegate, uso).
  registerPlantillaRoutes(app, cliente.plantilla, uso);
}

/** Port stand-in for suites where no request may reach the use rule. */
const usoQueNuncaDebeConsultarse: UsoDePlantillas = {
  enUso: async () => {
    throw new Error('un cuerpo rechazado consultó el uso');
  },
  reemplazarSiLibre: async () => {
    throw new Error('un cuerpo rechazado llegó a reemplazarSiLibre');
  },
};

/** The port as `src/app/rutas.ts` builds it, over the extended client. */
export function usoDePlantillas(aislado: PrismaAislado): UsoDePlantillas {
  return {
    enUso: (id) => aislado.automatizacion.plantillaEnUso(id),
    reemplazarSiLibre: (id, datos) => aislado.automatizacion.reemplazarPlantillaLibre(id, datos),
  };
}

// ---- 3.1/3.2/4.1 every rejection happens before any write, with no database at all

/** Every method throws: a rejected body that reached the table fails the case loudly. */
const plantillasQueNuncaDebenEscribirse = new Proxy({}, {
  get: (_objetivo, metodo) => async () => {
    throw new Error(`un cuerpo rechazado llegó a plantilla.${String(metodo)}`);
  },
}) as PrismaAislado['plantilla'];

describe('plantilla catalog — save-time rejections (CH-12 3.1, 3.2, 4.1)', () => {
  let app!: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    // The hooks get a client that throws too: an exempt route must not resolve a tenant.
    registrarContextoTenant(app, plantillasQueNuncaDebenEscribirse as unknown as PrismaAislado);
    registerPlantillaRoutes(app, plantillasQueNuncaDebenEscribirse, usoQueNuncaDebeConsultarse);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  async function rechazar(cambios: Record<string, unknown>, quitar?: string): Promise<CuerpoRechazo> {
    const payload: Record<string, unknown> = { ...VALIDA, ...cambios };
    if (quitar !== undefined) delete payload[quitar];
    const respuesta = await app.inject({ method: 'POST', url: '/plantillas', payload });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    const cuerpo = respuesta.json() as CuerpoRechazo;
    assert.equal(cuerpo.error, 'solicitud-invalida');
    return cuerpo;
  }

  test('3.1 nombre and sql are required and non-empty, each rejection naming its field', async () => {
    assert.deepEqual((await rechazar({}, 'nombre')).campos, ['/nombre']);
    assert.deepEqual((await rechazar({}, 'sql')).campos, ['/sql']);
    assert.deepEqual((await rechazar({ nombre: '' })).campos, ['/nombre']);
    // Blank once trimmed: it could never execute, so it can never be saved.
    assert.deepEqual((await rechazar({ sql: '   ' })).campos, ['/sql']);
  });

  test('3.1 an entity outside the contract is rejected naming the value', async () => {
    const cuerpo = await rechazar({ entidades: ['producto', 'cliente'] });
    assert.deepEqual(cuerpo.campos, ['/entidades/1']);
    assert.deepEqual(cuerpo.rechazados, ['cliente']);
  });

  test('3.1 entidades must be a non-empty list without duplicates', async () => {
    assert.deepEqual((await rechazar({ entidades: [] })).campos, ['/entidades']);
    assert.deepEqual((await rechazar({ entidades: ['insumo', 'insumo'] })).campos, ['/entidades']);
    assert.deepEqual((await rechazar({}, 'entidades')).campos, ['/entidades']);
  });

  test('3.1 an automatizacion outside AUTOMATIZACIONES is rejected naming the value', async () => {
    const cuerpo = await rechazar({ automatizacion: 'envio-abandonado' });
    assert.deepEqual(cuerpo.campos, ['/automatizacion']);
    assert.deepEqual(cuerpo.rechazados, ['envio-abandonado']);
  });

  test('3.1 formato accepts only correo-html', async () => {
    const cuerpo = await rechazar({ formato: 'pdf' });
    assert.deepEqual(cuerpo.campos, ['/formato']);
    assert.deepEqual(cuerpo.rechazados, ['pdf']);
    assert.deepEqual((await rechazar({}, 'formato')).campos, ['/formato']);
  });

  test('3.1 toleranciaFrescuraMinutos is a non-negative integer', async () => {
    for (const valor of [-1, 1.5, 'treinta']) {
      assert.deepEqual((await rechazar({ toleranciaFrescuraMinutos: valor })).campos, [
        '/toleranciaFrescuraMinutos',
      ]);
    }
  });

  test('3.1 an unknown property such as tenantId is rejected, never stripped', async () => {
    assert.deepEqual((await rechazar({ tenantId: 'otro' })).campos, ['/tenantId']);
  });

  test('3.2 a hand-written $1 is rejected whatever parametros declares', async () => {
    const sql = 'SELECT * FROM v_producto WHERE id = $1';
    for (const parametros of [[], [{ nombre: 'id', tipo: 'texto' }]]) {
      const cuerpo = await rechazar({ sql, parametros });
      assert.ok(cuerpo.campos.includes('/sql'), JSON.stringify(cuerpo));
      assert.ok(cuerpo.problemas?.some((p) => p.motivo === 'posicional-a-mano' && p.parametro === '$1'));
    }
  });

  test('3.2 a declared parameter the sql never uses is rejected naming it', async () => {
    const cuerpo = await rechazar({ parametros: [...VALIDA.parametros, { nombre: 'x', tipo: 'numero' }] });
    assert.deepEqual(cuerpo.problemas?.map((p) => [p.parametro, p.motivo]), [['x', 'sin-usar']]);
  });

  test('3.1 a client text with a forbidden term is refused naming the field and the terms', async () => {
    const cuerpo = await rechazar({ descripcion: 'Corre la consulta cada mañana' });
    assert.deepEqual(cuerpo.campos, ['/descripcion']);
    assert.deepEqual(cuerpo.terminos, ['consulta']);
    // Case-insensitive, and the same term in both fields is listed once.
    const varios = await rechazar({ titulo: 'Una CONSULTA SQL', descripcion: 'otra Consulta' });
    assert.deepEqual(varios.campos, ['/titulo', '/descripcion']);
    assert.deepEqual(varios.terminos, ['sql', 'consulta']);
  });

  test('3.1 a client text over its cap is refused naming the field, after trimming', async () => {
    const titulo = await rechazar({ titulo: 'a'.repeat(81) });
    assert.deepEqual(titulo.campos, ['/titulo']);
    assert.equal(titulo.terminos, undefined);
    assert.deepEqual((await rechazar({ descripcion: 'a'.repeat(201) })).campos, ['/descripcion']);
    assert.deepEqual((await rechazar({ titulo: `  ${'a'.repeat(81)}  ` })).campos, ['/titulo']);
  });

  test('3.1 titulo and descripcion are schema keys, not stripped as unknown ones', async () => {
    // Under `removeAdditional` a key missing from `propertyNames.enum` would vanish and the
    // body would be accepted; being refused for its content proves the key reached the check.
    assert.deepEqual((await rechazar({ titulo: 'Usa SQL' })).terminos, ['sql']);
    assert.deepEqual((await rechazar({ descripcion: 'Usa un timeout' })).terminos, ['timeout']);
    assert.deepEqual((await rechazar({ titulo: { uno: 1 } })).campos, ['/titulo']);
  });

  test('3.1 CH-39 a placeholder outside the test columns is refused naming each unknown name once', async () => {
    const cuerpo = await rechazar({ ...MENSAJE, lineaMensaje: '{producto}: {stock} ({stock})' });
    assert.deepEqual(cuerpo.campos, ['/lineaMensaje']);
    assert.deepEqual(cuerpo.marcadores, ['stock']);
    // The same answer on a replace, before any write.
    const respuesta = await app.inject({
      method: 'PUT',
      url: '/plantillas/cualquiera',
      payload: { ...VALIDA, ...MENSAJE, lineaMensaje: '{producto}: {stock} ({stock})' },
    });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.deepEqual((respuesta.json() as CuerpoRechazo).marcadores, ['stock']);
    // Order of first appearance, not alphabetical.
    assert.deepEqual((await rechazar({ ...MENSAJE, lineaMensaje: '{z} {a} {z}' })).marcadores, ['z', 'a']);
  });

  test('3.1 CH-39 placeholder names are exact: case and spaces count', async () => {
    const cuerpo = await rechazar({ ...MENSAJE, lineaMensaje: '{Producto}', columnasPrueba: ['producto'] });
    assert.deepEqual(cuerpo.marcadores, ['Producto']);
    assert.deepEqual(
      (await rechazar({ ...MENSAJE, lineaMensaje: '{ producto }', columnasPrueba: ['producto'] })).marcadores,
      [' producto '],
    );
  });

  test('3.1 CH-39 only one text is refused naming the absent one', async () => {
    assert.deepEqual((await rechazar({ ...MENSAJE }, 'encabezadoMensaje')).campos, ['/encabezadoMensaje']);
    assert.deepEqual((await rechazar({ ...MENSAJE }, 'lineaMensaje')).campos, ['/lineaMensaje']);
    // A blank text is absent, so a blank header beside a line is the same refusal.
    assert.deepEqual((await rechazar({ ...MENSAJE, encabezadoMensaje: '   ' })).campos, ['/encabezadoMensaje']);
  });

  test('3.1 CH-39 texts without test columns are refused naming /columnasPrueba', async () => {
    assert.deepEqual((await rechazar({ ...MENSAJE }, 'columnasPrueba')).campos, ['/columnasPrueba']);
    // An empty list is present, so every placeholder is unknown instead.
    const vacia = await rechazar({ ...MENSAJE, columnasPrueba: [] });
    assert.deepEqual(vacia.campos, ['/lineaMensaje']);
    assert.deepEqual(vacia.marcadores, ['producto', 'cantidad']);
  });

  test('3.1 CH-39 columnasPrueba is a bounded array of strings', async () => {
    const larga = Array.from({ length: 201 }, (_, i) => `c${i}`);
    assert.deepEqual((await rechazar({ ...MENSAJE, columnasPrueba: larga })).campos, ['/columnasPrueba']);
    assert.deepEqual((await rechazar({ ...MENSAJE, columnasPrueba: [{ a: 1 }] })).campos, ['/columnasPrueba/0']);
  });

  test('3.1 CH-39 a placeholder in the header is refused with its names', async () => {
    const cuerpo = await rechazar({ ...MENSAJE, encabezadoMensaje: 'Stock de {deposito} y {zona} {deposito}' });
    assert.deepEqual(cuerpo.campos, ['/encabezadoMensaje']);
    assert.deepEqual(cuerpo.marcadores, ['deposito', 'zona']);
  });

  test('3.1 CH-39 a line without placeholders is refused, and lone or empty braces are literal text', async () => {
    assert.deepEqual((await rechazar({ ...MENSAJE, lineaMensaje: 'Revisá el stock' })).campos, ['/lineaMensaje']);
    assert.deepEqual((await rechazar({ ...MENSAJE, lineaMensaje: 'abre { y cierra } {}' })).campos, ['/lineaMensaje']);
  });

  test('3.1 CH-39 the glossary reads the literal text only, header and line', async () => {
    const linea = await rechazar({
      ...MENSAJE,
      lineaMensaje: '{producto} según la consulta',
      columnasPrueba: ['producto'],
    });
    assert.deepEqual(linea.campos, ['/lineaMensaje']);
    assert.deepEqual(linea.terminos, ['consulta']);
    const encabezado = await rechazar({ ...MENSAJE, encabezadoMensaje: 'Una consulta' });
    assert.deepEqual(encabezado.campos, ['/encabezadoMensaje']);
    const ambos = await rechazar({ ...MENSAJE, encabezadoMensaje: 'Un SQL', lineaMensaje: '{producto} timeout' });
    assert.deepEqual(ambos.campos, ['/encabezadoMensaje', '/lineaMensaje']);
    assert.deepEqual(ambos.terminos, ['sql', 'timeout']);
  });

  test('3.1 CH-39 a text over its cap is refused after trimming', async () => {
    const sobrante = `{producto}${'a'.repeat(291)}`;
    assert.equal(sobrante.length, 301);
    assert.deepEqual((await rechazar({ ...MENSAJE, lineaMensaje: sobrante })).campos, ['/lineaMensaje']);
    assert.deepEqual((await rechazar({ ...MENSAJE, encabezadoMensaje: 'a'.repeat(201) })).campos, [
      '/encabezadoMensaje',
    ]);
    assert.deepEqual(
      (await rechazar({ ...MENSAJE, encabezadoMensaje: 'a'.repeat(201), lineaMensaje: sobrante })).campos,
      ['/encabezadoMensaje', '/lineaMensaje'],
    );
    // Spaces around a text at its cap do not count: it passes the cap and fails only the next
    // step that applies (here the missing test columns).
    const alTope = `{producto}${'a'.repeat(290)}`;
    assert.equal(alTope.length, 300);
    assert.deepEqual((await rechazar({ ...MENSAJE, lineaMensaje: `  ${alTope}  ` }, 'columnasPrueba')).campos, [
      '/columnasPrueba',
    ]);
  });

  test('3.1 CH-39 the steps run in spec order and the first refusal wins', async () => {
    // 1 pairing beats 2 caps, 3 static header and 6 columns.
    assert.deepEqual(
      (await rechazar({ encabezadoMensaje: `{x}${'a'.repeat(300)}`, columnasPrueba: [] }, 'lineaMensaje')).campos,
      ['/lineaMensaje'],
    );
    // 2 caps beat 3 static header.
    const largo = await rechazar({ ...MENSAJE, encabezadoMensaje: `{x}${'a'.repeat(200)}` });
    assert.equal(largo.marcadores, undefined);
    // 3 static header beats 4 line without placeholders and 5 glossary.
    const estatico = await rechazar({ ...MENSAJE, encabezadoMensaje: '{x} consulta', lineaMensaje: 'sin marcadores' });
    assert.deepEqual(estatico.campos, ['/encabezadoMensaje']);
    assert.equal(estatico.terminos, undefined);
    // 4 line without placeholders beats 5 glossary.
    const sinDatos = await rechazar({ ...MENSAJE, lineaMensaje: 'la consulta', columnasPrueba: [] });
    assert.equal(sinDatos.terminos, undefined);
    // 5 glossary beats 6 columns.
    const glosario = await rechazar({ ...MENSAJE, lineaMensaje: '{nada} consulta', columnasPrueba: [] });
    assert.deepEqual(glosario.terminos, ['consulta']);
    assert.equal(glosario.marcadores, undefined);
  });

  test('3.1 CH-39 a client-text refusal wins over a message-text one, and a message one over the SQL checks', async () => {
    const cliente = await rechazar({ ...MENSAJE, titulo: 'a'.repeat(81), lineaMensaje: 'sin marcadores' });
    assert.deepEqual(cliente.campos, ['/titulo']);
    assert.equal(cliente.marcadores, undefined);
    const mensaje = await rechazar({ ...MENSAJE, sql: '   ', lineaMensaje: 'sin marcadores' });
    assert.deepEqual(mensaje.campos, ['/lineaMensaje']);
  });

  test('3.1 CH-39 the message keys are schema keys, not stripped as unknown ones', async () => {
    // A key missing from `propertyNames.enum` would be removed and the body accepted.
    const cuerpo = await rechazar({ encabezadoMensaje: 'x', lineaMensaje: '{a}', columnasPrueba: [] });
    assert.deepEqual(cuerpo.marcadores, ['a']);
  });

  test('4.1 a replace runs the same save-time checks before any write', async () => {
    const reemplazar = async (payload: Record<string, unknown>): Promise<CuerpoRechazo> => {
      const respuesta = await app.inject({ method: 'PUT', url: '/plantillas/cualquiera', payload });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      return respuesta.json() as CuerpoRechazo;
    };
    assert.deepEqual((await reemplazar({ ...VALIDA, tenantId: 'otro' })).campos, ['/tenantId']);
    const enumerado = await reemplazar({ ...VALIDA, automatizacion: 'envio-abandonado' });
    assert.deepEqual(enumerado.rechazados, ['envio-abandonado']);
    assert.deepEqual((await reemplazar({ ...VALIDA, sql: '  ' })).campos, ['/sql']);
    const posicional = await reemplazar({ ...VALIDA, sql: 'SELECT * FROM v_producto WHERE id = $1' });
    assert.ok(posicional.problemas?.some((p) => p.motivo === 'posicional-a-mano'), JSON.stringify(posicional));
    const conTermino = await reemplazar({ ...VALIDA, descripcion: 'Corre la consulta cada mañana' });
    assert.deepEqual(conTermino.campos, ['/descripcion']);
    assert.deepEqual(conTermino.terminos, ['consulta']);
    assert.deepEqual((await reemplazar({ ...VALIDA, titulo: 'a'.repeat(81) })).campos, ['/titulo']);
  });
});

// ---- CH-38 the use rule's HTTP mapping, with a fake port and no database -----------

describe('plantilla catalog — use rule over a fake port (CH-38, DEC-191)', () => {
  const FILA = {
    id: 'p-1',
    nombre: 'Plantilla',
    sql: 'SELECT 1',
    parametros: [],
    entidades: ['producto'],
    automatizacion: 'stock-fisico',
    formato: 'correo-html',
    toleranciaFrescuraMinutos: 30,
    titulo: null,
    descripcion: null,
    encabezadoMensaje: null,
    lineaMensaje: null,
  };
  let app!: FastifyInstance;
  let enUso = false;
  let resultadoReemplazo: 'no-encontrada' | 'en-uso' | typeof FILA = FILA;
  const llamadas: string[] = [];

  before(async () => {
    const plantillas = {
      findUnique: async () => FILA,
      create: async () => FILA,
    } as unknown as PrismaAislado['plantilla'];
    app = Fastify({ logger: false });
    registerPlantillaRoutes(app, plantillas, {
      enUso: async (id) => (llamadas.push(`enUso:${id}`), enUso),
      reemplazarSiLibre: async (id) => (llamadas.push(`reemplazar:${id}`), resultadoReemplazo),
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('GET /:id carries enUso from the port, and nothing else about use', async () => {
    for (const valor of [true, false]) {
      enUso = valor;
      const respuesta = await app.inject({ method: 'GET', url: '/plantillas/p-1' });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.deepEqual(respuesta.json(), { plantilla: { ...FILA, enUso: valor } });
    }
  });

  test('POST answers 201 with enUso false and never asks the port', async () => {
    llamadas.length = 0;
    const respuesta = await app.inject({ method: 'POST', url: '/plantillas', payload: VALIDA });
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    assert.equal((respuesta.json() as { plantilla: { enUso: boolean } }).plantilla.enUso, false);
    assert.deepEqual(llamadas, []);
  });

  test('PUT maps the three outcomes of the port to 404, 409 and 200', async () => {
    resultadoReemplazo = 'no-encontrada';
    const noEncontrada = await app.inject({ method: 'PUT', url: '/plantillas/p-1', payload: VALIDA });
    assert.equal(noEncontrada.statusCode, 404, noEncontrada.body);
    assert.deepEqual(noEncontrada.json(), { error: 'plantilla-no-encontrada' });

    resultadoReemplazo = 'en-uso';
    const ocupada = await app.inject({ method: 'PUT', url: '/plantillas/p-1', payload: VALIDA });
    assert.equal(ocupada.statusCode, 409, ocupada.body);
    assert.deepEqual(ocupada.json(), { error: 'plantilla-en-uso' });

    resultadoReemplazo = FILA;
    const libre = await app.inject({ method: 'PUT', url: '/plantillas/p-1', payload: VALIDA });
    assert.equal(libre.statusCode, 200, libre.body);
    assert.deepEqual(libre.json(), { plantilla: { ...FILA, enUso: false } });
  });

  test('a 400 body never reaches the port, even for a template in use', async () => {
    llamadas.length = 0;
    resultadoReemplazo = 'en-uso';
    const respuesta = await app.inject({
      method: 'PUT',
      url: '/plantillas/p-1',
      payload: { ...VALIDA, sql: 'SELECT * FROM v_producto WHERE id = $1' },
    });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.deepEqual(llamadas, []);
  });
});

// ---- 3.1/3.3/4.1 create, list, get and replace against a live PostgreSQL -----------

const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};
const databaseUrl =
  `postgresql://${encodeURIComponent(objetivo.user)}:${encodeURIComponent(objetivo.password)}` +
  `@${objetivo.host}:${objetivo.port}/${objetivo.database}`;

/** One TCP handshake, no driver: decides whether this suite has a server to talk to. */
function esAlcanzable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const cerrar = (alcanzable: boolean): void => {
      socket.destroy();
      resolve(alcanzable);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => cerrar(true));
    socket.once('timeout', () => cerrar(false));
    socket.once('error', () => cerrar(false));
  });
}

const motivoSkip: string | false = (await esAlcanzable(objetivo.host, objetivo.port, 1000))
  ? false
  : `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — set TEST_DB_*`;

describe('plantilla catalog — create, list, get, replace (CH-12 3.1, 3.3, 4.1)', { skip: motivoSkip }, () => {
  let app!: FastifyInstance;
  /** The raw client: fixtures and cleanup only. The app gets the extended one. */
  let prisma!: PrismaClient;
  const marca = `CH-12 u3 ${Date.now()}`;
  // Per-file tag in the client titles: `Plantilla` is global and `test:db` runs every file
  // at once, so a titled template must not look like another file's. No glossary term in it.
  const etiqueta = `ch37-rutas-${randomBytes(3).toString('hex')}`;

  before(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    const aislado = extenderConAislamiento(prisma);
    app = Fastify({ logger: false });
    registrarContextoTenant(app, aislado);
    registerPlantillaRoutes(app, aislado.plantilla, usoDePlantillas(aislado));
    await app.ready();
  });

  after(async () => {
    await prisma.plantilla.deleteMany({ where: { nombre: { startsWith: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  async function crear(cambios: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const payload = { ...VALIDA, nombre: marca, ...cambios };
    const respuesta = await app.inject({ method: 'POST', url: '/plantillas', payload });
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    return (respuesta.json() as { plantilla: Record<string, unknown> }).plantilla;
  }

  test('3.1 a headerless create persists every field it echoes back', async () => {
    const creada = await crear({ nombre: `${marca} alta`, entidades: ['insumo', 'producto'] });
    const { id, enUso, ...campos } = creada;
    assert.ok(typeof id === 'string' && id.length > 0);
    assert.equal(enUso, false);
    assert.deepEqual(campos, {
      ...VALIDA,
      ...SIN_TEXTOS,
      nombre: `${marca} alta`,
      entidades: ['insumo', 'producto'],
    });
    assert.deepEqual(await prisma.plantilla.findUnique({ where: { id } }), { id, ...campos });
  });

  test('3.1 a create with client texts echoes them trimmed, and get-by-id returns the same', async () => {
    const creada = await crear({
      nombre: `${marca} con textos`,
      titulo: `  Aviso de prueba ${etiqueta} `,
      descripcion: ' Una descripción limpia. ',
    });
    assert.equal(creada.titulo, `Aviso de prueba ${etiqueta}`);
    assert.equal(creada.descripcion, 'Una descripción limpia.');
    const respuesta = await app.inject({ method: 'GET', url: `/plantillas/${String(creada.id)}` });
    assert.deepEqual(respuesta.json(), { plantilla: creada });
    const guardada = await prisma.plantilla.findUnique({ where: { id: String(creada.id) } });
    assert.equal(guardada?.titulo, `Aviso de prueba ${etiqueta}`);
  });

  test('3.1 a create without client texts stores null for both', async () => {
    const creada = await crear({ nombre: `${marca} sin textos` });
    assert.equal(creada.titulo, null);
    assert.equal(creada.descripcion, null);
  });

  test('3.1 a blank text and a JSON null are stored as null', async () => {
    const enBlanco = await crear({ nombre: `${marca} en blanco`, titulo: '   ', descripcion: '\t' });
    assert.equal(enBlanco.titulo, null);
    assert.equal(enBlanco.descripcion, null);
    // Fastify's AJV coerces a JSON null to `''`, which is then stored as null.
    const nulos = await crear({ nombre: `${marca} nulos`, titulo: null, descripcion: null });
    assert.equal(nulos.titulo, null);
    assert.equal(nulos.descripcion, null);
  });

  test('3.1 texts exactly at their caps are accepted, spaces around them do not count', async () => {
    const titulo = `${'a'.repeat(80 - etiqueta.length - 1)} ${etiqueta}`;
    assert.equal(titulo.length, 80);
    const creada = await crear({
      nombre: `${marca} tope textos`,
      titulo: ` ${titulo} `,
      descripcion: 'd'.repeat(200),
    });
    assert.equal(creada.titulo, titulo);
    assert.equal(creada.descripcion, 'd'.repeat(200));
  });

  test('3.1 a rejected client text writes no row', async () => {
    const nombre = `${marca} rechazada`;
    const respuesta = await app.inject({
      method: 'POST',
      url: '/plantillas',
      payload: { ...VALIDA, nombre, descripcion: 'Corre la consulta cada mañana' },
    });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.equal(await prisma.plantilla.count({ where: { nombre } }), 0);
  });

  test('3.1 every AUTOMATIZACIONES value is accepted', async () => {
    for (const automatizacion of ['stock-fisico', 'stock-producible', 'reporte-diario']) {
      assert.equal((await crear({ automatizacion })).automatizacion, automatizacion);
    }
  });

  test('3.3 a headerless get-by-id returns exactly what create echoed', async () => {
    const creada = await crear({ nombre: `${marca} consulta` });
    const respuesta = await app.inject({ method: 'GET', url: `/plantillas/${String(creada.id)}` });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    assert.deepEqual(respuesta.json(), { plantilla: creada });
  });

  test('3.3 the headerless list is a summary ordered by nombre, then id', async () => {
    const b = await crear({ nombre: `${marca} orden b`, sql: 'SELECT 1 AS marca_u3_b', parametros: [] });
    // `a` carries client texts, so the summary is shown to leave them out.
    const a = await crear({
      nombre: `${marca} orden a`,
      titulo: `Aviso ${etiqueta}`,
      descripcion: 'Texto para el cliente',
    });
    const respuesta = await app.inject({ method: 'GET', url: '/plantillas' });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const { plantillas, truncado } = respuesta.json() as {
      plantillas: { id: string }[];
      truncado: boolean;
    };
    assert.equal(truncado, false);
    const ids = plantillas.map((p) => p.id);
    assert.ok(ids.indexOf(String(a.id)) >= 0 && ids.indexOf(String(a.id)) < ids.indexOf(String(b.id)));
    assert.deepEqual(Object.keys(plantillas[ids.indexOf(String(a.id))]).sort(), [
      'automatizacion',
      'formato',
      'id',
      'nombre',
      'toleranciaFrescuraMinutos',
    ]);
    assert.ok(!respuesta.body.includes('marca_u3_b'), 'no stored sql may reach the list payload');
  });

  test(`3.3 the list is capped at ${LIMITE_LISTADO} rows and says so with truncado`, async () => {
    const prefijo = `${marca} tope `;
    try {
      await prisma.plantilla.createMany({
        data: Array.from({ length: LIMITE_LISTADO + 1 }, (_, i) => ({
          ...VALIDA,
          nombre: `${prefijo}${String(i).padStart(4, '0')}`,
        })),
      });
      const respuesta = await app.inject({ method: 'GET', url: '/plantillas' });
      const cuerpo = respuesta.json() as { plantillas: unknown[]; truncado: boolean };
      assert.equal(cuerpo.plantillas.length, LIMITE_LISTADO);
      assert.equal(cuerpo.truncado, true);
    } finally {
      await prisma.plantilla.deleteMany({ where: { nombre: { startsWith: prefijo } } });
    }
  });

  test('3.3 an unknown or malformed id answers 404 plantilla-no-encontrada', async () => {
    for (const id of ['11111111-2222-3333-4444-555555555555', 'no-es-un-uuid']) {
      const respuesta = await app.inject({ method: 'GET', url: `/plantillas/${id}` });
      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'plantilla-no-encontrada' });
    }
  });

  test('4.1 round-trip: get returns the original, a headerless PUT replaces it in place', async () => {
    const prefijo = `${marca} reemplazo`;
    const creada = await crear({ nombre: `${prefijo} v1` });
    const url = `/plantillas/${String(creada.id)}`;

    const leida = await app.inject({ method: 'GET', url });
    assert.deepEqual(leida.json(), { plantilla: creada });

    const nueva = {
      ...VALIDA,
      nombre: `${prefijo} v2`,
      sql: 'SELECT i.nombre FROM v_insumo i JOIN v_producto p ON true WHERE i."stockDisponible" < :minimo',
      parametros: [{ nombre: 'minimo', tipo: 'numero' }],
      entidades: ['producto', 'insumo'],
      automatizacion: 'stock-producible',
      toleranciaFrescuraMinutos: 0,
    };
    const respuesta = await app.inject({ method: 'PUT', url, payload: nueva });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const { plantilla } = respuesta.json() as { plantilla: Record<string, unknown> };
    assert.deepEqual(plantilla, { id: creada.id, ...nueva, ...SIN_TEXTOS, enUso: false });

    // In place: the same row now holds the new fields, and no second row was written.
    const { enUso: _enUso, ...columnas } = plantilla;
    assert.deepEqual(await prisma.plantilla.findUnique({ where: { id: String(creada.id) } }), columnas);
    assert.equal(await prisma.plantilla.count({ where: { nombre: { startsWith: prefijo } } }), 1);
    assert.deepEqual((await app.inject({ method: 'GET', url })).json(), { plantilla });
  });

  test('4.1 a PUT without the texts clears them; a PUT with a forbidden term changes nothing', async () => {
    const creada = await crear({
      nombre: `${marca} limpiar`,
      titulo: `Aviso de prueba ${etiqueta}`,
      descripcion: 'Una descripción limpia.',
    });
    const url = `/plantillas/${String(creada.id)}`;

    const rechazada = await app.inject({
      method: 'PUT',
      url,
      payload: { ...VALIDA, nombre: `${marca} limpiar`, titulo: 'Corre la consulta' },
    });
    assert.equal(rechazada.statusCode, 400, rechazada.body);
    assert.deepEqual((await app.inject({ method: 'GET', url })).json(), { plantilla: creada });

    const respuesta = await app.inject({ method: 'PUT', url, payload: { ...VALIDA, nombre: `${marca} limpiar` } });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const { plantilla } = respuesta.json() as { plantilla: Record<string, unknown> };
    assert.equal(plantilla.titulo, null);
    assert.equal(plantilla.descripcion, null);
    const guardada = await prisma.plantilla.findUnique({ where: { id: String(creada.id) } });
    assert.equal(guardada?.titulo, null);
    assert.equal(guardada?.descripcion, null);
  });

  test('3.1 CH-39 a create with message texts echoes both, without columnasPrueba, and get-by-id agrees', async () => {
    const creada = await crear({
      nombre: `${marca} mensaje`,
      ...MENSAJE,
      encabezadoMensaje: '  Productos con poco stock  ',
    });
    assert.equal(creada.encabezadoMensaje, MENSAJE.encabezadoMensaje);
    assert.equal(creada.lineaMensaje, MENSAJE.lineaMensaje);
    assert.equal('columnasPrueba' in creada, false);
    const leida = await app.inject({ method: 'GET', url: `/plantillas/${String(creada.id)}` });
    assert.deepEqual(leida.json(), { plantilla: creada });
    const guardada = await prisma.plantilla.findUnique({ where: { id: String(creada.id) } });
    assert.deepEqual(
      [guardada?.encabezadoMensaje, guardada?.lineaMensaje],
      [MENSAJE.encabezadoMensaje, MENSAJE.lineaMensaje],
    );
    assert.equal(guardada !== null && 'columnasPrueba' in guardada, false);
  });

  test('3.1 CH-39 a create without message texts stores null for both, and the list summary has neither', async () => {
    const creada = await crear({ nombre: `${marca} sin mensaje` });
    assert.equal(creada.encabezadoMensaje, null);
    assert.equal(creada.lineaMensaje, null);
    const lista = await app.inject({ method: 'GET', url: '/plantillas' });
    const resumen = (lista.json() as { plantillas: Record<string, unknown>[] }).plantillas;
    assert.ok(resumen.length > 0);
    assert.ok(resumen.every((p) => !('encabezadoMensaje' in p) && !('lineaMensaje' in p)));
  });

  test('3.1 CH-39 columnasPrueba without texts is accepted, ignored, and never stored or echoed', async () => {
    const creada = await crear({ nombre: `${marca} columnas sueltas`, columnasPrueba: ['a', 'b'] });
    assert.equal('columnasPrueba' in creada, false);
    assert.equal(creada.encabezadoMensaje, null);
    assert.equal(creada.lineaMensaje, null);
  });

  test('3.1 CH-39 blank texts are absent, and the glossary ignores placeholder names', async () => {
    const enBlanco = await crear({
      nombre: `${marca} mensaje en blanco`,
      encabezadoMensaje: '  ',
      lineaMensaje: '\t',
    });
    assert.equal(enBlanco.encabezadoMensaje, null);
    assert.equal(enBlanco.lineaMensaje, null);
    const glosario = await crear({
      nombre: `${marca} marcador de glosario`,
      encabezadoMensaje: 'Aviso',
      lineaMensaje: '{consulta}: revisar',
      columnasPrueba: ['consulta'],
    });
    assert.equal(glosario.lineaMensaje, '{consulta}: revisar');
  });

  test('3.1 CH-39 texts exactly at their caps are accepted', async () => {
    const linea = `{producto}${'l'.repeat(290)}`;
    const creada = await crear({
      nombre: `${marca} tope mensaje`,
      encabezadoMensaje: ` ${'h'.repeat(200)} `,
      lineaMensaje: ` ${linea} `,
      columnasPrueba: ['producto'],
    });
    assert.equal(creada.encabezadoMensaje, 'h'.repeat(200));
    assert.equal(creada.lineaMensaje, linea);
  });

  test('3.1 CH-39 a rejected message writes no row, on create and on replace', async () => {
    const nombre = `${marca} mensaje rechazado`;
    const rechazada = await app.inject({
      method: 'POST',
      url: '/plantillas',
      payload: { ...VALIDA, nombre, ...MENSAJE, lineaMensaje: '{stock}' },
    });
    assert.equal(rechazada.statusCode, 400, rechazada.body);
    assert.equal(await prisma.plantilla.count({ where: { nombre } }), 0);
    const creada = await crear({ nombre: `${marca} mensaje intacto`, ...MENSAJE });
    const url = `/plantillas/${String(creada.id)}`;
    const reemplazo = await app.inject({
      method: 'PUT',
      url,
      payload: { ...VALIDA, nombre: `${marca} mensaje intacto`, ...MENSAJE, lineaMensaje: '{stock}' },
    });
    assert.equal(reemplazo.statusCode, 400, reemplazo.body);
    assert.deepEqual((reemplazo.json() as CuerpoRechazo).marcadores, ['stock']);
    assert.deepEqual((await app.inject({ method: 'GET', url })).json(), { plantilla: creada });
  });

  test('4.1 CH-39 a PUT replaces the texts, and a PUT without them stores both as null', async () => {
    const creada = await crear({ nombre: `${marca} mensaje reemplazo`, ...MENSAJE });
    const url = `/plantillas/${String(creada.id)}`;
    const nuevo = await app.inject({
      method: 'PUT',
      url,
      payload: {
        ...VALIDA,
        nombre: `${marca} mensaje reemplazo`,
        encabezadoMensaje: 'Otro encabezado',
        lineaMensaje: '{cantidad} de {producto}',
        columnasPrueba: ['producto', 'cantidad'],
      },
    });
    assert.equal(nuevo.statusCode, 200, nuevo.body);
    const { plantilla } = nuevo.json() as { plantilla: Record<string, unknown> };
    assert.equal(plantilla.encabezadoMensaje, 'Otro encabezado');
    assert.equal(plantilla.lineaMensaje, '{cantidad} de {producto}');
    assert.equal('columnasPrueba' in plantilla, false);
    const sin = await app.inject({ method: 'PUT', url, payload: { ...VALIDA, nombre: `${marca} mensaje reemplazo` } });
    assert.equal(sin.statusCode, 200, sin.body);
    const guardada = await prisma.plantilla.findUnique({ where: { id: String(creada.id) } });
    assert.equal(guardada?.encabezadoMensaje, null);
    assert.equal(guardada?.lineaMensaje, null);
  });

  test('4.1 a PUT naming no row answers 404 and writes nothing', async () => {
    const prefijo = `${marca} fantasma`;
    for (const id of ['11111111-2222-3333-4444-555555555555', 'no-es-un-uuid']) {
      const respuesta = await app.inject({
        method: 'PUT',
        url: `/plantillas/${id}`,
        payload: { ...VALIDA, nombre: prefijo },
      });
      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'plantilla-no-encontrada' });
    }
    assert.equal(await prisma.plantilla.count({ where: { nombre: { startsWith: prefijo } } }), 0);
  });

  /**
   * CH-38 (DEC-191): a tenant B with a connection and automations on a template. Everything it
   * creates is removed in the same case, children first (every foreign key is RESTRICT).
   */
  async function conTenantConAutomaciones(
    plantillaId: string,
    activos: boolean[],
    cuerpo: () => Promise<void>,
  ): Promise<void> {
    const tenant = await prisma.tenant.create({ data: { nombre: `${marca} tenant B ${randomBytes(3).toString('hex')}` } });
    try {
      const conexion = await prisma.conexion.create({
        data: {
          tenantId: tenant.id,
          nombre: 'CH-38 uso',
          motor: 'postgres',
          host: 'localhost',
          puerto: 5432,
          baseDeDatos: 'ninguna',
          usuarioDb: 'nadie',
          credencial: 'no-es-un-sobre',
        },
      });
      for (const activo of activos) {
        await prisma.automatizacion.create({
          data: { tenantId: tenant.id, plantillaId, conexionId: conexion.id, cron: '0 9 * * *', activo },
        });
      }
      await cuerpo();
    } finally {
      await prisma.automatizacion.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.conexion.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  }

  test('CH-38 an active automation in another tenant refuses a headerless PUT with 409 and writes nothing', async () => {
    const creada = await crear({ nombre: `${marca} en uso` });
    const url = `/plantillas/${String(creada.id)}`;
    await conTenantConAutomaciones(String(creada.id), [true], async () => {
      const respuesta = await app.inject({
        method: 'PUT',
        url,
        payload: { ...VALIDA, nombre: `${marca} en uso cambiada`, sql: 'SELECT 1 AS cambiada', parametros: [] },
      });
      assert.equal(respuesta.statusCode, 409, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'plantilla-en-uso' });
      const { enUso: _enUso, ...columnas } = creada;
      assert.deepEqual(await prisma.plantilla.findUnique({ where: { id: String(creada.id) } }), columnas);
    });
  });

  test('CH-38 an invalid body on a template in use is 400, not 409', async () => {
    const creada = await crear({ nombre: `${marca} en uso invalida` });
    await conTenantConAutomaciones(String(creada.id), [true], async () => {
      const respuesta = await app.inject({
        method: 'PUT',
        url: `/plantillas/${String(creada.id)}`,
        payload: { ...VALIDA, sql: 'SELECT * FROM v_producto WHERE id = $1' },
      });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
    });
  });

  test('CH-38 only deactivated automations leave the template replaceable', async () => {
    const creada = await crear({ nombre: `${marca} desactivadas` });
    await conTenantConAutomaciones(String(creada.id), [false, false], async () => {
      const respuesta = await app.inject({
        method: 'PUT',
        url: `/plantillas/${String(creada.id)}`,
        payload: { ...VALIDA, nombre: `${marca} desactivadas v2` },
      });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const { plantilla } = respuesta.json() as { plantilla: Record<string, unknown> };
      assert.equal(plantilla.nombre, `${marca} desactivadas v2`);
      assert.equal(plantilla.enUso, false);
    });
  });

  test('CH-38 GET /:id reports enUso as a boolean, with no count, tenant or automation id', async () => {
    const creada = await crear({ nombre: `${marca} lectura uso` });
    const url = `/plantillas/${String(creada.id)}`;
    const libre = (await app.inject({ method: 'GET', url })).json() as { plantilla: Record<string, unknown> };
    assert.equal(libre.plantilla.enUso, false);
    await conTenantConAutomaciones(String(creada.id), [true, true, false], async () => {
      const respuesta = await app.inject({ method: 'GET', url });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      const { plantilla } = respuesta.json() as { plantilla: Record<string, unknown> };
      assert.equal(plantilla.enUso, true);
      assert.deepEqual(Object.keys(plantilla).sort(), [...Object.keys(creada)].sort());
      assert.ok(!respuesta.body.includes('tenantId'), 'no tenant id may reach the body');
    });
    // With the automations gone the template is free again.
    assert.equal(
      ((await app.inject({ method: 'GET', url })).json() as { plantilla: { enUso: boolean } }).plantilla.enUso,
      false,
    );
  });
});
