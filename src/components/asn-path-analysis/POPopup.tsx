import { useState, useMemo, useEffect } from 'react';
import { X, Search, ChevronRight, ChevronDown } from 'lucide-react';
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

export function POPopup({ isOpen, onClose, node }: Props) {
  const [unit, setUnit] = useState<'bps' | 'pps'>('bps');
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    preset: '1h',
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date(),
  }));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [rootExpanded, setRootExpanded] = useState(true);
  const [treeSearch, setTreeSearch] = useState('');

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

  // Scale factor from selected tree item
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

  // Reset selection when the PO node changes
  useEffect(() => {
    setSelectedItemId(null);
    setTreeSearch('');
    setRootExpanded(true);
  }, [node]);

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

  const rootSelected = !selectedItemId || selectedItemId === 'po-root';
  const rootMatchesSearch = !treeSearch || node.name.toLowerCase().includes(treeSearch.toLowerCase());
  const anyPrefixMatchesSearch = prefixItems.some(p => p.name.toLowerCase().includes(treeSearch.toLowerCase()));
  const showRoot = !treeSearch || rootMatchesSearch || anyPrefixMatchesSearch;

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
          {/* Left: IP prefix tree */}
          <div className={styles.treePanel}>
            <div className={styles.treeHeader}>
              <div className={styles.searchWrapper}>
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search prefixes..."
                  value={treeSearch}
                  onChange={e => setTreeSearch(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.treeColumnHeaders}>
              <span />
              <span>Prefix / Name</span>
              <span>{unit === 'bps' ? 'Gbps' : 'pps'}</span>
              <span>%</span>
            </div>
            <div className={styles.treeBody}>
              {showRoot && (
                <>
                  {/* Root row — the PO itself */}
                  <div
                    className={`${styles.treeItem} ${rootSelected ? styles.selected : ''}`}
                    style={{ paddingLeft: '12px' }}
                    onClick={() => setSelectedItemId('po-root')}
                  >
                    <button
                      className={styles.expandBtn}
                      onClick={e => { e.stopPropagation(); setRootExpanded(v => !v); }}
                    >
                      {rootExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <span className={`${styles.itemName} ${styles.itemNameRoot}`}>{node.name}</span>
                    <span className={styles.itemTraffic}>
                      {unit === 'bps'
                        ? node.trafficGbps.toFixed(1)
                        : (node.trafficGbps * 1.2e6).toFixed(0)}
                    </span>
                    <span className={styles.itemPercent}>100.0%</span>
                  </div>

                  {/* Prefix leaves */}
                  {rootExpanded && prefixItems.map(item => {
                    const matchesSearch = !treeSearch || item.name.toLowerCase().includes(treeSearch.toLowerCase());
                    if (!matchesSearch) return null;
                    const isSelected = selectedItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`${styles.treeItem} ${isSelected ? styles.selected : ''}`}
                        style={{ paddingLeft: '32px' }}
                        onClick={() => setSelectedItemId(item.id)}
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
                </>
              )}
            </div>
          </div>

          {/* Right: Charts */}
          <div className={styles.chartsPanel}>
            <div className={styles.chartsPanelContent}>
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
          </div>
        </div>
      </div>
    </Modal>
  );
}
