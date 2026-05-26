import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';


interface BarChartData {
  name: string;
  value: number;
  percent?: number;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  horizontal?: boolean;
  showPercent?: boolean;
  unit?: string;
  colors?: string[];
  yAxisLabel?: string;
  thresholdLine?: boolean;
  thresholdValue?: number;
  showValueLabels?: boolean;
}

const defaultColors = [
  '#00B4D8',
  '#10B981',
  '#F97316',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#6366F1',
  '#14B8A6',
  '#EF4444',
  '#84CC16',
];

export function BarChart({
  data,
  height = 300,
  horizontal = false,
  showPercent = true,
  unit = '',
  colors = defaultColors,
  yAxisLabel,
  thresholdLine,
  thresholdValue,
  showValueLabels,
}: BarChartProps) {
  const showLabels = showValueLabels ?? showPercent;
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const param = params[0];
        const dataItem = data.find(d => d.name === param.name);
        let tooltip = `<div style="font-weight: 600; margin-bottom: 8px;">${param.name}</div>`;
        tooltip += `<div>Value: <strong>${param.value.toLocaleString()} ${unit}</strong></div>`;
        if (showPercent && dataItem?.percent !== undefined) {
          tooltip += `<div>Percent: <strong>${dataItem.percent.toFixed(1)}%</strong></div>`;
        }
        return tooltip;
      },
    },
    grid: {
      left: horizontal ? 100 : 60,
      right: 20,
      top: 20,
      bottom: horizontal ? 30 : 60,
    },
    xAxis: horizontal
      ? {
          type: 'value',
          axisLabel: {
            formatter: (value: number) => `${value.toLocaleString()}`,
          },
        }
      : {
          type: 'category',
          data: data.map(d => d.name),
          axisLabel: {
            rotate: 45,
            interval: 0,
          },
        },
    yAxis: horizontal
      ? {
          type: 'category',
          data: data.map(d => d.name),
          axisLabel: {
            width: 80,
            overflow: 'truncate',
          },
        }
      : {
          type: 'value',
          name: yAxisLabel || undefined,
          nameLocation: 'middle',
          nameGap: 45,
          axisLabel: {
            formatter: (value: number) => `${value.toLocaleString()}`,
          },
        },
    series: [
      {
        type: 'bar',
        data: data.map((d, i) => ({
          value: d.value,
          itemStyle: { color: colors[i % colors.length] },
        })),
        barWidth: '60%',
        label: {
          show: showLabels,
          position: horizontal ? 'right' : 'top',
          formatter: (params: { dataIndex: number }) => {
            const dataItem = data[params.dataIndex];
            if (showValueLabels) return `${dataItem?.value?.toLocaleString() ?? ''}`;
            return dataItem?.percent !== undefined ? `${dataItem.percent.toFixed(1)}%` : '';
          },
          fontSize: 11,
          color: '#6b7280',
        },
        ...(thresholdLine && thresholdValue != null ? {
          markLine: {
            silent: true,
            data: [{ yAxis: thresholdValue, lineStyle: { color: '#EF4444', type: 'dashed', width: 1.5 }, label: { formatter: `${thresholdValue}` } }],
          },
        } : {}),
      },
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
