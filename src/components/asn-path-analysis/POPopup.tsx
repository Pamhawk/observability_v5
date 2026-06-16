import { useState, useMemo, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Modal, Toggle, TimeRangeSelector, ExportDropdown } from '../common';
import { TimeSeriesChart, BarChart, ChartExportWrapper } from '../charts';
import {
  generateTrafficData,
  protocolData,
  topApplications,
} from '../../data/mockData';
import type { SankeyNode, TimeRange } from '../../types';
import styles from './POPopup.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  node: SankeyNode | null;
}

interface PrefixItem {
  id: string;
  name: string;
  trafficGbps: number;
  percent: number;
}

type TabType = 'ips' | 'traffic';

const PO_COLORS = [
  '#818CF8', '#6366F1', '#4F46E5', '#A5B4FC',
  '#C7D2FE', '#FB923C', '#F97316', '#FDBA74',
  '#FED7AA', '#FEF3C7',
];

export function POPopup({ isOpen, onClose, node }: Props) {
  const chartRef = useRef<ReactECharts>(null);
  const [activeTab, setActiveTab] = useState<TabType>('ips');
  const [unit, setUnit] = useState<'bps' | 'pps'>('bps');
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    preset: '1h',
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date(),
  }));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Distribute total traffic across prefixes with deterministic pseudo-random weights
  const prefixItems = useMemo((): PrefixItem[] => {
    if (!node?.prefixes?.length) return [];
    const prefixes = node.prefixes;
    const weights = prefixes.map((_, i) => 0.4 + 0.6 * (((i * 17 + 3) % 7) / 6));
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    return prefixes.map((prefix, i) => ({
      id: `prefix-${i}`,
      name: prefix,
      trafficGbps: (node.trafficGbps * weights[i]) / totalWeight,
      percent: (weights[i] / totalWeight) * 100,
    }));
  }, [node]);

  const scaleFactor = useMemo(() => {
    if (!selectedItemId || selectedItemId === 'po-root') return 1;
    const item = prefixItems.find(p => p.id === selectedItemId);
    return item ? item.percent / 100 : 1;
  }, [selectedItemId, prefixItems]);

  const selectedLabel = useMemo(() => {
    if (!selectedItemId || selectedItemId === 'po-root') return node?.name ?? '';
    return prefixItems.find(p => p.id === selectedItemId)?.name ?? node?.name ?? '';
  }, [selectedItemId, prefixItems, node]);

  const trafficData = useMemo(() => generateTrafficData(24), []);

  // Reset selection when PO node changes
  useEffect(() => {
    setSelectedItemId(null);
    setActiveTab('ips');
  }, [node]);

  // Sync sunburst highlight when selection changes from the list
  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    instance.dispatchAction({ type: 'downplay', seriesIndex: 0 });
    if (!selectedItemId || selectedItemId === 'po-root') return;
    const idx = prefixItems.findIndex(p => p.id === selectedItemId);
    if (idx >= 0) {
      instance.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx });
    }
  }, [selectedItemId, prefixItems]);

  const sunburstOption: EChartsOption = useMemo(() => ({
    color: PO_COLORS,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.97)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#1f2937', fontSize: 12 },
      formatter: (params: { data?: { name?: string; value?: number; percent?: number } }) => {
        const d = params.data;
        if (!d) return '';
        return `<div style="font-weight:700;margin-bottom:4px">${d.name}</div>`
          + `<div style="display:flex;justify-content:space-between;gap:20px">`
          + `<span style="color:#6b7280">Traffic</span><strong>${d.value?.toFixed(1)} Gbps</strong></div>`
          + `<div style="display:flex;justify-content:space-between;gap:20px">`
          + `<span style="color:#6b7280">Share</span><strong>${d.percent?.toFixed(1)}%</strong></div>`;
      },
    },
    series: [{
      type: 'sunburst',
      data: prefixItems.map(p => ({ name: p.name, value: p.trafficGbps, percent: p.percent })),
      radius: ['22%', '85%'],
      center: ['50%', '50%'],
      nodeClick: false as const,
      emphasis: { focus: 'self' },
      levels: [
        {},
        {
          r0: '22%', r: '85%',
          itemStyle: { borderWidth: 3, borderColor: '#fff', borderRadius: 6 },
          label: { fontSize: 12, color: '#1f2937', minAngle: 10 },
          emphasis: { itemStyle: { shadowBlur: 14, shadowColor: 'rgba(0,0,0,0.2)' } },
        },
      ],
      itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
      label: { show: true, formatter: '{b}' },
      animationType: 'expansion',
      animationDuration: 800,
    }],
    graphic: [],
  }), [prefixItems]);

  const sunburstEvents = useMemo(() => ({
    click: (params: { dataIndex?: number }) => {
      if (params.dataIndex === undefined) {
        setSelectedItemId('po-root');
      } else {
        const item = prefixItems[params.dataIndex];
        if (item) {
          setSelectedItemId(prev => prev === item.id ? 'po-root' : item.id);
        }
      }
    },
  }), [prefixItems]);

  if (!node) return null;

  const sf = scaleFactor;
  const timestamps = trafficData.map(d => {
    const date = new Date(d.timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:00`;
  });
  const trafficSeries = [
    { name: 'Inbound',  data: trafficData.map(d => parseFloat((d.inbound  * sf).toFixed(2))) },
    { name: 'Outbound', data: trafficData.map(d => parseFloat((d.outbound * sf).toFixed(2))) },
    { name: 'Internal', data: trafficData.map(d => parseFloat((d.internal * sf).toFixed(2))) },
    { name: 'Transit',  data: trafficData.map(d => parseFloat((d.transit  * sf).toFixed(2))) },
  ];

  const renderTabContent = () => {
    if (activeTab === 'ips') {
      return (
        <div className={styles.tabContent}>
          <div className={styles.sunburstWrapper}>
            <ReactECharts
              ref={chartRef}
              option={sunburstOption}
              notMerge
              style={{ height: 480, width: '100%' }}
              opts={{ renderer: 'svg' }}
              onEvents={sunburstEvents}
            />
            <div className={styles.sunburstCenter}>
              <span className={styles.sunburstCenterName}>{node.name}</span>
              <span className={styles.sunburstCenterGbps}>{node.trafficGbps.toFixed(1)} Gbps</span>
              <span className={styles.sunburstCenterSub}>{prefixItems.length} prefix{prefixItems.length !== 1 ? 'es' : ''}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.tabContent}>
        <div className={styles.chartSection}>
          <h4 className={styles.chartTitle}>
            Traffic Over Time{selectedLabel ? ` — ${selectedLabel}` : ''}
          </h4>
          <ChartExportWrapper filename="po-traffic-timeseries">
            <TimeSeriesChart
              dynamicSeries={trafficSeries}
              timestamps={timestamps}
              height={280}
              stacked
              unit="Gbps"
            />
          </ChartExportWrapper>
        </div>
        <div className={styles.chartSection}>
          <h4 className={styles.chartTitle}>Traffic per Protocol</h4>
          <ChartExportWrapper filename="po-protocol-traffic">
            <BarChart
              data={protocolData.map(p => ({
                name: p.name,
                value: unit === 'bps' ? (p.bps / 1e9) * sf : p.pps * sf,
                percent: p.value,
              }))}
              height={200}
              unit={unit === 'bps' ? 'Gbps' : 'pps'}
            />
          </ChartExportWrapper>
        </div>
        <div className={styles.chartSection}>
          <h4 className={styles.chartTitle}>Top Applications</h4>
          <ChartExportWrapper filename="po-top-applications">
            <BarChart
              data={topApplications.map(app => ({
                name: `${app.name}/${app.port}`,
                value: unit === 'bps'
                  ? (app.trafficBps / 1e9) * sf
                  : (app.trafficBps / 1e6 * 1.2) * sf,
                percent: app.percent,
              }))}
              height={260}
              unit={unit === 'bps' ? 'Gbps' : 'pps'}
              horizontal
            />
          </ChartExportWrapper>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" showClose={false}>
      <div className={styles.popup}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <h2>{node.name}</h2>
            <span className={styles.headerBadge}>Protected Object</span>
          </div>
          <div className={styles.headerActions}>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.controlsLeft}>
            <Toggle
              options={[
                { value: 'bps', label: 'Gbps' },
                { value: 'pps', label: 'pps' },
              ]}
              value={unit}
              onChange={v => setUnit(v as 'bps' | 'pps')}
              size="sm"
            />
          </div>
          <ExportDropdown />
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Left: prefix list */}
          <div className={styles.treePanel}>
            <div className={styles.treeColumnHeaders}>
              <span />
              <span>Prefix</span>
              <span>{unit === 'bps' ? 'Gbps' : 'pps'}</span>
              <span>%</span>
            </div>
            <div className={styles.treeBody}>
              {/* Root "All" row */}
              <div
                className={`${styles.treeItem} ${(!selectedItemId || selectedItemId === 'po-root') ? styles.selected : ''}`}
                style={{ paddingLeft: '12px' }}
                onClick={() => setSelectedItemId('po-root')}
              >
                <span className={styles.expandPlaceholder} />
                <span className={`${styles.itemName} ${styles.itemNameRoot}`}>{node.name}</span>
                <span className={styles.itemTraffic}>
                  {unit === 'bps'
                    ? node.trafficGbps.toFixed(1)
                    : (node.trafficGbps * 1.2e6).toFixed(0)}
                </span>
                <span className={styles.itemPercent}>100.0%</span>
              </div>
              {prefixItems.map(item => {
                const isSelected = selectedItemId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`${styles.treeItem} ${isSelected ? styles.selected : ''}`}
                    style={{ paddingLeft: '28px' }}
                    onClick={() => setSelectedItemId(isSelected ? 'po-root' : item.id)}
                  >
                    <span className={styles.expandPlaceholder} />
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemTraffic}>
                      {unit === 'bps'
                        ? item.trafficGbps.toFixed(1)
                        : (item.trafficGbps * 1.2e6).toFixed(0)}
                    </span>
                    <span className={styles.itemPercent}>{item.percent.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: tabs + content */}
          <div className={styles.chartsPanel}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'ips' ? styles.active : ''}`}
                onClick={() => setActiveTab('ips')}
              >
                IPs
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'traffic' ? styles.active : ''}`}
                onClick={() => setActiveTab('traffic')}
              >
                Traffic
              </button>
            </div>
            {renderTabContent()}
          </div>
        </div>
      </div>
    </Modal>
  );
}
