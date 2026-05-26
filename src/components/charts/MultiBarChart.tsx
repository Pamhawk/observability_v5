import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

interface MultiBarSeries {
  name: string;
  data: number[];
}

interface MultiBarChartProps {
  categories: string[];
  series: MultiBarSeries[];
  height?: number;
  stacked?: boolean;
  unit?: string;
  yAxisLabel?: string;
  horizontal?: boolean;
  showValueLabels?: boolean;
  showTotalOnBar?: boolean;
  showSegmentLabels?: boolean;
  segmentLabelFormat?: 'value' | 'percentage';
}

const COLORS = [
  '#00B4D8', '#10B981', '#F97316', '#8B5CF6', '#EC4899',
  '#F59E0B', '#6366F1', '#14B8A6', '#EF4444', '#84CC16',
];

export function MultiBarChart({
  categories,
  series,
  height = 300,
  stacked = false,
  unit = '',
  yAxisLabel,
  horizontal = false,
  showValueLabels,
  showTotalOnBar,
  showSegmentLabels,
  segmentLabelFormat = 'value',
}: MultiBarChartProps) {
  // Pre-compute per-category totals for percentage labels
  const categoryTotals = categories.map((_, ci) => series.reduce((sum, s) => sum + (s.data[ci] ?? 0), 0));

  const numericAxisConfig = {
    type: 'value' as const,
    axisLabel: {
      formatter: (value: number) => {
        if (value >= 1e9) return `${(value / 1e9).toFixed(1)}G`;
        if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
        if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
        return `${value}`;
      },
    },
    name: yAxisLabel || unit || undefined,
    nameLocation: 'middle' as const,
    nameGap: 45,
    nameTextStyle: { fontSize: 11, color: '#9ca3af' },
  };

  const categoryAxisConfig = {
    type: 'category' as const,
    data: categories,
    axisLabel: {
      rotate: !horizontal && categories.length > 8 ? 45 : 0,
      interval: 0,
      fontSize: 11,
    },
  };

  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: series.map(s => s.name),
      top: 0,
      textStyle: { fontSize: 11, color: '#6b7280' },
    },
    grid: {
      left: horizontal ? 100 : 60,
      right: 20,
      top: 36,
      bottom: horizontal ? 30 : 60,
    },
    xAxis: horizontal ? numericAxisConfig : categoryAxisConfig,
    yAxis: horizontal ? { ...categoryAxisConfig, axisLabel: { width: 80, overflow: 'truncate' } } : numericAxisConfig,
    series: [
      ...series.map((s, i) => ({
        name: s.name,
        type: 'bar' as const,
        data: s.data,
        stack: stacked ? 'total' : undefined,
        itemStyle: { color: COLORS[i % COLORS.length] },
        emphasis: { focus: 'series' as const },
        label: (showValueLabels || showSegmentLabels) ? {
          show: true,
          position: horizontal ? 'inside' as const : 'inside' as const,
          formatter: (params: any) => {
            if (!params.value) return '';
            if (segmentLabelFormat === 'percentage' && stacked) {
              const total = categoryTotals[params.dataIndex];
              return total > 0 ? `${((params.value / total) * 100).toFixed(0)}%` : '';
            }
            return `${params.value.toLocaleString()}`;
          },
          fontSize: 10,
          color: '#fff',
        } : undefined,
      })),
      // Total label on top of stacked bars
      ...(stacked && showTotalOnBar ? [{
        name: '__total__',
        type: 'bar' as const,
        stack: 'total',
        silent: true,
        itemStyle: { color: 'transparent' },
        data: categoryTotals,
        label: {
          show: true,
          position: horizontal ? 'right' as const : 'top' as const,
          formatter: (params: any) => `${categoryTotals[params.dataIndex].toLocaleString()}`,
          fontSize: 11,
          color: '#374151',
          fontWeight: 'bold' as const,
        },
      }] : []),
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
