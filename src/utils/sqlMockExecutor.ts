import type { ParsedSQL, SqlResultTable, SqlResultColumn, SqlColumnType } from '../types';
import { DIMENSION_POOLS, METRIC_RANGES, COUNTRY_CODES, seededRandom } from './queryDataGenerator';

// Map SQL column names (underscores) to internal dimension pool keys (dots)
function sqlColToPoolKey(col: string): string {
  return col.replace(/_/g, '.');
}

// Time-related column names
const TIME_COLUMNS = new Set(['time', 'timestamp', 'ts', 'date', 'datetime', 'created_at', 'updated_at']);

// Geo-related dimension keys
const GEO_DIMENSIONS = new Set(['Src.Country', 'Dst.Country', 'Src.City', 'Dst.City']);

function classifyColumn(col: string, aggregation?: string): SqlColumnType {
  const poolKey = sqlColToPoolKey(col);

  if (TIME_COLUMNS.has(col.toLowerCase())) return 'timestamp';
  if (GEO_DIMENSIONS.has(poolKey)) return 'geo';
  if (aggregation) return 'number';
  if (col === '*') return 'number';
  if (METRIC_RANGES[poolKey]) return 'number';
  if (DIMENSION_POOLS[poolKey]) return 'string';

  // Heuristic: if it looks like a metric name, it's numeric
  const numericHints = ['count', 'sum', 'avg', 'total', 'max', 'min', 'traffic', 'bytes', 'packets', 'latency', 'cpu', 'memory'];
  if (numericHints.some(h => col.toLowerCase().includes(h))) return 'number';

  return 'string';
}

// Map time preset strings to duration in hours
const PRESET_HOURS: Record<string, number> = {
  '5m': 5 / 60, '15m': 0.25, '30m': 0.5,
  '1h': 1, '3h': 3, '6h': 6, '12h': 12,
  '1d': 24, '24h': 24, '3d': 72, '7d': 168, '30d': 720,
};

function generateTimestamps(count: number, rand: () => number, timePreset?: string): string[] {
  const now = Date.now();
  const durationHours = PRESET_HOURS[timePreset || '1d'] || 24;
  const durationMs = durationHours * 3600 * 1000;
  const step = Math.max(1, Math.floor(durationMs / count));
  const start = now - durationMs;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start + i * step + Math.floor(rand() * step * 0.1));
    return d.toISOString().replace('T', ' ').slice(0, 19);
  });
}

