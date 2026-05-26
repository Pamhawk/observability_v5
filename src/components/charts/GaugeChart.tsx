import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

interface GaugeChartProps {
  value: number;
  min?: number;
  max?: number;
  thresholds?: [number, number]; // [green→yellow, yellow→red]
  label?: string;
  unit?: string;
  height?: number;
}

export function GaugeChart({
  value,
  min = 0,
  max = 100,
  thresholds = [60, 85],
  label = '',
  unit,
  height = 280,
}: GaugeChartProps) {
  const range = max - min;
  const greenEnd = (thresholds[0] - min) / range;
  const yellowEnd = (thresholds[1] - min) / range;

  const option: EChartsOption = {
    series: [
      {
        type: 'gauge',
        min,
        max,
        startAngle: 200,
        endAngle: -20,
        axisLine: {
          lineStyle: {
            width: 20,
            color: [
              [greenEnd, '#10B981'],
              [yellowEnd, '#F59E0B'],
              [1, '#EF4444'],
            ],
          },
        },
        pointer: {
          length: '60%',
          width: 5,
          itemStyle: {
            color: 'var(--color-text-primary)',
          },
        },
        axisTick: {
          distance: -20,
          length: 6,
          lineStyle: { color: '#999', width: 1 },
        },
        splitLine: {
          distance: -22,
          length: 12,
          lineStyle: { color: '#999', width: 1.5 },
        },
        axisLabel: {
          distance: 28,
          fontSize: 11,
          color: '#6b7280',
        },
        detail: {
          valueAnimation: true,
          formatter: unit ? `{value} ${unit}` : `{value}%`,
          fontSize: 28,
          fontWeight: 'bold',
          offsetCenter: [0, '40%'],
          color: '#1f2937',
        },
        title: {
          show: !!label,
          offsetCenter: [0, '65%'],
          fontSize: 13,
          color: '#6b7280',
        },
        data: [{ value, name: label }],
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
