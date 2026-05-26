import type { SqlResultTable, SqlResultColumn, ChartRecommendation } from '../types';

interface ColumnClassification {
  numeric: SqlResultColumn[];
  categorical: SqlResultColumn[];
  time: SqlResultColumn[];
  geo: SqlResultColumn[];
}

function classifyColumns(columns: SqlResultColumn[]): ColumnClassification {
  return {
    numeric: columns.filter(c => c.type === 'number'),
    categorical: columns.filter(c => c.type === 'string'),
    time: columns.filter(c => c.type === 'timestamp'),
    geo: columns.filter(c => c.type === 'geo'),
  };
}

// Detect source→target flow patterns (e.g. Src_ASN → Dst_ASN)
const FLOW_PREFIXES = [
  ['Src', 'Dst'], ['src', 'dst'], ['source', 'target'],
  ['Source', 'Target'], ['from', 'to'], ['From', 'To'],
  ['Prev', 'Nxt'], ['prev', 'nxt'],
];

function looksLikeFlow(col1: string, col2: string): boolean {
  for (const [srcPfx, dstPfx] of FLOW_PREFIXES) {
    if (col1.startsWith(srcPfx) && col2.startsWith(dstPfx)) {
      // Check if the suffix matches (e.g. Src_ASN / Dst_ASN)
      const suffix1 = col1.slice(srcPfx.length);
      const suffix2 = col2.slice(dstPfx.length);
      if (suffix1 === suffix2) return true;
    }
  }
  return false;
}

