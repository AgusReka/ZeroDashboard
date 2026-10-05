import React from 'react';
import { Icon } from '../core/Icon.jsx';
let _n = 0;
export function Field({ label, id, as = 'input', help, error, optional = false, suffix, mono = false, children, className = '', ...rest }) {
  const autoId = React.useMemo(() => id || 'zd-f-' + (++_n), [id]);
  const helpId = help ? autoId + '-help' : null;
  const errId = error ? autoId + '-err' : null;
  const describedBy = [helpId, errId].filter(Boolean).join(' ') || undefined;
  const base = as === 'select' ? 'zd-select' : as === 'textarea' ? 'zd-textarea' : 'zd-input';
  const cls = base + (mono ? ' ' + base + '--code' : '');
  const common = { id: autoId, className: cls, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy, ...rest };
  let control = as === 'select' ? <select {...common}>{children}</select> : as === 'textarea' ? <textarea spellCheck={mono ? false : undefined} {...common} /> : <input {...common} />;
  if (suffix && as === 'input') control = <div className="zd-input-group">{control}<span className="zd-input-suffix">{suffix}</span></div>;
  return (
    <div className={'zd-field' + (className ? ' ' + className : '')}>
      <label className="zd-label" htmlFor={autoId}>{label}{optional ? <span className="zd-optional"> (opcional)</span> : null}</label>
      {control}
      {help ? <span className="zd-help" id={helpId}>{help}</span> : null}
      {error ? <span className="zd-field-error" id={errId}><Icon name="circle-alert" />{error}</span> : null}
    </div>
  );
}
