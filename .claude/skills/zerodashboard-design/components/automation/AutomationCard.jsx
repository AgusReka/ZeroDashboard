import React from 'react';
import { StatusBadge } from '../data/StatusBadge.jsx';
export function AutomationCard({ titulo, descripcion, estado = 'activa', estadoLabel, ultima, proxima, frecuencia, children, alert, disponible = false }) {
  return (
    <article className={'zd-card zd-auto-card' + (disponible ? ' zd-auto-card--disponible' : '')}>
      <div className="zd-card__head">
        <div>
          <h3 className="zd-auto-card__title">{titulo}</h3>
          {descripcion ? <p className="zd-auto-card__desc">{descripcion}</p> : null}
        </div>
        <StatusBadge estado={disponible ? 'disponible' : estado} label={estadoLabel} />
      </div>
      {alert}
      {!disponible && (ultima || proxima || frecuencia) ? (
        <dl className="zd-auto-card__times">
          {ultima ? <div><dt>Última ejecución</dt><dd>{ultima}</dd></div> : null}
          {proxima ? <div><dt>Próxima ejecución</dt><dd>{proxima}</dd></div> : null}
          {frecuencia ? <div><dt>Frecuencia</dt><dd>{frecuencia}</dd></div> : null}
        </dl>
      ) : null}
      {children ? <div className="zd-auto-card__actions">{children}</div> : null}
    </article>
  );
}
