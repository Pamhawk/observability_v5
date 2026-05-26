import type { SqlResultTable, ChartConfig } from '../types';
import type { ChartDataResult, SankeyNodeData, SankeyLinkData } from './queryDataGenerator';
import { COUNTRY_CODES } from './queryDataGenerator';

export function adaptTableToChart(table: SqlResultTable, config: ChartConfig): ChartDataResult {
  switch (config.chartType) {
    case 'timeSeries':
    case 'stackedArea':
      return adaptTimeSeries(table, config);
    case 'bar':
    case 'topNBar':
      return adaptBar(table, config);
    case 'pie':
      return adaptPie(table, config);
    case 'donut':
      return adaptDonut(table, config);
    case 'gauge':
      return adaptGauge(table, config);
    case 'singleValue':
      return adaptSingleValue(table, config);
    case 'heatmap':
      return adaptHeatmap(table, config);
    case 'sankey':
      return adaptSankey(table, config);
    case 'geoMap':
      return adaptGeoMap(table, config);
    case 'table':
      return adaptTable(table, config);
    case 'stackedBar':
    case 'groupedBar':
      return adaptMultiBar(table, config);
  }
}

function adaptTimeSeries(
  table: SqlResultTable,
  config: { chartType: 'timeSeries' | 'stackedArea'; timeColumn: string; valueColumns: string[]; groupByColumn?: string }
): ChartDataResult {
  const { timeColumn, valueColumns, groupByColumn } = config;

  if (groupByColumn) {
    // Pivot: group rows by the groupByColumn value, each becomes a series
    const groups = new Map<string, Map<string, number>>();
    const allTimestamps = new Set<string>();

    for (const row of table.rows) {
      const ts = String(row[timeColumn]);
      const group = String(row[groupByColumn]);
      allTimestamps.add(ts);

      if (!groups.has(group)) groups.set(group, new Map());
      const val = typeof row[valueColumns[0]] === 'number' ? row[valueColumns[0]] : 0;
      groups.get(group)!.set(ts, val as number);
    }

    const timestamps = [...allTimestamps].sort();
    const dynamicSeries = [...groups.entries()].map(([name, tsMap]) => ({
      name,
      data: timestamps.map(ts => tsMap.get(ts) || 0),
    }));

    return {
      type: 'timeSeries',
      dynamicSeries,
      timestamps,
      unit: '',
      stacked: config.chartType === 'stackedArea',
    };
  }

  // No grouping: each valueColumn is a series
  const timestamps = table.rows.map(r => String(r[timeColumn]));
  const dynamicSeries = valueColumns.map(vc => ({
    name: vc,
    data: table.rows.map(r => (typeof r[vc] === 'number' ? r[vc] : 0) as number),
  }));

  return {
    type: 'timeSeries',
    dynamicSeries,
    timestamps,
    unit: '',
    stacked: config.chartType === 'stackedArea',
  };
}

function adaptBar(
  table: SqlResultTable,
  config: { chartType: 'bar' | 'topNBar'; categoryColumn: string; valueColumn: string; sortOrder: string; orientation: string; limit?: number }
): ChartDataResult {
  let data = table.rows.map(r => ({
    name: String(r[config.categoryColumn]),
    value: typeof r[config.valueColumn] === 'number' ? r[config.valueColumn] as number : 0,
  }));

  if (config.sortOrder === 'desc') data.sort((a, b) => b.value - a.value);
  else if (config.sortOrder === 'asc') data.sort((a, b) => a.value - b.value);

  if (config.limit) data = data.slice(0, config.limit);

  const total = data.reduce((s, d) => s + d.value, 0);
  const withPercent = data.map(d => ({ ...d, percent: total > 0 ? parseFloat(((d.value / total) * 100).toFixed(1)) : 0 }));

  return {
    type: 'bar',
    data: withPercent,
    unit: '',
    horizontal: config.chartType === 'topNBar' || config.orientation === 'horizontal',
  };
}

