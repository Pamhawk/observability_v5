import { ChevronDown, ChevronUp } from 'lucide-react';
import type { SqlResultTable } from '../../types';
import styles from './SqlResultTableView.module.css';

interface SqlResultTableViewProps {
  result: SqlResultTable;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  maxHeight?: number;
}

export function SqlResultTableView({ result, isCollapsed, onToggleCollapse, maxHeight = 240 }: SqlResultTableViewProps) {
  return (
    <div className={styles.container}>
      <button className={styles.header} onClick={onToggleCollapse}>
        <span className={styles.stats}>
          <span className={styles.rowCount}>{result.rows.length} rows</span>
          <span className={styles.execTime}>{result.executionTimeMs.toFixed(1)} ms</span>
        </span>
        {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {!isCollapsed && (
        <div className={styles.tableWrapper} style={{ maxHeight }}>
          <table className={styles.table}>
            <thead>
              <tr>
                {result.columns.map(col => (
                  <th key={col.key} className={col.align === 'right' ? styles.right : ''}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i}>
                  {result.columns.map(col => (
                    <td key={col.key} className={col.align === 'right' ? styles.right : ''}>
                      {row[col.key] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
