/**
 * One cookie value out of a `Cookie` request header, by name. Hand-rolled on purpose:
 * each surface needs exactly one cookie (the panel's since CH-22a, the console's since
 * CH-29), and the project adds no dependency for a single fixed pair. A repeated cookie
 * name yields the first one, which is all a session check needs — the token is
 * validated against the database, not trusted by shape.
 */
export function leerCookie(cabecera: string | undefined, nombre: string): string | null {
  if (cabecera === undefined) {
    return null;
  }
  for (const parte of cabecera.split(';')) {
    const recortada = parte.trim();
    const igual = recortada.indexOf('=');
    if (igual === -1) {
      continue;
    }
    if (recortada.slice(0, igual) === nombre) {
      return recortada.slice(igual + 1);
    }
  }
  return null;
}
