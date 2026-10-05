import React from 'react';
const LABELS = { conectado: 'Conectado', desconectado: 'Desconectado', sin_datos: 'Sin latidos' };
export function ConnectivityIndicator({ estado = 'sin_datos', ultimoLatido, label, onDark = false }) {
  const s = onDark ? { color: 'inherit' } : undefined;
  return (
    <span className={'zd-conn zd-conn--' + estado.replace('_', '-')} role="status" data-change="CH-19d1" data-estado="pendiente">
      <span className="zd-conn__dot" aria-hidden="true" style={onDark ? { boxShadow: '0 0 0 2px rgba(255,255,255,.5)' } : undefined} />
      <span className="zd-conn__label" style={s}>{label || LABELS[estado]}</span>
      {ultimoLatido ? <span className="zd-conn__beat" style={onDark ? { color: 'inherit', opacity: .85 } : undefined}>· último latido {ultimoLatido}</span> : null}
    </span>
  );
}
