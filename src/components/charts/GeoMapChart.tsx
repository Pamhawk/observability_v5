import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { useEffect, useState } from 'react';
import type { EChartsOption } from 'echarts';

interface GeoMapData {
  name: string;
  value: number;
}

interface GeoMapChartProps {
  data?: GeoMapData[];
  height?: number;
}

// ECharts v4 world map — proper GeoJSON, no conversion needed
const WORLD_MAP_URL = 'https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json';

// Map our display names → ECharts v4 world map feature names
const NAME_TO_ECHARTS: Record<string, string> = {
  'United States': 'United States of America',
  'Russia': 'Russia',
  'South Korea': 'Korea',
  'North Korea': 'Dem. Rep. Korea',
  'United Kingdom': 'United Kingdom',
  'Czech Republic': 'Czech Rep.',
  'Dominican Republic': 'Dominican Rep.',
  'Bosnia and Herzegovina': 'Bosnia and Herz.',
  'Central African Republic': 'Central African Rep.',
  'Dem. Rep. Congo': 'Dem. Rep. Congo',
  'Ivory Coast': "Côte d'Ivoire",
  'Eswatini': 'Swaziland',
};

const defaultData: GeoMapData[] = [
  { name: 'China', value: 42 },
  { name: 'United States', value: 38 },
  { name: 'Russia', value: 28 },
  { name: 'Brazil', value: 22 },
  { name: 'Germany', value: 18 },
  { name: 'India', value: 15 },
  { name: 'France', value: 12 },
  { name: 'United Kingdom', value: 10 },
  { name: 'Japan', value: 9 },
  { name: 'South Korea', value: 8 },
  { name: 'Netherlands', value: 7 },
  { name: 'Ukraine', value: 6 },
  { name: 'Indonesia', value: 5 },
  { name: 'Vietnam', value: 4 },
  { name: 'Turkey', value: 3 },
];

// Build reverse map (ECharts name → our display name) for tooltips
const ECHARTS_TO_NAME: Record<string, string> = {};
for (const [ours, theirs] of Object.entries(NAME_TO_ECHARTS)) {
  ECHARTS_TO_NAME[theirs] = ours;
}

function mapDataToECharts(data: GeoMapData[]): GeoMapData[] {
  return data.map(d => ({
    name: NAME_TO_ECHARTS[d.name] || d.name,
    value: d.value,
  }));
}

export function GeoMapChart({ data = defaultData, height = 280 }: GeoMapChartProps) {
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    if (echarts.getMap('world')) {
      queueMicrotask(() => setMapReady(true));
      return;
    }

    fetch(WORLD_MAP_URL)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch map');
        return res.json();
      })
      .then(geoJson => {
        echarts.registerMap('world', geoJson);
        setMapReady(true);
      })
      .catch(() => {
        setMapFailed(true);
      });
  }, []);

  if (mapFailed) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Unable to load world map
      </div>
    );
  }

  if (!mapReady) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Loading map...
      </div>
    );
  }

  const echartsData = mapDataToECharts(data);
  const maxVal = Math.max(...data.map(d => d.value), 10);

  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const displayName = ECHARTS_TO_NAME[params.name] || params.name;
        if (params.value) {
          return `<div style="font-weight:600;margin-bottom:4px;">${displayName}</div>
            <div>Traffic: <strong>${params.value.toFixed(1)} Gbps</strong></div>`;
        }
        return `<strong>${displayName}</strong>`;
      },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      text: ['High', 'Low'],
      realtime: false,
      calculable: false,
      inRange: {
        color: ['#4575b4', '#91bfdb', '#e0f3f8', '#fee090', '#fc8d59', '#d73027'],
      },
      textStyle: { color: '#6b7280', fontSize: 11 },
      left: 16,
      bottom: 16,
      itemWidth: 14,
      itemHeight: 100,
    },
    geo: {
      map: 'world',
      roam: true,
      scaleLimit: { min: 1, max: 8 },
      zoom: 1.2,
      center: [10, 20],
      itemStyle: {
        areaColor: '#f1f5f9',
        borderColor: '#cbd5e1',
        borderWidth: 0.5,
      },
      emphasis: {
        itemStyle: {
          areaColor: '#fde68a',
          borderColor: '#d97706',
          borderWidth: 1,
        },
        label: {
          show: true,
          fontSize: 11,
          color: '#0f172a',
        },
      },
      select: {
        itemStyle: {
          areaColor: '#fbbf24',
        },
      },
      silent: false,
    },
    series: [
      {
        type: 'map',
        map: 'world',
        geoIndex: 0,
        data: echartsData,
      },
    ] as any,
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