function adaptPie(
  table: SqlResultTable,
  config: { chartType: 'pie' | 'donut'; categoryColumn: string; valueColumn: string; limit?: number }
): ChartDataResult {
  let data = table.rows.map(r => ({
    name: String(r[config.categoryColumn]),
    value: typeof r[config.valueColumn] === 'number' ? r[config.valueColumn] as number : 0,
  }));

  if (config.limit) data = data.slice(0, config.limit);
  const total = data.reduce((s, d) => s + d.value, 0);
  const normalized = data.map(d => ({ name: d.name, value: total > 0 ? parseFloat(((d.value / total) * 100).toFixed(1)) : 0 }));

  return { type: 'pie', data: normalized };
}

function adaptDonut(
  table: SqlResultTable,
  config: { chartType: 'pie' | 'donut'; categoryColumn: string; valueColumn: string; limit?: number }
): ChartDataResult {
  let data = table.rows.map(r => ({
    name: String(r[config.categoryColumn]),
    value: typeof r[config.valueColumn] === 'number' ? r[config.valueColumn] as number : 0,
  }));

  if (config.limit) data = data.slice(0, config.limit);
  const total = data.reduce((s, d) => s + d.value, 0);
  const normalized = data.map(d => ({ name: d.name, value: total > 0 ? parseFloat(((d.value / total) * 100).toFixed(1)) : 0 }));

  return { type: 'donut', data: normalized, total: parseFloat(total.toFixed(1)) };
}

function adaptGauge(
  _table: SqlResultTable,
  config: { chartType: 'gauge'; valueColumn: string; min: number; max: number; thresholds: [number, number]; label: string }
): ChartDataResult {
  const row = _table.rows[0];
  const value = row ? (typeof row[config.valueColumn] === 'number' ? row[config.valueColumn] as number : 0) : 0;

  return {
    type: 'gauge',
    value: Math.round(value),
    min: config.min,
    max: config.max,
    thresholds: config.thresholds,
    label: config.label,
  };
}

function adaptSingleValue(
  table: SqlResultTable,
  config: { chartType: 'singleValue'; valueColumn: string; label: string; unit?: string; comparison?: boolean }
): ChartDataResult {
  const row = table.rows[0];
  const value = row ? (typeof row[config.valueColumn] === 'number' ? row[config.valueColumn] as number : 0) : 0;
  const rounded = Math.round(value);

  // Generate a mock comparison delta when the config requests it
  const comparePrevious = config.comparison
    ? { percent: parseFloat(((Math.random() * 30 - 15)).toFixed(1)), period: '1d' }
    : undefined;

  return {
    type: 'singleValue',
    value: rounded,
    label: config.label,
    unit: config.unit || '',
    comparePrevious,
  };
}

function adaptHeatmap(
  table: SqlResultTable,
  config: { chartType: 'heatmap'; xColumn: string; yColumn: string; valueColumn: string }
): ChartDataResult {
  const xSet = new Set<string>();
  const ySet = new Set<string>();
  const valueMap = new Map<string, number>();

  for (const row of table.rows) {
    const x = String(row[config.xColumn]);
    const y = String(row[config.yColumn]);
    xSet.add(x);
    ySet.add(y);
    valueMap.set(`${x}|${y}`, typeof row[config.valueColumn] === 'number' ? row[config.valueColumn] as number : 0);
  }

  const xLabels = [...xSet];
  const yLabels = [...ySet];
  const data: number[][] = [];
  for (let xi = 0; xi < xLabels.length; xi++) {
    for (let yi = 0; yi < yLabels.length; yi++) {
      data.push([xi, yi, Math.round(valueMap.get(`${xLabels[xi]}|${yLabels[yi]}`) || 0)]);
    }
  }

  return { type: 'heatmap', xLabels, yLabels, data };
}

