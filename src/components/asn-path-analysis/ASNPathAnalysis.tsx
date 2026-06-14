import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Camera } from 'lucide-react';
import { Card, TimeRangeSelector, ExportDropdown } from '../common';
import { SankeyDiagram } from '../charts';
import { StageFilters } from './StageFilters';
import { CustomViewBuilder } from './CustomViewBuilder';
import { MyASNPopup } from './MyASNPopup';
import { FlowPopup } from './FlowPopup';
import { ASNPathTable } from './ASNPathTable';
import {
  sankeyNodes,
  myAsnExpandedNodes,
  originToPrevLinks,
  originToUpstreamPOLinks,
  prevToUpstreamPOLinks,
  prevToMyAsnDirectLinks,
  upstreamPOToMyAsnLinks,
  myAsnToDownstreamPOLinks,
  myAsnToNextDirectLinks,
  downstreamPOToNextLinks,
  downstreamPOToDestLinks,
  nextToDestLinks,
  myAsnExpandedLinks,
  defaultStageFilters,
  inboundStageFilters,
  outboundStageFilters,
} from '../../data/mockData';
import type { SankeyNode, SankeyLink, StageFilter, TimeRange, SankeyStage, TrafficView, CustomViewConfig } from '../../types';
import styles from './ASNPathAnalysis.module.css';

// My ASN sub-stages: visibility follows myASN filter
const MY_ASN_SUB_STAGES = new Set(['myIngressInterface', 'myRouter']);

// Static node-id → stage map built once from all mock data (used for semantic link guards).
// Covers collapsed nodes, expanded sub-nodes, and PO nodes.
const NODE_STAGE: Map<string, string> = new Map([
  ...sankeyNodes.map(n => [n.id, n.stage] as [string, string]),
  ...Object.values(myAsnExpandedNodes).flat().map(n => [n.id, n.stage] as [string, string]),
]);

// All independently-controlled stages (for filter dropdowns)
const INDEPENDENT_STAGES: SankeyStage[] = [
  'originASN', 'previousPeer', 'upstreamPO', 'myASN', 'downstreamPO', 'nextPeer', 'destinationASN',
];

// Per-view stage sequences for dynamic depth mapping (excludes 'custom' which is derived at runtime)
type StandardView = 'networkTransit' | 'inboundTraffic' | 'outboundTraffic';

const VIEW_COMPACT_ORDER: Record<StandardView, SankeyStage[]> = {
  networkTransit: ['originASN', 'previousPeer', 'upstreamPO', 'myASN', 'downstreamPO', 'nextPeer', 'destinationASN'],
  inboundTraffic: ['upstreamPO', 'myASN', 'nextPeer', 'destinationASN'],
  outboundTraffic: ['originASN', 'previousPeer', 'upstreamPO', 'myASN', 'downstreamPO'],
};

const VIEW_EXPANDED_ORDER: Record<StandardView, SankeyStage[]> = {
  networkTransit: ['originASN', 'previousPeer', 'upstreamPO', 'myIngressInterface', 'myRouter', 'downstreamPO', 'nextPeer', 'destinationASN'],
  inboundTraffic: ['upstreamPO', 'myIngressInterface', 'myRouter', 'nextPeer', 'destinationASN'],
  outboundTraffic: ['originASN', 'previousPeer', 'myIngressInterface', 'myRouter', 'downstreamPO'],
};

// PO stages only get a column when at least one node of that stage is actually present.
// Without this guard, enabled-but-empty PO columns still get a depth slot, and ECharts
// distributes all column widths evenly (including the empty ones), creating visual gaps.
const PO_STAGES = new Set<string>(['upstreamPO', 'downstreamPO']);