export function executeMockSQL(parsed: ParsedSQL, timePreset?: string): SqlResultTable {
  const seedStr = JSON.stringify(parsed) + (timePreset || '1d');
  const rand = seededRandom(seedStr);

  // Determine row count
  const rowCount = Math.min(parsed.limit || 20, 100);

  // Build columns
  const columns: SqlResultColumn[] = parsed.select.map(col => {
    const key = col.alias || col.expression;
    const colType = classifyColumn(col.sourceColumn || col.expression, col.aggregation);
    return {
      key,
      label: col.alias || col.expression,
      type: colType,
      align: (colType === 'number' ? 'right' : 'left') as 'left' | 'right',
    };
  });

  // Collect WHERE constraints for dimension filtering
  const whereConstraints: Record<string, string[]> = {};
  for (const cond of parsed.where) {
    const poolKey = sqlColToPoolKey(cond.column);
    if (cond.operator === '=' && typeof cond.value === 'string') {
      whereConstraints[poolKey] = [cond.value];
    } else if (cond.operator === 'IN' && Array.isArray(cond.value)) {
      whereConstraints[poolKey] = cond.value;
    }
  }

  // Generate dimension value pools for GROUP BY columns
  const groupByPools: Record<string, string[]> = {};
  for (const gb of parsed.groupBy) {
    const poolKey = sqlColToPoolKey(gb);
    if (TIME_COLUMNS.has(gb.toLowerCase())) continue; // handled separately

    // Check WHERE constraints first
    if (whereConstraints[poolKey]) {
      groupByPools[gb] = whereConstraints[poolKey].map(v => COUNTRY_CODES[v] || v);
    } else if (DIMENSION_POOLS[poolKey]) {
      const pool = [...DIMENSION_POOLS[poolKey]].sort(() => rand() - 0.5);
      groupByPools[gb] = pool.slice(0, Math.min(pool.length, rowCount));
    } else {
      groupByPools[gb] = Array.from({ length: Math.min(6, rowCount) }, (_, i) => `${gb}-${i + 1}`);
    }
  }

  // Check if we have a time column in SELECT
  const timeCol = parsed.select.find(c => TIME_COLUMNS.has((c.sourceColumn || c.expression).toLowerCase()));
  const timestamps = timeCol ? generateTimestamps(rowCount, rand, timePreset) : null;

  // Generate rows
  const rows: Record<string, string | number>[] = [];

  // If GROUP BY with categoricals: generate one row per combination
  const categoricalGroupBys = parsed.groupBy.filter(gb => !TIME_COLUMNS.has(gb.toLowerCase()));

  if (categoricalGroupBys.length > 0 && timestamps) {
    // Time + categorical: generate a cross product (limited)
    const catPool = groupByPools[categoricalGroupBys[0]] || ['default'];
    const timeSliceCount = Math.min(Math.ceil(rowCount / catPool.length), timestamps.length);
    const slicedTimestamps = timestamps.slice(0, timeSliceCount);

    for (const ts of slicedTimestamps) {
      for (const catValue of catPool) {
        if (rows.length >= rowCount) break;
        const row: Record<string, string | number> = {};
        for (const col of parsed.select) {
          const key = col.alias || col.expression;
          const srcCol = col.sourceColumn || col.expression;

          if (TIME_COLUMNS.has(srcCol.toLowerCase())) {
            row[key] = ts;
          } else if (srcCol === categoricalGroupBys[0] || sqlColToPoolKey(srcCol) === sqlColToPoolKey(categoricalGroupBys[0])) {
            row[key] = catValue;
          } else if (col.aggregation || METRIC_RANGES[sqlColToPoolKey(srcCol)]) {
            const poolKey = sqlColToPoolKey(srcCol === '*' ? 'Traffic' : srcCol);
            const range = METRIC_RANGES[poolKey] || METRIC_RANGES.Traffic;
            const val = range.min + rand() * (range.max - range.min);
            row[key] = parseFloat(val.toFixed(2));
          } else {
            const dimPool = groupByPools[srcCol] || DIMENSION_POOLS[sqlColToPoolKey(srcCol)];
            row[key] = dimPool ? dimPool[Math.floor(rand() * dimPool.length)] : `${srcCol}-${rows.length}`;
          }
        }
        rows.push(row);
      }
    }
  } else if (categoricalGroupBys.length > 0) {
    // Categorical only: one row per combination
    const primaryPool = groupByPools[categoricalGroupBys[0]] || ['default'];
    const secondaryPool = categoricalGroupBys.length > 1 ? (groupByPools[categoricalGroupBys[1]] || ['default']) : null;

    if (secondaryPool) {
      for (const p of primaryPool) {
        for (const s of secondaryPool) {
          if (rows.length >= rowCount) break;
          const row: Record<string, string | number> = {};
          for (const col of parsed.select) {
            const key = col.alias || col.expression;
            const srcCol = col.sourceColumn || col.expression;
            const poolKey = sqlColToPoolKey(srcCol);

            if (poolKey === sqlColToPoolKey(categoricalGroupBys[0])) {
              row[key] = p;
            } else if (poolKey === sqlColToPoolKey(categoricalGroupBys[1])) {
              row[key] = s;
            } else if (col.aggregation || METRIC_RANGES[poolKey]) {
              const range = METRIC_RANGES[srcCol === '*' ? 'Traffic' : poolKey] || METRIC_RANGES.Traffic;
              const val = range.min + rand() * (range.max - range.min);
              row[key] = parseFloat(val.toFixed(2));
            } else {
              row[key] = `${srcCol}-${rows.length}`;
            }
          }
          rows.push(row);
        }
      }
    } else {
      for (const p of primaryPool) {
        if (rows.length >= rowCount) break;
        const row: Record<string, string | number> = {};
        for (const col of parsed.select) {
          const key = col.alias || col.expression;
          const srcCol = col.sourceColumn || col.expression;
          const poolKey = sqlColToPoolKey(srcCol);

          if (poolKey === sqlColToPoolKey(categoricalGroupBys[0])) {
            row[key] = p;
          } else if (col.aggregation || METRIC_RANGES[poolKey]) {
            const range = METRIC_RANGES[srcCol === '*' ? 'Traffic' : poolKey] || METRIC_RANGES.Traffic;
            const val = range.min + rand() * (range.max - range.min);
            row[key] = parseFloat(val.toFixed(2));
          } else {
            const dimPool = DIMENSION_POOLS[poolKey];
            row[key] = dimPool ? dimPool[Math.floor(rand() * dimPool.length)] : `${srcCol}-${rows.length}`;
          }
        }
        rows.push(row);
      }
    }
  } else if (timestamps) {
    // Time only (no categorical GROUP BY)
    for (let i = 0; i < rowCount; i++) {
      const row: Record<string, string | number> = {};
      for (const col of parsed.select) {
        const key = col.alias || col.expression;
        const srcCol = col.sourceColumn || col.expression;

        if (TIME_COLUMNS.has(srcCol.toLowerCase())) {
          row[key] = timestamps[i];
        } else if (col.aggregation || METRIC_RANGES[sqlColToPoolKey(srcCol)]) {
          const poolKey = sqlColToPoolKey(srcCol === '*' ? 'Traffic' : srcCol);
          const range = METRIC_RANGES[poolKey] || METRIC_RANGES.Traffic;
          const val = range.min + rand() * (range.max - range.min);
          row[key] = parseFloat(val.toFixed(2));
        } else {
          const dimPool = DIMENSION_POOLS[sqlColToPoolKey(srcCol)];
          row[key] = dimPool ? dimPool[Math.floor(rand() * dimPool.length)] : `${srcCol}-${i}`;
        }
      }
      rows.push(row);
    }
  } else {
    // No GROUP BY, no time — flat rows (e.g., single aggregate or generic query)
    const isSingleAggregate = parsed.select.every(c => c.aggregation) && parsed.groupBy.length === 0;
    const count = isSingleAggregate ? 1 : rowCount;

    for (let i = 0; i < count; i++) {
      const row: Record<string, string | number> = {};
      for (const col of parsed.select) {
        const key = col.alias || col.expression;
        const srcCol = col.sourceColumn || col.expression;
        const poolKey = sqlColToPoolKey(srcCol);

        if (col.aggregation || METRIC_RANGES[poolKey]) {
          const range = METRIC_RANGES[srcCol === '*' ? 'Traffic' : poolKey] || METRIC_RANGES.Traffic;
          const val = range.min + rand() * (range.max - range.min);
          row[key] = parseFloat(val.toFixed(2));
        } else {
          const dimPool = DIMENSION_POOLS[poolKey];
          if (dimPool) {
            row[key] = dimPool[i % dimPool.length];
          } else {
            row[key] = `${srcCol}-${i + 1}`;
          }
        }
      }
      rows.push(row);
    }
  }

  // Apply ORDER BY
  if (parsed.orderBy.length > 0) {
    const { column, direction } = parsed.orderBy[0];
    // Find matching key
    const matchCol = columns.find(c => c.key === column || c.label === column);
    const sortKey = matchCol?.key || column;
    rows.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'DESC' ? bVal - aVal : aVal - bVal;
      }
      return direction === 'DESC'
        ? String(bVal).localeCompare(String(aVal))
        : String(aVal).localeCompare(String(bVal));
    });
  }

  // Apply LIMIT
  const limitedRows = parsed.limit ? rows.slice(0, parsed.limit) : rows;

  const executionTimeMs = Math.round((5 + rand() * 245) * 10) / 10;

  return {
    columns,
    rows: limitedRows,
    executionTimeMs,
  };
}
