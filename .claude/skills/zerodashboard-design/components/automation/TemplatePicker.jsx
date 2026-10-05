import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function TemplatePicker({ options, value, onChange, name = 'plantilla', legend = 'Plantilla' }) {
  return (
    <fieldset className="zd-templates" data-change="CH-21" data-estado="pendiente">
      <legend className="zd-sr">{legend}</legend>
      {options.map(o => (
        <label key={o.id} className="zd-template">
          <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange && onChange(o.id)} />
          <span className="zd-template__icon"><Icon name={o.icon || 'file-text'} /></span>
          <span className="zd-template__name">{o.nombre}</span>
          <span className="zd-template__desc">{o.descripcion}</span>
          {o.meta ? <span className="zd-meta">{o.meta}</span> : null}
          <span className="zd-template__check"><Icon name="circle-check" label="Seleccionada" /></span>
        </label>
      ))}
    </fieldset>
  );
}
