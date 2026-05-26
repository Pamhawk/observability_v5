import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

interface HeatmapChartProps {
  xLabels?: string[];
  yLabels?: string[];
  data?: number[][];  // [xIndex, yIndex, value]
  height?: number;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xSort?: 'asc' | 'desc' | 'none';
  ySort?: 'asc' | 'desc' | 'none';
}

const defaultXLabels = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
const defaultYLabels = ['AS13335', 'AS16509', 'AS9009', 'AS57695', 'AS398101'];

function generateDefaultData(): number[][] {
  const data: number[][] = [];
  for (let y = 0; y < defaultYLabels.length; y++) {
    for (let x = 0; x < defaultXLabels.length; x++) {
      data.push([x, y, Math.round(Math.random() * 100)]);
    }
  }
  return data;
}

export function HeatmapChart({
  xLabels: xLabelsRaw = defaultXLabels,
  yLabels: yLabelsRaw = defaultYLabels,
  data = generateDefaultData(),
  height = 280,
  xAxisLabel,
  yAxisLabel,
  xSort,
  ySort,
}: HeatmapChartProps) {
  // Apply optional sorting to labels (rebuild index maps accordingly)
  const sortLabels = (labels: string[], sort?: 'asc' | 'desc' | 'none') => {
    if (!sort || sort === 'none') return labels;
    return [...labels].sort((a, b) => sort === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
  };
  const xLabels = sortLabels(xLabelsRaw, xSort);
  const yLabels = sortLabels(yLabelsRaw, ySort);

  // Remap data indices if labels were reordered
  const xIndexMap = new Map(xLabels.map((l, i) => [l, i]));
  const yIndexMap = new Map(yLabels.map((l, i) => [l, i]));
  const remappedData = data.map(([xi, yi, v]) => [
    xIndexMap.get(xLabelsRaw[xi]) ?? xi,
    yIndexMap.get(yLabelsRaw[yi]) ?? yi,
    v,
  ]);

  const option: EChartsOption = {
    tooltip: {
      position: 'top',
      formatter: (params: any) => {
        return `<strong>${yLabels[params.value[1]]}</strong> at <strong>${xLabels[params.value[0]]}</strong><br/>Flows: ${params.value[2]}`;
      },
    },
    grid: {
      left: 90,
      right: 40,
      top: 10,
      bottom: 40,
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      name: xAxisLabel || undefined,
      nameLocation: 'middle',
      nameGap: 30,
      splitArea: { show: true },
      axisLabel: { fontSize: 11, color: '#6b7280' },
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      name: yAxisLabel || undefined,
      nameLocation: 'middle',
      nameGap: 70,
      splitArea: { show: true },
      axisLabel: { fontSize: 11, color: '#6b7280', width: 80, overflow: 'truncate' },
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      show: false,
      inRange: {
        color: ['#4575b4', '#91bfdb', '#e0f3f8', '#fee090', '#fc8d59', '#d73027'],
      },
    },
    series: [
      {
        type: 'heatmap',
        data: remappedData,
        label: {
          show: false,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 6,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
        },
        itemStyle: {
          borderWidth: 2,
          borderColor: 'var(--color-bg-card)',
          borderRadius: 3,
        },
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