export function recommendCharts(result: SqlResultTable): ChartRecommendation[] {
  const { numeric, categorical, time, geo } = classifyColumns(result.columns);
  const rowCount = result.rows.length;
  const recommendations: ChartRecommendation[] = [];

  const hasCat = categorical.length > 0;
  const hasTime = time.length > 0;
  const hasGeo = geo.length > 0;
  const hasNum = numeric.length > 0;

  // ─── 1. Only numerics, no categories/time/geo ───
  // Best: singleValue (KPI), then gauge
  if (hasNum && !hasCat && !hasTime && !hasGeo) {
    recommendations.push({
      chartType: 'singleValue',
      score: 10,
      reason: 'Single aggregate result — ideal for a KPI display',
      defaultConfig: {
        chartType: 'singleValue',
        valueColumn: numeric[0].key,
        label: numeric[0].label,
        unit: '',
      },
    });

    recommendations.push({
      chartType: 'gauge',
      score: 8,
      reason: 'Single value with natural bounds — good for gauge',
      defaultConfig: {
        chartType: 'gauge',
        valueColumn: numeric[0].key,
        min: 0,
        max: 100,
        thresholds: [60, 85] as [number, number],
        label: numeric[0].label,
      },
    });
  }

  // ─── 2. Time + numeric (with or without categorical grouping) ───
  if (hasTime && hasNum) {
    if (hasCat) {
      // Time + metric + dimension: stacked area prio 1, area prio 2, time series prio 3
      recommendations.push({
        chartType: 'stackedArea',
        score: 10,
        reason: 'Time + metric + dimension — stacked area shows part-of-whole over time',
        defaultConfig: {
          chartType: 'stackedArea',
          timeColumn: time[0].key,
          valueColumns: numeric.slice(0, 1).map(n => n.key),
          groupByColumn: categorical[0].key,
        },
      });
      recommendations.push({
        chartType: 'areaTimeSeries',
        score: 9,
        reason: 'Area time series shows filled trends with dimension grouping',
        defaultConfig: {
          chartType: 'areaTimeSeries',
          timeColumn: time[0].key,
          valueColumns: numeric.map(n => n.key),
          groupByColumn: categorical[0].key,
        },
      });
      recommendations.push({
        chartType: 'timeSeries',
        score: 8,
        reason: 'Time series line chart for temporal trends',
        defaultConfig: {
          chartType: 'timeSeries',
          timeColumn: time[0].key,
          valueColumns: numeric.map(n => n.key),
          groupByColumn: categorical[0].key,
        },
      });
    } else {
      // Time + metric only (independent, no dimension): time series prio 1, area prio 2
      recommendations.push({
        chartType: 'timeSeries',
        score: 10,
        reason: 'Time column + metrics — line chart shows temporal trends',
        defaultConfig: {
          chartType: 'timeSeries',
          timeColumn: time[0].key,
          valueColumns: numeric.map(n => n.key),
        },
      });
      recommendations.push({
        chartType: 'areaTimeSeries',
        score: 9,
        reason: 'Area time series — filled line emphasises magnitude over time',
        defaultConfig: {
          chartType: 'areaTimeSeries',
          timeColumn: time[0].key,
          valueColumns: numeric.map(n => n.key),
        },
      });
    }
  }

  // ─── 3. Geo + numeric ───
  // Best: geoMap (geographic data needs a map)
  if (hasGeo && hasNum) {
    recommendations.push({
      chartType: 'geoMap',
      score: 10,
      reason: 'Geographic column detected — map is the natural visualization',
      defaultConfig: {
        chartType: 'geoMap',
        geoColumn: geo[0].key,
        valueColumn: numeric[0].key,
      },
    });
  }

  // ─── 4. 1 categorical + 1+ numeric, no time ───
  if (hasCat && hasNum && !hasTime) {
    const catCount = categorical.length;

    // 4a. Single categorical dimension
    if (catCount === 1) {
      // Few rows (<=6): pie/donut best for part-of-whole
      if (rowCount <= 6) {
        recommendations.push({
          chartType: 'pie',
          score: 9,
          reason: `${rowCount} categories — pie chart clearly shows proportions`,
          defaultConfig: {
            chartType: 'pie',
            categoryColumn: categorical[0].key,
            valueColumn: numeric[0].key,
          },
        });

        recommendations.push({
          chartType: 'donut',
          score: 8,
          reason: `${rowCount} categories with center total`,
          defaultConfig: {
            chartType: 'donut',
            categoryColumn: categorical[0].key,
            valueColumn: numeric[0].key,
          },
        });

        recommendations.push({
          chartType: 'bar',
          score: 7,
          reason: 'Bar chart for comparing individual values',
          defaultConfig: {
            chartType: 'bar',
            categoryColumn: categorical[0].key,
            valueColumn: numeric[0].key,
            sortOrder: 'desc',
            orientation: 'vertical',
          },
        });
      }
      // Many rows (>6): bar is more readable than pie
      else {
        recommendations.push({
          chartType: 'bar',
          score: 9,
          reason: `${rowCount} categories — bar chart is more readable than pie for many items`,
          defaultConfig: {
            chartType: 'bar',
            categoryColumn: categorical[0].key,
            valueColumn: numeric[0].key,
            sortOrder: 'desc',
            orientation: 'vertical',
          },
        });

        recommendations.push({
          chartType: 'topNBar',
          score: 8,
          reason: `${rowCount} rows — horizontal bar ranks items clearly`,
          defaultConfig: {
            chartType: 'topNBar',
            categoryColumn: categorical[0].key,
            valueColumn: numeric[0].key,
            sortOrder: 'desc',
            orientation: 'horizontal',
            limit: Math.min(10, rowCount),
          },
        });

        if (rowCount <= 12) {
          recommendations.push({
            chartType: 'pie',
            score: 5,
            reason: 'Pie possible but many slices reduce readability',
            defaultConfig: {
              chartType: 'pie',
              categoryColumn: categorical[0].key,
              valueColumn: numeric[0].key,
              limit: 8,
            },
          });
        }
      }
    }

    // 4b. 2+ categorical dimensions
    if (catCount >= 2) {
      const cat1 = categorical[0];
      const cat2 = categorical[1];
      const isFlow = looksLikeFlow(cat1.key, cat2.key);

      // Heatmap: best for 2-dimensional matrix patterns
      recommendations.push({
        chartType: 'heatmap',
        score: isFlow ? 8 : 9,
        reason: `${cat1.label} x ${cat2.label} matrix — heatmap reveals patterns`,
        defaultConfig: {
          chartType: 'heatmap',
          xColumn: cat1.key,
          yColumn: cat2.key,
          valueColumn: numeric[0].key,
        },
      });

      // Sankey: only if columns look like source→target flow
      // Use all categorical columns as nodes (up to 10), defaulting to the first 2
      const sankeyNodeCols = categorical.slice(0, 10);
      if (isFlow) {
        recommendations.push({
          chartType: 'sankey',
          score: 10,
          reason: `Flow from ${cat1.label} → ${cat2.label} — sankey shows flow relationships`,
          defaultConfig: {
            chartType: 'sankey',
            nodes: sankeyNodeCols.map(c => ({ dimension: c.key })),
            valueColumn: numeric[0].key,
          },
        });
      } else {
        recommendations.push({
          chartType: 'sankey',
          score: 5,
          reason: `${cat1.label} → ${cat2.label} — sankey possible but not a natural flow`,
          defaultConfig: {
            chartType: 'sankey',
            nodes: sankeyNodeCols.map(c => ({ dimension: c.key })),
            valueColumn: numeric[0].key,
          },
        });
      }

      // Grouped bar: good for comparing groups across categories
      recommendations.push({
        chartType: 'groupedBar',
        score: 7,
        reason: `Compare ${cat2.label} values across ${cat1.label} categories`,
        defaultConfig: {
          chartType: 'groupedBar',
          categoryColumn: cat1.key,
          valueColumn: numeric[0].key,
          groupByColumn: cat2.key,
        },
      });

      // Stacked bar: part-of-whole comparison across categories
      recommendations.push({
        chartType: 'stackedBar',
        score: 6,
        reason: `Part-of-whole breakdown of ${cat2.label} per ${cat1.label}`,
        defaultConfig: {
          chartType: 'stackedBar',
          categoryColumn: cat1.key,
          valueColumn: numeric[0].key,
          groupByColumn: cat2.key,
        },
      });

      // Simple bar (collapse one dimension)
      recommendations.push({
        chartType: 'bar',
        score: 5,
        reason: 'Simple bar using first category only',
        defaultConfig: {
          chartType: 'bar',
          categoryColumn: cat1.key,
          valueColumn: numeric[0].key,
          sortOrder: 'desc',
          orientation: 'vertical',
        },
      });
    }

    // 4c. 3+ categoricals or many numerics → table first
    if (catCount >= 3 || numeric.length >= 4) {
      // Bump table score high for complex data
      recommendations.push({
        chartType: 'table',
        score: 10,
        reason: `${catCount} dimensions + ${numeric.length} metrics — table shows all data clearly`,
        defaultConfig: {
          chartType: 'table',
          visibleColumns: result.columns.map(c => c.key),
        },
      });
    }
  }

  // ─── 5. Table: always available as fallback ───
  // Only add if not already added with a high score
  if (!recommendations.some(r => r.chartType === 'table')) {
    recommendations.push({
      chartType: 'table',
      score: 3,
      reason: 'Raw tabular view of all data',
      defaultConfig: {
        chartType: 'table',
        visibleColumns: result.columns.map(c => c.key),
      },
    });
  }

  // Sort by score descending, then alphabetically for stability
  recommendations.sort((a, b) => b.score - a.score || a.chartType.localeCompare(b.chartType));

  return recommendations;
}
