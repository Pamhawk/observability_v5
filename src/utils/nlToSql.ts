/**
 * Natural-language → SQL converter (prototype / template-based).
 * Detects dimensions, metrics, intents, and builds a plausible SQL string.
 */

const TERM_TO_COLUMN: [string, string][] = [
  // Longer phrases first so they match before shorter substrings
  ['source country', 'Src_Country'],
  ['destination country', 'Dst_Country'],
  ['source asn', 'Src_ASN'],
  ['destination asn', 'Dst_ASN'],
  ['source ip', 'Src_IP'],
  ['destination ip', 'Dst_IP'],
  ['source port', 'Src_Port'],
  ['destination port', 'Dst_Port'],
  ['source city', 'Src_City'],
  ['destination city', 'Dst_City'],
  ['countries', 'Src_Country'],
  ['country', 'Src_Country'],
  ['asns', 'Src_ASN'],
  ['asn', 'Src_ASN'],
  ['autonomous system', 'Src_ASN'],
  ['protocol', 'Protocol'],
  ['protocols', 'Protocol'],
  ['port', 'Dst_Port'],
  ['ports', 'Dst_Port'],
  ['router', 'Router'],
  ['routers', 'Router'],
  ['interface', 'Interface'],
  ['interfaces', 'Interface'],
  ['ip address', 'Src_IP'],
  ['ip', 'Src_IP'],
  ['city', 'Src_City'],
  ['cities', 'Src_City'],
];

const TERM_TO_METRIC: [string, { column: string; agg: string }][] = [
  ['packet loss', { column: 'Packet_Loss', agg: 'AVG' }],
  ['packet count', { column: 'Packets', agg: 'SUM' }],
  ['flow count', { column: 'Flows', agg: 'SUM' }],
  ['bits per second', { column: 'Bits_Per_Second', agg: 'AVG' }],
  ['throughput', { column: 'Bits_Per_Second', agg: 'AVG' }],
  ['bandwidth', { column: 'Bits_Per_Second', agg: 'AVG' }],
  ['traffic', { column: 'Bytes', agg: 'SUM' }],
  ['bytes', { column: 'Bytes', agg: 'SUM' }],
  ['volume', { column: 'Bytes', agg: 'SUM' }],
  ['packets', { column: 'Packets', agg: 'SUM' }],
  ['flows', { column: 'Flows', agg: 'SUM' }],
  ['latency', { column: 'Latency', agg: 'AVG' }],
  ['delay', { column: 'Latency', agg: 'AVG' }],
  ['jitter', { column: 'Jitter', agg: 'AVG' }],
  ['loss', { column: 'Packet_Loss', agg: 'AVG' }],
];

function detectMetric(text: string): { column: string; agg: string } {
  for (const [term, m] of TERM_TO_METRIC) {
    if (text.includes(term)) return m;
  }
  return { column: 'Bytes', agg: 'SUM' };
}

function detectDimensions(text: string): string[] {
  const dims: string[] = [];
  for (const [term, col] of TERM_TO_COLUMN) {
    if (text.includes(term) && !dims.includes(col)) {
      dims.push(col);
    }
  }
  return dims;
}

function detectAgg(text: string, fallback: string): string {
  if (/\b(average|avg|mean)\b/.test(text)) return 'AVG';
  if (/\b(total|sum)\b/.test(text)) return 'SUM';
  if (/\b(maximum|max|highest|peak)\b/.test(text)) return 'MAX';
  if (/\b(minimum|min|lowest)\b/.test(text)) return 'MIN';
  if (/\bcount\b/.test(text)) return 'COUNT';
  return fallback;
}

export function nlToSql(input: string): string | null {
  const text = input.toLowerCase().trim();
  if (!text || text.length < 3) return null;

  const metric = detectMetric(text);
  const dims = detectDimensions(text);
  const agg = detectAgg(text, metric.agg);

  // Detect limit (top N)
  const limitMatch = text.match(/\btop\s+(\d+)\b/);
  const limit = limitMatch ? parseInt(limitMatch[1]) : null;

  // Detect temporal intent
  const isTimeSeries = /\b(over time|per hour|per day|per minute|trend|timeline|time series|hourly|daily|temporal)\b/.test(text);

  // --- Build SQL ---

  // Time series
  if (isTimeSeries) {
    if (dims.length > 0) {
      return `SELECT time, ${dims[0]}, ${agg}(${metric.column}) AS ${metric.column}\nFROM flows\nGROUP BY time, ${dims[0]}\nORDER BY time`;
    }
    return `SELECT time, ${agg}(${metric.column}) AS ${metric.column}\nFROM flows\nGROUP BY time\nORDER BY time`;
  }

  // Top N with dimension
  if (limit && dims.length > 0) {
    return `SELECT ${dims[0]}, ${agg}(${metric.column}) AS Total_${metric.column}\nFROM flows\nGROUP BY ${dims[0]}\nORDER BY Total_${metric.column} DESC\nLIMIT ${limit}`;
  }

  // Scalar / single value
  if (/^(total|overall|sum of|average|avg of|how much|count of)\b/.test(text) && dims.length === 0) {
    return `SELECT ${agg}(${metric.column}) AS Total_${metric.column}\nFROM flows`;
  }

  // Two dimensions → heatmap / sankey shape
  if (dims.length >= 2) {
    return `SELECT ${dims[0]}, ${dims[1]}, ${agg}(${metric.column}) AS Total_${metric.column}\nFROM flows\nGROUP BY ${dims[0]}, ${dims[1]}\nORDER BY Total_${metric.column} DESC\nLIMIT 20`;
  }

  // One dimension → bar / pie
  if (dims.length === 1) {
    const l = limit || 10;
    return `SELECT ${dims[0]}, ${agg}(${metric.column}) AS Total_${metric.column}\nFROM flows\nGROUP BY ${dims[0]}\nORDER BY Total_${metric.column} DESC\nLIMIT ${l}`;
  }

  // Fallback: traffic over time
  return `SELECT time, ${agg}(${metric.column}) AS ${metric.column}\nFROM flows\nGROUP BY time\nORDER BY time`;
}

/** Example prompts shown in the placeholder / suggestions UI */
export const NL_EXAMPLES = [
  'Top 10 countries by traffic',
  'Traffic over time by protocol',
  'Average latency by destination country',
  'Top 5 ASNs by bytes',
  'Packets by source country and destination country',
  'Bandwidth trend over time',
  'Total flows by router',
  'Top 20 destination ports by packet count',
];
