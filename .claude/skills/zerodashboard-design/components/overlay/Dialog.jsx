import React from 'react';
let _d = 0;
export function Dialog({ open = true, title, children, actions, onClose }) {
  const id = React.useMemo(() => 'zd-dlg-' + (++_d), []);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const f = ref.current && ref.current.querySelector('[autofocus], .zd-btn--primary, .zd-btn--danger, input');
    f && f.focus();
    const k = e => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  if (!open) return null;
  return (
    <div className="zd-dialog-backdrop" onClick={e => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="zd-dialog" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <h2 className="zd-dialog__title" id={id}>{title}</h2>
        {typeof children === 'string' ? <p className="zd-dialog__body">{children}</p> : children}
        {actions ? <div className="zd-dialog__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