function computeDynamicDepths(
  view: TrafficView,
  enabledStages: Set<string>,
  anyExpanded: boolean,
  presentStages: Set<string>,
  customOrders?: { compact: SankeyStage[], expanded: SankeyStage[] },
): Record<string, number> {
  const seq = view === 'custom'
    ? (anyExpanded ? (customOrders?.expanded ?? []) : (customOrders?.compact ?? []))
    : (anyExpanded ? VIEW_EXPANDED_ORDER[view as StandardView] : VIEW_COMPACT_ORDER[view as StandardView]);
  const depths: Record<string, number> = {};
  let d = 0;
  for (const stage of seq) {
    const active = MY_ASN_SUB_STAGES.has(stage)
      ? enabledStages.has('myASN')
      : enabledStages.has(stage);
    // For PO stages, only allocate a column when there are actual nodes to fill it
    const columned = active && (!PO_STAGES.has(stage) || presentStages.has(stage));
    if (columned) depths[stage] = d++;
  }
  // Collapsed myASN nodes sit at same column as myIngressInterface when expanded
  if (anyExpanded) {
    depths['myASN'] = depths['myIngressInterface'] ?? depths['myRouter'] ?? 0;
  }
  return depths;
}

// Bridge links: eliminate hidden-stage nodes by creating transitive connections
function buildBridgedLinks(
  links: SankeyLink[],
  hiddenNodeIds: Set<string>,
): SankeyLink[] {
  if (hiddenNodeIds.size === 0) return links;

  let current = [...links];

  // Iterate until no hidden nodes remain in the link list
  let changed = true;
  while (changed) {
    changed = false;
    for (const hiddenId of hiddenNodeIds) {
      const inLinks  = current.filter(l => l.target === hiddenId);
      const outLinks = current.filter(l => l.source === hiddenId);
      if (inLinks.length === 0 && outLinks.length === 0) continue;
      changed = true;

      const totalOut = outLinks.reduce((s, l) => s + l.value, 0);
      const bridges: SankeyLink[] = [];

      if (inLinks.length > 0 && outLinks.length > 0 && totalOut > 0) {
        // Middle node: distribute each input proportionally across outputs
        for (const inL of inLinks) {
          for (const outL of outLinks) {
            const v = inL.value * (outL.value / totalOut);
            if (v > 0.05) {
              bridges.push({
                source: inL.source,
                target: outL.target,
                value: Math.round(v * 10) / 10,
                trafficGbps: Math.round(v * 10) / 10,
                topProtocol: outL.topProtocol,
                topApplication: outL.topApplication,
              });
            }
          }
        }
      }
      // Source or sink hidden nodes: just drop their links (no bridge)
      current = current.filter(l => l.source !== hiddenId && l.target !== hiddenId);
      current.push(...bridges);
    }
  }

  // Merge duplicate links (same source→target pair)
  const merged = new Map<string, SankeyLink>();
  for (const link of current) {
    const key = `${link.source}→${link.target}`;
    const ex = merged.get(key);
    if (ex) {
      merged.set(key, {
        ...ex,
        value: Math.round((ex.value + link.value) * 10) / 10,
        trafficGbps: Math.round((ex.trafficGbps + link.trafficGbps) * 10) / 10,
      });
    } else {
      merged.set(key, link);
    }
  }
  return Array.from(merged.values());
}

const VIEW_LABELS: Record<TrafficView, string> = {
  networkTransit:  'Network Transit',
  inboundTraffic:  'Inbound Traffic',
  outboundTraffic: 'Outbound Traffic',
  custom:          'Custom',
};

const VIEW_FILTERS: Record<StandardView, StageFilter[]> = {
  networkTransit:  defaultStageFilters,
  inboundTraffic:  inboundStageFilters,
  outboundTraffic: outboundStageFilters,
};

