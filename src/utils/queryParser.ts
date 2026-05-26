import type { Query } from '../types';

export interface ParsedQuery {
  lets: { name: string; expression: string }[];
  graphType: Query['graphType'];
  aggregations: { fn: string; metric: string; alias?: string }[];
  dimensions: string[];
  conditions: { field: string; op: string; values: string[] }[];
  limit?: number;
  comparePrevious?: string;
  gaugeMin?: number;
  gaugeMax?: number;
  thresholds?: number[];
  sankeyFrom?: string;
  sankeyTo?: string;
  topN?: number;
  label?: string;
}

/** Strip block comments only (slash-star ... star-slash) */
function stripComments(script: string): string {
  return script.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Detect graph type from script text. Returns null if undetectable. */
export function detectGraphType(script: string): Query['graphType'] | null {
  const cleaned = stripComments(script);
  const upper = cleaned.toUpperCase().trim();
  if (upper.includes('STACKED AREA')) return 'stackedArea';
  if (upper.includes('TIME SERIES')) return 'timeSeries';
  if (upper.includes('SINGLE VALUE')) return 'singleValue';
  if (/TOP[\s-]+\d+/.test(upper)) return 'topNBar';
  if (upper.includes('HEATMAP')) return 'heatmap';
  if (upper.includes('SANKEY')) return 'sankey';
  if (upper.includes('GAUGE')) return 'gauge';
  if (/\bGEO\b/.test(upper)) return 'geoMap';
  if (/\bDONUT\b/.test(upper)) return 'donut';
  if (/\bPIE\b/.test(upper)) return 'pie';
  if (/\bBAR\b/.test(upper)) return 'bar';
  if (/\bTABLE\b/.test(upper)) return 'table';
  return null;
}

/** Parse comma-separated values (unquoted, split by comma) */
function parseValueList(raw: string): string[] {
  return raw.split(',').map(v => v.trim()).filter(Boolean);
}

/** Parse the full query script into a structured object */
export function parseQuery(script: string): ParsedQuery | null {
  const cleaned = stripComments(script).trim();
  if (!cleaned) return null;

  const graphType = detectGraphType(script);
  if (!graphType) return null;

  // ── Extract LET statements ──
  const lets: ParsedQuery['lets'] = [];
  const letRegex = /\bLET\s+(\w+)\s*=\s*(.+)/gi;
  let letMatch: RegExpExecArray | null;
  while ((letMatch = letRegex.exec(cleaned)) !== null) {
    lets.push({ name: letMatch[1], expression: letMatch[2].trim() });
  }

  // ── Remove LET lines to get the main statement ──
  const mainStatement = cleaned
    .replace(/\bLET\s+\w+\s*=\s*.+/gi, '')
    .trim();

  if (!mainStatement) return null;

  // ── Normalise whitespace ──
  const norm = mainStatement.replace(/\s+/g, ' ');

  // ── Extract TOP N ──
  let topN: number | undefined;
  const topMatch = norm.match(/\bTOP[\s-]+(\d+)\b/i);
  if (topMatch) topN = parseInt(topMatch[1], 10);

  // ── Extract aggregations ──
  // v5 syntax: AGG Metric (space-separated, no parentheses)
  const aggregations: ParsedQuery['aggregations'] = [];

  // Remove graph type keyword to get the aggregation region
  let afterType = norm;
  afterType = afterType.replace(/\bSTACKED\s+AREA\b/i, '');
  afterType = afterType.replace(/\bTIME\s+SERIES\b/i, '');
  afterType = afterType.replace(/\bSINGLE\s+VALUE\b/i, '');
  afterType = afterType.replace(/\bTOP[\s-]+\d+\b/i, '');
  afterType = afterType.replace(/\bGEO\s+MAP\b/i, '');
  afterType = afterType.replace(/\bHEATMAP\b/i, '');
  afterType = afterType.replace(/\bSANKEY\b/i, '');
  afterType = afterType.replace(/\bGAUGE\b/i, '');
  afterType = afterType.replace(/\bGEO\b/i, '');
  afterType = afterType.replace(/\bDONUT\b/i, '');
  afterType = afterType.replace(/\bPIE\b/i, '');
  afterType = afterType.replace(/\bBAR\b/i, '');
  afterType = afterType.replace(/\bTABLE\b/i, '');
  afterType = afterType.trim();

  // Match AGG Metric (space-separated) — excludes MIN/MAX to avoid gauge modifier clash
  const aggRegex = /\b(TOTAL|AVERAGE|MEDIAN|COUNT|P95|P99)\s+([\w.]+)/gi;
  let aggMatch: RegExpExecArray | null;
  while ((aggMatch = aggRegex.exec(afterType)) !== null) {
    aggregations.push({ fn: aggMatch[1].toUpperCase(), metric: aggMatch[2] });
  }

  // Match MIN/MAX as aggregation only when followed by a letter (metric name), not a digit (gauge modifier)
  const minMaxAggRegex = /\b(MIN|MAX)\s+([A-Za-z][\w.]*)/gi;
  let mmMatch: RegExpExecArray | null;
  while ((mmMatch = minMaxAggRegex.exec(afterType)) !== null) {
    aggregations.push({ fn: mmMatch[1].toUpperCase(), metric: mmMatch[2] });
  }

  // Also support parenthesized syntax for backward compatibility and LET expressions
  if (aggregations.length === 0) {
    const parenAggRegex = /\b(TOTAL|AVERAGE|MEDIAN|COUNT|MIN|MAX|P95|P99)\s*\(\s*([\w.]+)\s*\)/gi;
    let parenMatch: RegExpExecArray | null;
    while ((parenMatch = parenAggRegex.exec(afterType)) !== null) {
      aggregations.push({ fn: parenMatch[1].toUpperCase(), metric: parenMatch[2] });
    }
  }

  // If no aggregation found, check for a variable reference (from LET)
  if (aggregations.length === 0) {
    const varRef = afterType.match(/^\s*([\w]+)/);
    if (varRef) {
      const letDef = lets.find(l => l.name === varRef[1]);
      if (letDef) {
        // Extract aggregations from the LET expression (supports both syntaxes)
        const letAggRegex = /\b(TOTAL|AVERAGE|MEDIAN|COUNT|MIN|MAX|P95|P99)\s+([A-Za-z][\w.]*)/gi;
        let lm: RegExpExecArray | null;
        while ((lm = letAggRegex.exec(letDef.expression)) !== null) {
          aggregations.push({ fn: lm[1].toUpperCase(), metric: lm[2] });
        }
        // Fallback: parenthesized in LET
        if (aggregations.length === 0) {
          const letParenRegex = /\b(TOTAL|AVERAGE|MEDIAN|COUNT|MIN|MAX|P95|P99)\s*\(\s*([\w.]+)\s*\)/gi;
          let lpm: RegExpExecArray | null;
          while ((lpm = letParenRegex.exec(letDef.expression)) !== null) {
            aggregations.push({ fn: lpm[1].toUpperCase(), metric: lpm[2] });
          }
        }
      }
    }
  }

  // ── Extract AS alias ──
  let label: string | undefined;
  const asMatch = norm.match(/\bAS\s+"([^"]+)"/i);
  if (asMatch) label = asMatch[1];

  // ── Extract BY dimensions ──
  const dimensions: string[] = [];
  const byMatch = norm.match(/\bBY\s+([\w.,\s]+?)(?=\s+(?:WHERE|LIMIT|COMPARE|MIN|MAX|THRESHOLDS|FROM|TO)\b|$)/i);
  if (byMatch) {
    const dims = byMatch[1].split(',').map(d => d.trim()).filter(Boolean);
    dimensions.push(...dims);
  }

  // ── Extract FROM / TO (Sankey) ──
  let sankeyFrom: string | undefined;
  let sankeyTo: string | undefined;
  const fromToMatch = norm.match(/\bFROM\s+([\w.]+)\s+TO\s+([\w.]+)/i);
  if (fromToMatch) {
    sankeyFrom = fromToMatch[1];
    sankeyTo = fromToMatch[2];
  }

  // ── Extract WHERE conditions ──
  const conditions: ParsedQuery['conditions'] = [];
  const whereMatch = norm.match(/\bWHERE\s+(.+?)(?=\s+(?:LIMIT|COMPARE|MIN\s+\d|MAX\s+\d|THRESHOLDS)\b|$)/i);
  if (whereMatch) {
    const whereClause = whereMatch[1];
    // Split on AND / OR (keeping the keyword for multi-condition, but we parse each segment)
    const segments = whereClause.split(/\s+(?:AND\s+NOT|OR\s+NOT|AND|OR)\s+/i);
    for (const seg of segments) {
      const trimmed = seg.trim();
      if (!trimmed) continue;

      // Match: field IS NOT val1, val2
      const isNotMatch = trimmed.match(/^([\w.]+)\s+IS\s+NOT\s+(.+)$/i);
      if (isNotMatch) {
        conditions.push({
          field: isNotMatch[1],
          op: 'IS NOT',
          values: parseValueList(isNotMatch[2]),
        });
        continue;
      }

      // Match: field IS val1, val2
      const isMatch = trimmed.match(/^([\w.]+)\s+IS\s+(.+)$/i);
      if (isMatch) {
        conditions.push({
          field: isMatch[1],
          op: 'IS',
          values: parseValueList(isMatch[2]),
        });
        continue;
      }

      // Match: field BETWEEN n AND n
      const betweenMatch = trimmed.match(/^([\w.]+)\s+BETWEEN\s+(\d+)\s+AND\s+(\d+)$/i);
      if (betweenMatch) {
        conditions.push({
          field: betweenMatch[1],
          op: 'BETWEEN',
          values: [betweenMatch[2], betweenMatch[3]],
        });
        continue;
      }

      // Match: field op value (==, !=, >=, <=, >, <)
      const compMatch = trimmed.match(/^([\w.]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
      if (compMatch) {
        conditions.push({
          field: compMatch[1],
          op: compMatch[2],
          values: parseValueList(compMatch[3]),
        });
      }
    }
  }

  // ── Extract LIMIT ──
  let limit: number | undefined;
  const limitMatch = norm.match(/\bLIMIT\s+(\d+)/i);
  if (limitMatch) limit = parseInt(limitMatch[1], 10);

  // ── Extract COMPARE PREVIOUS ──
  let comparePrevious: string | undefined;
  const compareMatch = norm.match(/\bCOMPARE\s+PREVIOUS\s+(\w+)/i);
  if (compareMatch) comparePrevious = compareMatch[1];

  // ── Extract MIN / MAX (Gauge) ──
  let gaugeMin: number | undefined;
  let gaugeMax: number | undefined;
  const minMatch = norm.match(/\bMIN\s+(\d+)/i);
  const maxMatch = norm.match(/\bMAX\s+(\d+)/i);
  if (minMatch) gaugeMin = parseInt(minMatch[1], 10);
  if (maxMatch) gaugeMax = parseInt(maxMatch[1], 10);

  // ── Extract THRESHOLDS ──
  let thresholds: number[] | undefined;
  const threshMatch = norm.match(/\bTHRESHOLDS\s+([\d,\s]+)/i);
  if (threshMatch) {
    thresholds = threshMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  }

  return {
    lets,
    graphType,
    aggregations,
    dimensions,
    conditions,
    limit,
    comparePrevious,
    gaugeMin,
    gaugeMax,
    thresholds,
    sankeyFrom,
    sankeyTo,
    topN,
    label,
  };
}
