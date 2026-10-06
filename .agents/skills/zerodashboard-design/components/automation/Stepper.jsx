import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function Stepper({ steps, current = 0, label = 'Progreso' }) {
  return (
    <ol className="zd-steps" aria-label={label}>
      {steps.map((s, i) => (
        <li key={i} className={'zd-step' + (i < current ? ' is-done' : '')} aria-current={i === current ? 'step' : undefined}>
          <span className="zd-step__n">{i < current ? <Icon name="check" size={13} label="Completado" /> : i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}