const CUSTOM_STAGE_COLORS: Record<SankeyStage, string> = {
  originASN: '#F97316', previousPeer: '#9333EA', upstreamPO: '#818CF8',
  myASN: '#14B8A6', myIngressInterface: '#99F6E4', myRouter: '#0E9F8E',
  downstreamPO: '#FB923C', nextPeer: '#9333EA', destinationASN: '#EC4899',
};
const CUSTOM_STAGE_LABELS: Partial<Record<SankeyStage, string>> = {
  originASN: 'Origin', previousPeer: 'Previous Peer', upstreamPO: 'Upstream PO',
  myASN: 'My ASN', downstreamPO: 'Downstream PO', nextPeer: 'Next Peer',
  destinationASN: 'Destination',
};
// Canonical filter order for custom view (ingress/router are not stageFilters — handled via forceExpanded)
const CUSTOM_FILTER_ORDER: SankeyStage[] = [
  'originASN', 'previousPeer', 'upstreamPO', 'myASN', 'downstreamPO', 'nextPeer', 'destinationASN',
];
function buildCustomStageFilters(selectedColumns: Set<SankeyStage>): StageFilter[] {
  return CUSTOM_FILTER_ORDER
    .filter(s => selectedColumns.has(s))
    .map(s => ({
      stage: s,
      label: CUSTOM_STAGE_LABELS[s] ?? s,
      color: CUSTOM_STAGE_COLORS[s] ?? '#999',
      enabled: true,
      selectedASNs: [],
    }));
}

const DEFAULT_CUSTOM_COLUMNS: Set<SankeyStage> = new Set([
  'originASN', 'previousPeer', 'myASN', 'nextPeer', 'destinationASN',
]);

