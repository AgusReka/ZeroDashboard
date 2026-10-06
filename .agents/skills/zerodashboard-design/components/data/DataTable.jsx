import React from 'react';
import { Button } from '../core/Button.jsx';
function cellClass(col) { return col.align === 'num' ? 'is-num' : col.align === 'mono' ? 'is-mono' : undefined; }
export function DataTable({ columns, rows, caption, page = 1, pageSize = 25, total, onPageChange, compact = false, nullLabel = 'NULL', emptyMessage = 'Sin filas.', rowKey, onRowClick, selectedKey, footerNote, maxHeight }) {
  const count = total ?? rows.length;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  return (
    <div className="zd-table-wrap">
      <div className="zd-table-scroll" style={maxHeight ? { maxHeight } : undefined}>
        <table className={'zd-table' + (compact ? ' zd-table--compact' : '')}>
          {caption ? <caption className="zd-sr">{caption}</caption> : null}
          <thead><tr>{columns.map(c => <th key={c.key} scope="col" className={cellClass(c)} style={c.width ? { width: c.width } : undefined}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={columns.length} className="zd-muted" style={{ textAlign: 'center', padding: '24px' }}>{emptyMessage}</td></tr> :
              rows.map((r, i) => {
                const k = rowKey ? r[rowKey] : i;
                return (
                  <tr key={k} aria-selected={selectedKey !== undefined && selectedKey === k ? 'true' : undefined} onClick={onRowClick ? () => onRowClick(r, i) : undefined} style={onRowClick ? { cursor: 'pointer' } : undefined}>
                    {columns.map(c => {
                      const v = r[c.key];
                      const isNull = v === null || v === undefined;
                      return <td key={c.key} className={[cellClass(c), isNull && !c.render ? 'is-null' : ''].filter(Boolean).join(' ') || undefined}>{c.render ? c.render(v, r) : isNull ? nullLabel : String(v)}</td>;
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {onPageChange || footerNote ? (
        <div className="zd-pager">
          <span className="zd-num">{from}–{to} de {count.toLocaleString('es-AR')}</span>
          {footerNote ? <span>{footerNote}</span> : null}
          <span className="zd-pager__spacer" />
          {onPageChange ? <>
            <Button size="sm" variant="secondary" icon="chevron-left" iconOnly label="Página anterior" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
            <span className="zd-num">Página {page} de {pages}</span>
            <Button size="sm" variant="secondary" icon="chevron-right" iconOnly label="Página siguiente" disabled={page >= pages} onClick={() => onPageChange(page + 1)} />
          </> : null}
        </div>
      ) : null}
    </div>
  );
}
