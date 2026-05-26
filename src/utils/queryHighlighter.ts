import { queryKeywords } from '../data/mockData';

// Color palette matching Query DSL Reference v5 Word document
export const DSL_COLORS = {
  graphType: '#2563EB',     // Blue
  aggregation: '#7C3AED',   // Purple
  metric: '#059669',        // Green
  dimension: '#0891B2',     // Teal
  modifier: '#EA580C',      // Orange
  value: '#DC2626',         // Red
  operator: '#4B5563',      // Dark gray
  number: '#B91C1C',        // Dark red
  comment: '#9CA3AF',       // Light gray
  bracket: '#6B7280',       // Gray
  string: '#DC2626',        // Red
  plain: '#1a1a2e',         // Dark
};

const GRAPH_TYPE_WORDS = new Set([
  'TIME', 'SERIES', 'STACKED', 'AREA', 'SINGLE', 'VALUE',
  'PIE', 'DONUT', 'BAR', 'TOP', 'GAUGE', 'GEO', 'HEATMAP', 'SANKEY', 'TABLE',
]);
const AGG_WORDS = new Set(queryKeywords.aggregations.map(a => a.toUpperCase()));
const METRIC_UPPER = new Map(queryKeywords.metrics.map(m => [m.toUpperCase(), true]));
const DIM_UPPER = new Map(queryKeywords.dimensions.map(d => [d.toUpperCase(), true]));
const MODIFIER_WORDS = new Set([
  'BY', 'WHERE', 'LIMIT', 'LET', 'AS', 'FROM', 'TO',
  'COMPARE', 'PREVIOUS', 'THRESHOLDS',
]);
const OPERATOR_WORDS = new Set(['IS', 'NOT', 'AND', 'OR', 'BETWEEN']);

function classifyWord(word: string): keyof typeof DSL_COLORS {
  const upper = word.toUpperCase();
  if (GRAPH_TYPE_WORDS.has(upper)) return 'graphType';
  if (AGG_WORDS.has(upper)) return 'aggregation';
  if (METRIC_UPPER.has(upper)) return 'metric';
  if (DIM_UPPER.has(upper)) return 'dimension';
  if (MODIFIER_WORDS.has(upper)) return 'modifier';
  if (OPERATOR_WORDS.has(upper)) return 'operator';
  return 'value';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Syntax-highlight a query script and return HTML string */
export function highlightQueryScript(script: string): string {
  let result = '';
  let i = 0;

  while (i < script.length) {
    // Block comments
    if (script[i] === '/' && script[i + 1] === '*') {
      const end = script.indexOf('*/', i + 2);
      const commentEnd = end === -1 ? script.length : end + 2;
      const commentText = script.slice(i, commentEnd);
      result += `<span style="color:${DSL_COLORS.comment};font-style:italic">${escapeHtml(commentText)}</span>`;
      i = commentEnd;
      continue;
    }

    // Strings "..."
    if (script[i] === '"') {
      const end = script.indexOf('"', i + 1);
      const strEnd = end === -1 ? script.length : end + 1;
      const str = script.slice(i, strEnd);
      result += `<span style="color:${DSL_COLORS.string}">${escapeHtml(str)}</span>`;
      i = strEnd;
      continue;
    }

    // Numbers (with optional time suffix like 1h, 30d)
    if (/[0-9]/.test(script[i])) {
      let j = i;
      while (j < script.length && /[0-9]/.test(script[j])) j++;
      if (j < script.length && /[hdwm]/i.test(script[j])) j++;
      const num = script.slice(i, j);
      result += `<span style="color:${DSL_COLORS.number};font-weight:600">${escapeHtml(num)}</span>`;
      i = j;
      continue;
    }

    // Words (identifiers, keywords, etc.) — include dots and hyphens in words
    if (/[a-zA-Z_]/.test(script[i])) {
      let j = i;
      while (j < script.length && /[\w.-]/.test(script[j])) j++;
      const word = script.slice(i, j);
      const category = classifyWord(word);
      const color = DSL_COLORS[category];
      const bold = ['graphType', 'aggregation', 'modifier'].includes(category);
      result += `<span style="color:${color}${bold ? ';font-weight:600' : ''}">${escapeHtml(word)}</span>`;
      i = j;
      continue;
    }

    // Symbol operators
    if (/[=!<>]/.test(script[i])) {
      let j = i;
      while (j < script.length && /[=!<>]/.test(script[j])) j++;
      const op = script.slice(i, j);
      result += `<span style="color:${DSL_COLORS.operator}">${escapeHtml(op)}</span>`;
      i = j;
      continue;
    }

    // Brackets and arithmetic
    if (/[()*/+,]/.test(script[i])) {
      result += `<span style="color:${DSL_COLORS.bracket}">${escapeHtml(script[i])}</span>`;
      i++;
      continue;
    }

    // Whitespace and other characters
    result += escapeHtml(script[i]);
    i++;
  }

  return result;
}