export function ASNPathAnalysis() {
  const [trafficView, setTrafficView] = useState<TrafficView>('networkTransit');
  const [customViewConfig, setCustomViewConfig] = useState<CustomViewConfig>({
    name: 'My Custom View',
    selectedColumns: DEFAULT_CUSTOM_COLUMNS,
  });
  const [stageFilters, setStageFilters] = useState<StageFilter[]>(defaultStageFilters);
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    preset: '1h',
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date(),
  }));
  const [selectedNode, setSelectedNode] = useState<SankeyNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<SankeyLink | null>(null);

  // Which My ASN nodes are manually expanded (icon click)
  const [expandedASNs, setExpandedASNs] = useState<Set<string>>(new Set());
  // Which router/interface node IDs are "pinned" from the My ASN popup checkbox
  const [routerFilterSelections, setRouterFilterSelections] = useState<Set<string>>(new Set());

  // All expandable My ASN node IDs (static)
  const allExpandableASNIds = useMemo(
    () => sankeyNodes.filter(n => n.stage === 'myASN' && n.expandable).map(n => n.id),
    [],
  );

  // Reset filters and expansion when view changes
  useEffect(() => {
    if (trafficView !== 'custom') {
      setStageFilters(VIEW_FILTERS[trafficView]);
    } else {
      setStageFilters(buildCustomStageFilters(customViewConfig.selectedColumns));
    }
    setExpandedASNs(new Set());
    setRouterFilterSelections(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trafficView]);

  // Rebuild stageFilters when custom columns change (without resetting expanded state)
  useEffect(() => {
    if (trafficView === 'custom') {
      setStageFilters(buildCustomStageFilters(customViewConfig.selectedColumns));
    }
  }, [customViewConfig, trafficView]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStageToggle = useCallback((stage: string) => {
    const enabledCount = stageFilters.filter(f => f.enabled).length;
    const target = stageFilters.find(f => f.stage === stage);
    if (target?.enabled && enabledCount <= 2) return; // enforce minimum 2
    setStageFilters(prev => prev.map(f =>
      f.stage === stage ? { ...f, enabled: !f.enabled } : f,
    ));
  }, [stageFilters]);

  const handleToggleMyASNExpand = useCallback((nodeId: string) => {
    setExpandedASNs(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpandedASNs(new Set(allExpandableASNIds));
  }, [allExpandableASNIds]);

  const handleCollapseAll = useCallback(() => {
    setExpandedASNs(new Set());
    setRouterFilterSelections(new Set());
  }, []);

  // ALL node clicks open the popup (expand/collapse is icon-only)
  const handleNodeClick = useCallback((node: SankeyNode) => {
    setSelectedNode(node);
  }, []);

  const handleLinkClick = useCallback((link: SankeyLink) => {
    setSelectedLink(link);
  }, []);

  const handleRouterFilterChange = useCallback((nodeId: string, checked: boolean) => {
    setRouterFilterSelections(prev => {
      const next = new Set(prev);
      if (checked) next.add(nodeId); else next.delete(nodeId);
      return next;
    });
  }, []);

  // ── Build Sankey data ──────────────────────────────────────────────────────
  const computedSankeyData = useMemo(() => {
    const enabledStages = new Set(stageFilters.filter(f => f.enabled).map(f => f.stage));
    const stageOn = (s: string) => enabledStages.has(s);
    const view = trafficView;

    // Custom view: ingress/router selected → force all My ASN nodes to always be expanded
    const cols = customViewConfig.selectedColumns;
    const forceExpanded = view === 'custom' && (cols.has('myIngressInterface') || cols.has('myRouter'));

    // A My ASN is expanded if manually expanded OR any of its sub-nodes are pinned
    const isMyAsnExpanded = (asnNodeId: string): boolean => {
      if (expandedASNs.has(asnNodeId)) return true;
      return (myAsnExpandedNodes[asnNodeId] ?? []).some(n => routerFilterSelections.has(n.id));
    };

    const passesFilter = (node: SankeyNode): boolean => {
      const f = stageFilters.find(x => x.stage === node.stage);
      if (f && f.selectedASNs.length > 0) return f.selectedASNs.includes(node.asnNumber);
      return true;
    };

    // ── Nodes — two-pass ────────────────────────────────────────────────────
    const nodes: SankeyNode[] = [];
    const visibleMyAsnNumbers = new Set<number>();

    // Pass 1: build non-PO nodes
    for (const node of sankeyNodes) {
      if (node.stage === 'upstreamPO' || node.stage === 'downstreamPO') continue;

      // Sub-stages and myASN itself: enabled by myASN filter OR by forceExpanded
      const isMyAsnRelated = node.stage === 'myASN' || MY_ASN_SUB_STAGES.has(node.stage);
      const stageEnabled = isMyAsnRelated
        ? (stageOn('myASN') || forceExpanded)
        : stageOn(node.stage);
      if (!stageEnabled) continue;
      if (!passesFilter(node)) continue;

      if (node.stage === 'myASN') {
        visibleMyAsnNumbers.add(node.asnNumber);
        if (isMyAsnExpanded(node.id) || forceExpanded) {
          nodes.push(...(myAsnExpandedNodes[node.id] ?? []));
        } else {
          nodes.push(node);
        }
      } else {
        nodes.push(node);
      }
    }

    // Pass 2: add PO nodes only for visible My ASNs
    if (stageOn('upstreamPO')) {
      for (const node of sankeyNodes) {
        if (node.stage === 'upstreamPO' && visibleMyAsnNumbers.has(node.asnNumber)) {
          nodes.push(node);
        }
      }
    }
    if (stageOn('downstreamPO')) {
      for (const node of sankeyNodes) {
        if (node.stage === 'downstreamPO' && visibleMyAsnNumbers.has(node.asnNumber)) {
          nodes.push(node);
        }
      }
    }

    // ── Links — view-specific pools ────────────────────────────────────────
    const allLinks: SankeyLink[] = [];

    if (view === 'networkTransit') {
      allLinks.push(...originToPrevLinks);
      allLinks.push(...prevToUpstreamPOLinks);
      allLinks.push(...originToUpstreamPOLinks);
      allLinks.push(...prevToMyAsnDirectLinks);
      allLinks.push(...myAsnToNextDirectLinks);
      allLinks.push(...downstreamPOToNextLinks);
      allLinks.push(...downstreamPOToDestLinks);
      allLinks.push(...nextToDestLinks);
    } else if (view === 'inboundTraffic') {
      allLinks.push(...myAsnToNextDirectLinks);
      allLinks.push(...downstreamPOToNextLinks);
      allLinks.push(...downstreamPOToDestLinks);
      allLinks.push(...nextToDestLinks);
    } else if (view === 'outboundTraffic') {
      allLinks.push(...originToPrevLinks);
      allLinks.push(...prevToUpstreamPOLinks);
      allLinks.push(...originToUpstreamPOLinks);
      allLinks.push(...prevToMyAsnDirectLinks);
    } else {
      // custom: push all pools; bridge eliminates links to unselected node stages
      allLinks.push(...originToPrevLinks);
      allLinks.push(...originToUpstreamPOLinks);
      allLinks.push(...prevToUpstreamPOLinks);
      allLinks.push(...prevToMyAsnDirectLinks);
      allLinks.push(...myAsnToNextDirectLinks);
      allLinks.push(...downstreamPOToNextLinks);
      allLinks.push(...downstreamPOToDestLinks);
      allLinks.push(...nextToDestLinks);
    }

    // ── My ASN internal links (collapsed vs expanded per-ASN) ────────────
    for (const asnNode of sankeyNodes.filter(n => n.stage === 'myASN')) {
      if (!forceExpanded) {
        const f = stageFilters.find(x => x.stage === 'myASN');
        if (f?.selectedASNs.length && !f.selectedASNs.includes(asnNode.asnNumber)) continue;
      }

      if ((stageOn('myASN') && isMyAsnExpanded(asnNode.id)) || forceExpanded) {
        allLinks.push(...(myAsnExpandedLinks[asnNode.id] ?? []));
      } else {
        allLinks.push(...upstreamPOToMyAsnLinks.filter(l => l.target === asnNode.id));
        allLinks.push(...myAsnToDownstreamPOLinks.filter(l => l.source === asnNode.id));
      }
    }

    // ── Bridge hidden nodes ────────────────────────────────────────────────
    const nodeIds = new Set(nodes.map(n => n.id));
    const allLinkNodeIds = new Set([
      ...allLinks.map(l => l.source),
      ...allLinks.map(l => l.target),
    ]);
    const hiddenNodeIds = new Set([...allLinkNodeIds].filter(id => !nodeIds.has(id)));
    const bridgedLinks = buildBridgedLinks(allLinks, hiddenNodeIds);
    const validLinks = bridgedLinks.filter(
      l => nodeIds.has(l.source) && nodeIds.has(l.target),
    );

    // ── Semantic guard ─────────────────────────────────────────────────────
    const semanticLinks = validLinks.filter(l => {
      const src = NODE_STAGE.get(l.source);
      const dst = NODE_STAGE.get(l.target);
      if (src === 'previousPeer' && dst === 'nextPeer') return false;
      return true;
    });

    // ── Dynamic depths ─────────────────────────────────────────────────────
    const anyExpanded = nodes.some(n => MY_ASN_SUB_STAGES.has(n.stage));
    const presentStages = new Set(nodes.map(n => n.stage));

    // For custom view: derive stage order from selected columns
    let customOrders: { compact: SankeyStage[], expanded: SankeyStage[] } | undefined;
    if (view === 'custom') {
      const COMPACT_BASE: SankeyStage[] = ['originASN', 'previousPeer', 'upstreamPO', 'myASN', 'downstreamPO', 'nextPeer', 'destinationASN'];
      const EXPANDED_BASE: SankeyStage[] = ['originASN', 'previousPeer', 'upstreamPO', 'myIngressInterface', 'myRouter', 'downstreamPO', 'nextPeer', 'destinationASN'];
      const compact = COMPACT_BASE.filter(s => cols.has(s));
      const expanded = EXPANDED_BASE.filter(s =>
        cols.has(s) || (MY_ASN_SUB_STAGES.has(s) && (cols.has('myASN') || forceExpanded))
      );
      customOrders = { compact, expanded };
    }

    // When forceExpanded, treat myASN as enabled for depth-slot allocation of sub-stages
    const depthEnabledStages = forceExpanded ? new Set([...enabledStages, 'myASN']) : enabledStages;
    const dynamicDepths = computeDynamicDepths(view, depthEnabledStages, anyExpanded, presentStages, customOrders);

    return { nodes, links: semanticLinks, dynamicDepths };
  }, [stageFilters, expandedASNs, routerFilterSelections, trafficView, customViewConfig]);

  // Nodes for StageFilters dropdown options
  const asnNodesForFilters = useMemo(
    () => sankeyNodes.filter(n => INDEPENDENT_STAGES.includes(n.stage)),
    [],
  );

  // Chart container sizing
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 900, height: 500 });
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0)
          setChartSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleDownloadPNG = () => {
    const svg = document.querySelector('.sankey-container svg');
    if (!svg) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.download = 'asn-path-analysis.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const isForceExpanded = trafficView === 'custom' && (
    customViewConfig.selectedColumns.has('myIngressInterface') ||
    customViewConfig.selectedColumns.has('myRouter')
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <select
            className={styles.viewSelector}
            value={trafficView}
            onChange={e => setTrafficView(e.target.value as TrafficView)}
          >
            {(Object.keys(VIEW_LABELS) as TrafficView[]).map(v => (
              <option key={v} value={v}>{VIEW_LABELS[v]}</option>
            ))}
          </select>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <div className={styles.headerRight}>
          <ExportDropdown />
        </div>
      </div>

      {/* Custom view column builder */}
      {trafficView === 'custom' && (
        <CustomViewBuilder config={customViewConfig} onChange={setCustomViewConfig} />
      )}

      {/* Stage Filters — supports add/remove columns */}
      <StageFilters
        filters={stageFilters}
        nodes={asnNodesForFilters}
        onChange={setStageFilters}
        onStageToggle={handleStageToggle}
      />

      {/* Sankey Diagram */}
      <Card className={styles.chartCard} noPadding>
        <div className={styles.sankeyRow}>
          <div className={`sankey-container ${styles.sankeyContainer}`} ref={chartRef}>
            <SankeyDiagram
              nodes={computedSankeyData.nodes}
              links={computedSankeyData.links}
              stageFilters={stageFilters}
              onNodeClick={handleNodeClick}
              onLinkClick={handleLinkClick}
              onStageToggle={handleStageToggle}
              onNodeToggleExpand={handleToggleMyASNExpand}
              expandedASNs={expandedASNs}
              dynamicDepths={computedSankeyData.dynamicDepths}
              width={chartSize.width}
              height={chartSize.height}
              onExpandAll={isForceExpanded ? undefined : handleExpandAll}
              onCollapseAll={isForceExpanded ? undefined : handleCollapseAll}
              allExpanded={isForceExpanded || expandedASNs.size >= allExpandableASNIds.length}
            />
            <button
              className={styles.downloadBtn}
              onClick={handleDownloadPNG}
              title="Download as PNG"
            >
              <Camera size={16} />
            </button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <div className={styles.tableSection}>
        <ASNPathTable />
      </div>

      {/* Popups */}
      <MyASNPopup
        isOpen={selectedNode !== null}
        onClose={() => setSelectedNode(null)}
        onCollapse={(nodeId) => { handleToggleMyASNExpand(nodeId); setSelectedNode(null); }}
        node={selectedNode}
        routerFilterSelections={routerFilterSelections}
        onRouterFilterChange={handleRouterFilterChange}
      />

      <FlowPopup
        isOpen={selectedLink !== null}
        onClose={() => setSelectedLink(null)}
        link={selectedLink}
      />
    </div>
  );
}
