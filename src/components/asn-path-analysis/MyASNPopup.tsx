import { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { Modal, Toggle, TimeRangeSelector, ExportDropdown } from '../common';
import { SunburstChart, TimeSeriesChart, BarChart, ChartExportWrapper, type SunburstHighlightPath } from '../charts';
import {
  getSunburstDataForASN,
  routers,
  myAsnExpandedNodes,
  generateTrafficData,
  protocolData,
  topApplications,
} from '../../data/mockData';
import type { SankeyNode, TimeRange } from '../../types';
import styles from './MyASNPopup.module.css';

interface MyASNPopupProps {
  isOpen: boolean;
  onClose: () => void;
  node: SankeyNode | null;
  onCollapse?: (nodeId: string) => void;
  /** IDs of router/interface Sankey nodes currently pinned to show in the diagram */
  routerFilterSelections?: Set<string>;
  onRouterFilterChange?: (nodeId: string, checked: boolean) => void;
}

type TabType = 'routers' | 'traffic';
type TrafficDirection = 'inbound' | 'outbound';

interface TreeItem {
  id: string;
  name: string;
  codeId: string;
  type: 'asn' | 'router' | 'interface';
  trafficGbps: number;
  percent: number;
  /** Sankey node ID for the "pin in diagram" checkbox (routers and interfaces only) */
  sankeyNodeId?: string;
  children?: TreeItem[];
}

export function MyASNPopup({
  isOpen,
  onClose,
  node,
  onCollapse,
  routerFilterSelections = new Set(),
  onRouterFilterChange,
}: MyASNPopupProps) {
  const [activeTab, setActiveTab] = useState<TabType>('routers');
  const [direction, setDirection] = useState<TrafficDirection>('inbound');
  const [unit, setUnit] = useState<'bps' | 'pps'>('bps');
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    preset: '1h',
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date(),
  }));
  const [selectedTreeItem, setSelectedTreeItem] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [treeSearch, setTreeSearch] = useState('');

  // Get sunburst data for this ASN
  const sunburstData = useMemo(() => {
    if (!node) return null;
    return getSunburstDataForASN(node.asnNumber);
  }, [node]);

  // Build tree data with Sankey node IDs for pin checkboxes
  const treeData = useMemo((): TreeItem[] => {
    if (!node) return [];

    const asnRouters = routers.filter(r => r.asnId === node.asnNumber);
    const totalTraffic = asnRouters.reduce(
      (sum, r) => sum + r.interfaces.reduce((s, i) => s + i.trafficGbps, 0),
      0,
    );

    // Build a lookup: routerName → Sankey router node ID
    // and interfaceName+routerName → Sankey interface node ID
    const expandedSubNodes = myAsnExpandedNodes[node.id] ?? [];
    const routerSankeyId: Record<string, string> = {};
    const ifaceSankeyId: Record<string, string> = {};
    for (const sn of expandedSubNodes) {
      if (sn.stage === 'myRouter') {
        routerSankeyId[sn.name] = sn.id;
      } else if (sn.stage === 'myIngressInterface' || sn.stage === 'myEgressInterface') {
        const key = `${sn.routerDisplayName}::${sn.name}`;
        ifaceSankeyId[key] = sn.id;
      }
    }

    return [
      {
        id: `asn-${node.asnNumber}`,
        name: node.name,
        codeId: `AS${node.asnNumber}`,
        type: 'asn',
        trafficGbps: totalTraffic,
        percent: 100,
        children: asnRouters.map((router) => {
          const routerTraffic = router.interfaces.reduce((s, i) => s + i.trafficGbps, 0);
          return {
            id: router.id,
            name: router.name,
            codeId: router.id,
            type: 'router' as const,
            trafficGbps: routerTraffic,
            percent: (routerTraffic / totalTraffic) * 100,
            sankeyNodeId: routerSankeyId[router.name],
            children: router.interfaces.map((iface) => ({
              id: `${router.id}-${iface.id}`,
              name: iface.name,
              codeId: iface.id,
              type: 'interface' as const,
              trafficGbps: iface.trafficGbps,
              percent: iface.trafficPercent,
              sankeyNodeId: ifaceSankeyId[`${router.name}::${iface.name}`],
            })),
          };
        }),
      },
    ];
  }, [node]);

  // Generate traffic data
  const trafficData = useMemo(() => generateTrafficData(24), []);

  // Derive scale factor from selected tree item (router/interface shows proportional traffic)
  const trafficContext = useMemo(() => {
    if (!selectedTreeItem) return { scaleFactor: 1, label: treeData[0]?.name ?? '' };
    const root = treeData[0];
    if (!root) return { scaleFactor: 1, label: '' };
    if (selectedTreeItem === root.id) return { scaleFactor: 1, label: root.name };
    for (const router of root.children ?? []) {
      if (selectedTreeItem === router.id) return { scaleFactor: router.percent / 100, label: router.name };
      for (const iface of router.children ?? []) {
        if (selectedTreeItem === iface.id) return { scaleFactor: iface.percent / 100, label: iface.name };
      }
    }
    return { scaleFactor: 1, label: root.name };
  }, [selectedTreeItem, treeData]);

  // Auto-expand root ASN node when popup opens
  useEffect(() => {
    if (treeData.length > 0) {
      queueMicrotask(() => {
        setExpandedItems(new Set([treeData[0].id]));
        setSelectedTreeItem(null);
      });
    }
  }, [node]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive sunburst highlight path from selected tree item
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const sunburstHighlightPath = useMemo((): SunburstHighlightPath | null => {
    if (!selectedTreeItem) return null;
    const root = treeData[0];
    if (!root?.children) return null;

    // ASN root selected → no specific highlight
    if (selectedTreeItem === root.id) return null;

    for (const router of root.children) {
      if (selectedTreeItem === router.id) {
        return { routerName: router.name };
      }
      if (router.children) {
        for (const iface of router.children) {
          if (selectedTreeItem === iface.id) {
            return { routerName: router.name, interfaceName: iface.name };
          }
        }
      }
    }
    return null;
  }, [selectedTreeItem, treeData]);

  // Handle sunburst click → select tree item + auto-expand parents
  const handleSunburstClick = useCallback((path: SunburstHighlightPath) => {
    const root = treeData[0];
    if (!root?.children) return;

    for (const router of root.children) {
      if (router.name === path.routerName) {
        if (path.interfaceName && router.children) {
          const iface = router.children.find(c => c.name === path.interfaceName);
          if (iface) {
            setSelectedTreeItem(iface.id);
            setExpandedItems(prev => {
              const next = new Set(prev);
              next.add(root.id);
              next.add(router.id);
              return next;
            });
          }
        } else {
          setSelectedTreeItem(router.id);
          setExpandedItems(prev => {
            const next = new Set(prev);
            next.add(root.id);
            return next;
          });
        }
        break;
      }
    }
  }, [treeData]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const renderTreeItem = (item: TreeItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const isSelected = selectedTreeItem === item.id;

    // Filter by search
    if (treeSearch) {
      const matchesSelf = item.name.toLowerCase().includes(treeSearch.toLowerCase());
      const matchesChild = item.children?.some(
        c => c.name.toLowerCase().includes(treeSearch.toLowerCase()) ||
             c.children?.some(gc => gc.name.toLowerCase().includes(treeSearch.toLowerCase()))
      );
      if (!matchesSelf && !matchesChild) return null;
    }

    return (
      <div key={item.id}>
        <div
          className={`${styles.treeItem} ${isSelected ? styles.selected : ''}`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={() => setSelectedTreeItem(item.id)}
        >
          {hasChildren ? (
            <button
              className={styles.expandBtn}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(item.id);
              }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className={styles.expandPlaceholder} />
          )}
          {(item.type === 'router' || item.type === 'interface') && item.sankeyNodeId ? (
            <input
              type="checkbox"
              className={styles.pinCheckbox}
              checked={routerFilterSelections.has(item.sankeyNodeId)}
              title="Pin in Sankey diagram (auto-expands My ASN)"
              onChange={(e) => {
                e.stopPropagation();
                onRouterFilterChange?.(item.sankeyNodeId!, e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={styles.checkboxPlaceholder} />
          )}
          <span className={styles.itemName}>{item.name}</span>
          <span className={styles.itemCodeId}>{item.codeId}</span>
          <span className={styles.itemTraffic}>
            {unit === 'bps' ? item.trafficGbps.toFixed(1) : (item.trafficGbps * 1.2e6).toFixed(0)}
          </span>
          <span className={styles.itemPercent}>{item.percent.toFixed(1)}%</span>
        </div>
        {hasChildren && isExpanded && (
          <div className={styles.treeChildren}>
            {item.children!.map((child) => renderTreeItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'routers':
        return (
          <div className={styles.tabContent}>
            {sunburstData && (
              <ChartExportWrapper filename="routers-interfaces">
                <SunburstChart
                  data={sunburstData}
                  height={660}
                  highlightPath={sunburstHighlightPath}
                  onSegmentClick={handleSunburstClick}
                />
              </ChartExportWrapper>
            )}
          </div>
        );

      case 'traffic': {
        const sf = trafficContext.scaleFactor;
        const timestamps = trafficData.map(d => {
          const date = new Date(d.timestamp);
          return `${date.getHours().toString().padStart(2, '0')}:00`;
        });
        const trafficSeries = [
          { name: 'Inbound', data: trafficData.map(d => parseFloat((d.inbound * sf).toFixed(2))) },
          { name: 'Outbound', data: trafficData.map(d => parseFloat((d.outbound * sf).toFixed(2))) },
          { name: 'Internal', data: trafficData.map(d => parseFloat((d.internal * sf).toFixed(2))) },
          { name: 'Transit', data: trafficData.map(d => parseFloat((d.transit * sf).toFixed(2))) },
        ];
        return (
          <div className={styles.tabContent}>
            <div className={styles.chartSection}>
              <h4 className={styles.chartTitle}>
                Traffic Over Time{trafficContext.label ? ` — ${trafficContext.label}` : ''}
              </h4>
              <ChartExportWrapper filename="traffic-timeseries">
                <TimeSeriesChart
                  dynamicSeries={trafficSeries}
                  timestamps={timestamps}
                  height={320}
                  stacked
                  unit="Gbps"
                />
              </ChartExportWrapper>
            </div>
            <div className={styles.chartSection}>
              <h4 className={styles.chartTitle}>Traffic per Protocol</h4>
              <ChartExportWrapper filename="protocol-traffic">
                <BarChart
                  data={protocolData.map(p => ({
                    name: p.name,
                    value: unit === 'bps' ? (p.bps / 1e9) * sf : p.pps * sf,
                    percent: p.value,
                  }))}
                  height={250}
                  unit={unit === 'bps' ? 'Gbps' : 'pps'}
                />
              </ChartExportWrapper>
            </div>
            <div className={styles.chartSection}>
              <h4 className={styles.chartTitle}>Top 10 Applications</h4>
              <ChartExportWrapper filename="top-applications">
                <BarChart
                  data={topApplications.map(app => ({
                    name: `${app.name}/${app.port}`,
                    value: unit === 'bps' ? (app.trafficBps / 1e9) * sf : (app.trafficBps / 1e6 * 1.2) * sf,
                    percent: app.percent,
                  }))}
                  height={300}
                  unit={unit === 'bps' ? 'Gbps' : 'pps'}
                  horizontal
                />
              </ChartExportWrapper>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (!node) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" showClose={false}>
      <div className={styles.popup}>
        {/* Header */}
        <div className={styles.header}>
          <h2>{node.name} (AS{node.asnNumber})</h2>
          <div className={styles.headerActions}>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
            {onCollapse && node.parentAsnId && (
              <button
                className={styles.collapseBtn}
                onClick={() => onCollapse(node.parentAsnId!)}
                title="Collapse back to ASN node in diagram"
              >
                ◀ Collapse
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Common Controls */}
        <div className={styles.controls}>
          <div className={styles.controlsLeft}>
            <Toggle
              options={[
                { value: 'inbound', label: 'Inbound' },
                { value: 'outbound', label: 'Outbound' },
              ]}
              value={direction}
              onChange={(v) => setDirection(v as TrafficDirection)}
              size="sm"
            />
            <Toggle
              options={[
                { value: 'bps', label: 'Gbps' },
                { value: 'pps', label: 'pps' },
              ]}
              value={unit}
              onChange={(v) => setUnit(v as 'bps' | 'pps')}
              size="sm"
            />
          </div>
          <ExportDropdown />
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Left: Tree */}
          <div className={styles.treePanel}>
            <div className={styles.treeHeader}>
              <div className={styles.searchWrapper}>
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.treeColumnHeaders}>
              <span />
              <span />
              <span>Name</span>
              <span>Code / ID</span>
              <span>{unit === 'bps' ? 'Gbps' : 'pps'}</span>
              <span>%</span>
            </div>
            <div className={styles.treeBody}>
              {treeData.map((item) => renderTreeItem(item))}
            </div>
          </div>

          {/* Right: Tabs & Charts */}
          <div className={styles.chartsPanel}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'routers' ? styles.active : ''}`}
                onClick={() => setActiveTab('routers')}
              >
                Routers & Interfaces
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
