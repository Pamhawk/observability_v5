import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { TrafficDataPoint } from '../../types';
import type { DynamicSeries } from '../../utils';

interface AxisTooltipParam {
  axisValue: string;
  marker: string;
  seriesName: string;
  value: number | string;
}

const SERIES_COLORS = [
  '#00B4D8', '#10B981', '#F97316', '#8B5CF6', '#EC4899',
  '#06B6D4', '#84CC16', '#EAB308', '#EF4444', '#6366F1',
];

interface TimeSeriesChartProps {
  data?: TrafficDataPoint[];
  dynamicSeries?: DynamicSeries[];
  timestamps?: string[];
  height?: number;
  showLegend?: boolean;
  stacked?: boolean;
  unit?: string;
  yAxisLabel?: string;
  trendline?: boolean;
  thresholdLine?: boolean;
  thresholdValue?: number;
  showTotalLine?: boolean;
}

export function TimeSeriesChart({
  data,
  dynamicSeries,
  timestamps,
  height = 300,
  showLegend = true,
  stacked = true,
  unit,
  yAxisLabel,
  trendline,
  thresholdLine,
  thresholdValue,
  showTotalLine,
}: TimeSeriesChartProps) {
  // ── Dynamic series mode (from query parser) ──
  if (dynamicSeries && timestamps) {
    const displayUnit = unit || 'Gbps';
    const axisName = yAxisLabel || displayUnit;

    // Build markLine entries for the first series
    const markLineData: object[] = [];
    if (trendline) markLineData.push({ type: 'average', name: 'Avg', lineStyle: { type: 'dashed', color: '#9ca3af' } });
    if (thresholdLine && thresholdValue != null) {
      markLineData.push({ yAxis: thresholdValue, name: 'Threshold', lineStyle: { color: '#EF4444', type: 'dashed', width: 1.5 }, label: { formatter: `${thresholdValue}` } });
    }

    // Total series for stackedArea
    const totalSeries = (stacked && showTotalLine) ? [{
      name: 'Total',
      type: 'line' as const,
      smooth: true,
      lineStyle: { width: 2, type: 'dashed' as const },
      data: timestamps.map((_, ti) => dynamicSeries.reduce((s, ser) => s + (ser.data[ti] ?? 0), 0)),
      itemStyle: { color: '#6b7280' },
    }] : [];

    const option: EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#1a1f2e' } },
        formatter: (params: any) => {
          if (!Array.isArray(params)) return '';
          let tip = `<div style="font-weight:600;margin-bottom:8px;">${params[0].axisValue}</div>`;
          params.forEach((p: AxisTooltipParam) => {
            tip += `<div style="display:flex;justify-content:space-between;gap:16px;">
              <span>${p.marker} ${p.seriesName}</span>
              <span style="font-weight:500;">${typeof p.value === 'number' ? p.value.toFixed(2) : p.value} ${displayUnit}</span>
            </div>`;
          });
          return tip;
        },
      },
      legend: {
        show: showLegend,
        bottom: 0,
        data: [...dynamicSeries.map(s => s.name), ...(showTotalLine ? ['Total'] : [])],
      },
      grid: { left: 60, right: 20, top: 20, bottom: showLegend ? 50 : 30 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: timestamps,
      },
      yAxis: {
        type: 'value',
        name: axisName,
        nameLocation: 'middle',
        nameGap: 45,
        axisLabel: { formatter: (v: number) => v.toFixed(0) },
      },
      series: [
        ...dynamicSeries.map((s, i) => ({
          name: s.name,
          type: 'line' as const,
          stack: stacked ? 'stack' : undefined,
          smooth: true,
          lineStyle: { width: 2 },
          areaStyle: stacked ? { opacity: 0.4 } : undefined,
          data: s.data,
          itemStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length] },
          ...(i === 0 && markLineData.length > 0 ? { markLine: { silent: true, data: markLineData } } : {}),
        })),
        ...totalSeries,
      ],
    };

    return (
      <ReactECharts
        option={option}
        notMerge
        style={{ height, width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    );
  }

  // ── Legacy fixed-series mode (existing callers) ──
  const legacyData = data || [];
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { backgroundColor: '#1a1f2e' } },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        let tooltip = `<div style="font-weight: 600; margin-bottom: 8px;">${new Date(params[0].axisValue).toLocaleString()}</div>`;
        params.forEach((param: any) => {
          tooltip += `<div style="display: flex; justify-content: space-between; gap: 16px;">
            <span>${param.marker} ${param.seriesName}</span>
            <span style="font-weight: 500;">${typeof param.value === 'number' ? param.value.toFixed(2) : param.value} Gbps</span>
          </div>`;
        });
        return tooltip;
      },
    },
    legend: {
      show: showLegend,
      bottom: 0,
      data: ['Total', 'Inbound', 'Outbound', 'Internal', 'Transit'],
    },
    grid: { left: 60, right: 20, top: 20, bottom: showLegend ? 50 : 30 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: legacyData.map(d => d.timestamp),
      axisLabel: {
        formatter: (value: string) => {
          const date = new Date(value);
          return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        },
      },
    },
    yAxis: {
      type: 'value',
      name: 'Gbps',
      nameLocation: 'middle',
      nameGap: 45,
      axisLabel: { formatter: (value: number) => `${value.toFixed(0)}` },
    },
    series: [
      { name: 'Total', type: 'line', stack: stacked ? 'Total' : undefined, smooth: true, lineStyle: { width: 2 }, areaStyle: stacked ? { opacity: 0.3 } : undefined, data: legacyData.map(d => d.total), itemStyle: { color: '#00B4D8' } },
      { name: 'Inbound', type: 'line', stack: stacked ? 'Traffic' : undefined, smooth: true, lineStyle: { width: 2 }, areaStyle: stacked ? { opacity: 0.5 } : undefined, data: legacyData.map(d => d.inbound), itemStyle: { color: '#10B981' } },
      { name: 'Outbound', type: 'line', stack: stacked ? 'Traffic' : undefined, smooth: true, lineStyle: { width: 2 }, areaStyle: stacked ? { opacity: 0.5 } : undefined, data: legacyData.map(d => d.outbound), itemStyle: { color: '#F97316' } },
      { name: 'Internal', type: 'line', stack: stacked ? 'Traffic' : undefined, smooth: true, lineStyle: { width: 2 }, areaStyle: stacked ? { opacity: 0.5 } : undefined, data: legacyData.map(d => d.internal), itemStyle: { color: '#8B5CF6' } },
      { name: 'Transit', type: 'line', stack: stacked ? 'Traffic' : undefined, smooth: true, lineStyle: { width: 2 }, areaStyle: stacked ? { opacity: 0.5 } : undefined, data: legacyData.map(d => d.transit), itemStyle: { color: '#EC4899' } },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
