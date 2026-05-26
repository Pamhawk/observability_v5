import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

interface PieChartData {
  name: string;
  value: number;
}

interface PieChartProps {
  data: PieChartData[];
  height?: number;
  showLegend?: boolean;
  donut?: boolean;
  total?: number;
  colors?: string[];
  labelFormat?: 'value' | 'percentage' | 'both';
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
];

export function PieChart({
  data,
  height = 300,
  showLegend = true,
  donut = false,
  total: totalProp,
  colors = defaultColors,
  labelFormat,
  showValueLabels,
}: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Format the total for donut center display
  const formatTotal = (val: number): string => {
    if (val >= 1e9) return `${(val / 1e9).toFixed(1)}G`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
    return val.toLocaleString();
  };

  const centerX = showLegend ? '35%' : '50%';

  const option: EChartsOption = {
    ...(donut && totalProp != null ? {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      graphic: ([{
        type: 'group',
        left: centerX,
        top: 'center',
        children: [
          {
            type: 'text',
            style: {
              text: formatTotal(totalProp),
              fontSize: 22,
              fontWeight: 'bold',
              fill: '#1a1a2e',
              x: 0,
            },
          },
          {
            type: 'text',
            style: {
              text: 'Total',
              fontSize: 11,
              fill: '#6b7280',
              x: 0,
              y: 24,
            },
          },
        ],
      }] as any),
    } : {}),
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `
          <div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
          <div>Value: <strong>${params.value.toLocaleString()}</strong></div>
          <div>Percent: <strong>${params.percent.toFixed(1)}%</strong></div>
        `;
      },
    },
    legend: {
      show: showLegend,
      orient: 'vertical',
      right: 10,
      top: 'center',
      formatter: (name: string) => {
        const item = data.find(d => d.name === name);
        if (item) {
          const percent = ((item.value / total) * 100).toFixed(1);
          return `${name} (${percent}%)`;
        }
        return name;
      },
    },
    color: colors,
    series: [
      {
        type: 'pie',
        radius: donut ? ['45%', '70%'] : '70%',
        center: showLegend ? ['35%', '50%'] : ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: showValueLabels ?? !showLegend,
          formatter: labelFormat === 'value' ? '{b}: {c}' : labelFormat === 'both' ? '{b}: {c} ({d}%)' : '{b}: {d}%',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
          },
        },
        data: data.map((d, i) => ({
          value: d.value,
          name: d.name,
          itemStyle: { color: colors[i % colors.length] },
        })),
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