function adaptSankey(
  table: SqlResultTable,
  config: import('../types').SankeyConfig
): ChartDataResult {
  // Resolve the ordered list of node columns (new multi-node format or legacy 2-node)
  let nodeCols: string[];
  if (config.nodes && config.nodes.length >= 2) {
    nodeCols = config.nodes.map(n => n.dimension).filter(Boolean);
  } else if (config.sourceColumn && config.targetColumn) {
    nodeCols = [config.sourceColumn, config.targetColumn];
  } else {
    return { type: 'sankey', nodes: [], links: [] };
  }

  const nodeSet = new Set<string>();
  const links: SankeyLinkData[] = [];

  // For each adjacent pair of node-level columns, aggregate into links
  for (let i = 0; i < nodeCols.length - 1; i++) {
    const srcCol = nodeCols[i];
    const tgtCol = nodeCols[i + 1];

    const aggregated = new Map<string, number>();
    for (const row of table.rows) {
      const src = String(row[srcCol] ?? '');
      const tgt = String(row[tgtCol] ?? '');
      if (!src || !tgt || src === 'undefined' || tgt === 'undefined') continue;
      const key = `${src}\0${tgt}`;
      const val = typeof row[config.valueColumn] === 'number' ? (row[config.valueColumn] as number) : 1;
      aggregated.set(key, (aggregated.get(key) ?? 0) + val);
      nodeSet.add(src);
      nodeSet.add(tgt);
    }

    for (const [key, val] of aggregated) {
      const nulIdx = key.indexOf('\0');
      const src = key.slice(0, nulIdx);
      const tgt = key.slice(nulIdx + 1);
      links.push({ source: src, target: tgt, value: val, trafficGbps: val });
    }
  }

  const nodes: SankeyNodeData[] = [...nodeSet].map(name => {
    const asnMatch = name.match(/AS(\d+)/);
    return { name, asnNumber: asnMatch ? asnMatch[1] : undefined };
  });

  return { type: 'sankey', nodes, links };
}

function adaptGeoMap(
  table: SqlResultTable,
  config: { chartType: 'geoMap'; geoColumn: string; valueColumn: string }
): ChartDataResult {
  const data = table.rows.map(r => ({
    name: COUNTRY_CODES[String(r[config.geoColumn])] || String(r[config.geoColumn]),
    value: typeof r[config.valueColumn] === 'number' ? r[config.valueColumn] as number : 0,
  }));

  return { type: 'geoMap', data };
}

function adaptTable(
  table: SqlResultTable,
  config: { chartType: 'table'; visibleColumns: string[]; sortColumn?: string; sortDirection?: string }
): ChartDataResult {
  const visibleSet = new Set(config.visibleColumns);
  const columns = table.columns
    .filter(c => visibleSet.has(c.key))
    .map(c => ({ key: c.key, label: c.label, align: c.align }));

  const rows = [...table.rows];
  if (config.sortColumn) {
    const dir = config.sortDirection === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      const aVal = a[config.sortColumn!];
      const bVal = b[config.sortColumn!];
      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir;
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }

  return { type: 'table', columns, rows };
}

function adaptMultiBar(
  table: SqlResultTable,
  config: { chartType: 'stackedBar' | 'groupedBar'; categoryColumn: string; valueColumn: string; groupByColumn: string }
): ChartDataResult {
  const { categoryColumn, valueColumn, groupByColumn } = config;

  // Pivot: categories on x-axis, one series per group
  const categorySet = new Set<string>();
  const groupSet = new Set<string>();
  const valueMap = new Map<string, number>(); // "cat|group" → value

  for (const row of table.rows) {
    const cat = String(row[categoryColumn]);
    const group = String(row[groupByColumn]);
    categorySet.add(cat);
    groupSet.add(group);
    valueMap.set(`${cat}|${group}`, typeof row[valueColumn] === 'number' ? row[valueColumn] as number : 0);
  }

  const categories = [...categorySet];
  const series = [...groupSet].map(group => ({
    name: group,
    data: categories.map(cat => valueMap.get(`${cat}|${group}`) || 0),
  }));

  return {
    type: config.chartType,
    categories,
    series,
    unit: '',
  };
}
