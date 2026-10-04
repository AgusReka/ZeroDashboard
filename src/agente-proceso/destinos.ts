import { isIPv4, isIPv6 } from 'node:net';
import { ErrorConfig } from './config.js';

/**
 * CH-19c2 (DEC-115, DEC-123 A4): the literal allowlist. `AGENT_ALLOWED_TARGETS` is a comma
 * list of exact `host:port` entries; there are no wildcards, CIDR or ranges (rule 6). A
 * session target matches only an entry equal to it after normalization, and the socket
 * then dials the entry's host, never the engine's string.
 */
export interface Destino {
  readonly host: string;
  readonly puerto: number;
}
/** Keyed by `${host} ${puerto}`, with the host normalized. */
export type ListaDestinos = ReadonlyMap<string, Destino>;

const clave = (host: string, puerto: number): string => `${host} ${puerto}`;
const IPV6_CON_PUERTO = /^\[([^\]]+)\]:([^:]+)$/;
const HOST_CON_PUERTO = /^([^:]+):([^:]+)$/;
const PUERTO = /^[1-9]\d{0,4}$/;
const ETIQUETA_DNS = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Lowercase, without brackets, without one trailing dot. */
export function normalizarHost(h: string): string {
  const minusculas = h.toLowerCase();
  const sinCorchetes = minusculas.startsWith('[') && minusculas.endsWith(']') ? minusculas.slice(1, -1) : minusculas;
  return sinCorchetes.endsWith('.') ? sinCorchetes.slice(0, -1) : sinCorchetes;
}

/**
 * A DNS name, or a dotted-quad IPv4 when every label is digits (so `127.1` and `010.0.0.1`
 * are refused). The last label must hold a letter, so IP-like ranges such as `10.0.0.1-9`
 * cannot pass as names.
 */
function hostValido(host: string): boolean {
  if (/^[\d.]+$/.test(host)) return isIPv4(host);
  const etiquetas = host.split('.');
  return host.length <= 253 && etiquetas.every((e) => ETIQUETA_DNS.test(e)) && /[a-z]/.test(etiquetas[etiquetas.length - 1]);
}

function leerEntrada(entrada: string): Destino | null {
  const v6 = IPV6_CON_PUERTO.exec(entrada);
  const partes = v6 ?? HOST_CON_PUERTO.exec(entrada);
  if (!partes || !PUERTO.test(partes[2]) || Number(partes[2]) > 65_535) return null;
  const host = v6 ? partes[1].toLowerCase() : normalizarHost(partes[1]);
  const valido = v6 ? isIPv6(host) : hostValido(host);
  return valido ? { host, puerto: Number(partes[2]) } : null;
}

/** Throws `ErrorConfig('AGENT_ALLOWED_TARGETS')`, naming the 1-based entry index only. */
export function leerDestinos(texto: string): ListaDestinos {
  if (texto === '') throw new ErrorConfig('AGENT_ALLOWED_TARGETS', { ausente: true });
  const lista = new Map<string, Destino>();
  texto.split(',').forEach((bruta, i) => {
    const destino = leerEntrada(bruta.trim());
    if (!destino) throw new ErrorConfig('AGENT_ALLOWED_TARGETS', { entrada: i + 1 });
    lista.set(clave(destino.host, destino.puerto), destino);
  });
  return lista;
}

/** The listed entry for a session target, or null. Untyped input never matches. */
export function buscarDestino(l: ListaDestinos, host: unknown, puerto: unknown): Destino | null {
  if (typeof host !== 'string' || typeof puerto !== 'number' || !Number.isInteger(puerto)) return null;
  return l.get(clave(normalizarHost(host), puerto)) ?? null;
}
