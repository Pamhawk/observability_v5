import type { TableColumn } from '../../utils';

interface TableChartProps {
  columns: TableColumn[];
  rows: Record<string, string | number>[];
  height?: number;
}

export function TableChart({ columns, rows, height = 280 }: TableChartProps) {
  return (
    <div style={{ padding: 12, fontSize: 12, overflow: 'auto', height }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            {columns.map(col => (
              <th
                key={col.key}
                style={{
                  textAlign: col.align,
                  padding: '6px 8px',
                  color: 'var(--color-text-secondary)',
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
              {columns.map(col => (
                <td
                  key={col.key}
                  style={{
                    padding: '6px 8px',
                    textAlign: col.align,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row[col.key] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
