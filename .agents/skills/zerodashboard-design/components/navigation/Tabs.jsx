import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function Tabs({ tabs, value, onChange, label = 'Secciones' }) {
  const refs = React.useRef([]);
  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    refs.current[n] && refs.current[n].focus();
    onChange && onChange(tabs[n].id);
  };
  return (
    <div className="zd-tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button key={t.id} ref={el => (refs.current[i] = el)} type="button" role="tab" className="zd-tab" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange && onChange(t.id)} onKeyDown={e => onKey(e, i)}>
          {t.icon ? <Icon name={t.icon} /> : null}{t.label}
          {t.count != null ? <span className="zd-tab__count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
