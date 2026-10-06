import React from 'react';
import { Icon } from '../core/Icon.jsx';
export const ESTADOS = {
  exitosa: ['ok', 'circle-check', 'Exitosa'],
  fallida: ['error', 'circle-x', 'Fallida'],
  en_curso: ['info', 'loader-circle', 'En curso'],
  reintentando: ['info', 'refresh-cw', 'Reintentando'],
  omitida: ['neutral', 'skip-forward', 'Omitida por solapamiento'],
  interrumpida: ['warn', 'ban', 'Interrumpida'],
  duplicado_evitado: ['neutral', 'copy-check', 'Duplicado evitado'],
  sin_datos: ['neutral', 'inbox', 'Sin datos'],
  activa: ['ok', 'circle-check', 'Activa'],
  pausada: ['neutral', 'pause', 'Pausada'],
  con_falla: ['error', 'circle-alert', 'Con falla'],
  disponible: ['neutral', 'plus', 'Disponible'],
  en_riesgo: ['warn', 'triangle-alert', 'En riesgo'],
  desactualizada: ['warn', 'clock', 'Datos desactualizados'],
  borrador: ['neutral', 'pencil', 'Borrador']
};
export function StatusBadge({ estado, tone, icon, label, square = false, attempt }) {
  const def = ESTADOS[estado] || ['neutral', 'circle', estado || ''];
  const t = tone || def[0];
  const ic = icon || def[1];
  let text = label || def[2];
  if (estado === 'reintentando' && attempt) text = text + ' (' + attempt + ')';
  return (
    <span className={'zd-badge' + (t !== 'neutral' ? ' zd-badge--' + t : '') + (square ? ' zd-badge--square' : '')} data-estado={estado}>
      <Icon name={ic} spin={estado === 'en_curso'} />{text}
    </span>
  );
}
