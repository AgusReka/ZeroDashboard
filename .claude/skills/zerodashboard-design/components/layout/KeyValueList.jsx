import React from 'react';
export function KeyValueList({ items, layout = 'rows' }) {
  if (layout === 'grid') {
    return <dl className="zd-kvgrid">{items.map((it, i) => <div key={i}><dt>{it.label}</dt><dd className={it.mono ? 'zd-mono' : undefined}>{it.value ?? '—'}</dd></div>)}</dl>;
  }
  return (
    <dl className={'zd-kv' + (layout === 'stack' ? ' zd-kv--stack' : '')}>
      {items.map((it, i) => <React.Fragment key={i}><dt>{it.label}</dt><dd className={it.mono ? 'is-mono' : undefined}>{it.value ?? '—'}</dd></React.Fragment>)}
    </dl>
  );
}
