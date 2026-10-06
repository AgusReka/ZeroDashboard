import React from 'react';
export function LoadingState({ label = 'Cargando…', variant = 'spinner', rows = 4 }) {
  if (variant === 'skeleton') {
    return (
      <div role="status" aria-live="polite" style={{ display: 'grid', gap: 'var(--space-5)', padding: 'var(--space-6)' }}>
        <span className="zd-sr">{label}</span>
        {Array.from({ length: rows }).map((_, i) => <span key={i} className="zd-skeleton" style={{ width: (92 - (i % 3) * 18) + '%' }} />)}
      </div>
    );
  }
  return (
    <div className="zd-state" role="status" aria-live="polite">
      <span className="zd-spinner" aria-hidden="true" />
      <p className="zd-state__body">{label}</p>
    </div>
  );
}
