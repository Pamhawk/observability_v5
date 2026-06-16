import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Camera, Lasso } from 'lucide-react';
import { Card, TimeRangeSelector, ExportDropdown } from '../common';
import { SankeyDiagram } from '../charts';
import { StageFilters } from './StageFilters';
import { CustomViewBuilder } from './CustomViewBuilder';
import { MyASNPopup } from './MyASNPopup';
import { POPopup } from './POPopup';
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
  eastWestStageFilters,
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
type StandardView = 'networkTransit' | 'inboundTraffic' | 'outboundTraffic' | 'eastWest';

const VIEW_COMPACT_ORDER: Record<StandardView, SankeyStage[]> = {
  networkTransit: ['originASN', 'previousPeer', 'upstreamPO', 'myASN', 'downstreamPO', 'nextPeer', 'destinationASN'],
  inboundTraffic: ['upstreamPO', 'myASN', 'nextPeer', 'destinationASN'],
  outboundTraffic: ['originASN', 'previousPeer', 'upstreamPO', 'myASN', 'downstreamPO'],
  eastWest: ['upstreamPO', 'myASN', 'downstreamPO'],
};

const VIEW_EXPANDED_ORDER: Record<StandardView, SankeyStage[]> = {
  networkTransit: ['originASN', 'previousPeer', 'upstreamPO', 'myIngressInterface', 'myRouter', 'downstreamPO', 'nextPeer', 'destinationASN'],
  inboundTraffic: ['upstreamPO', 'myIngressInterface', 'myRouter', 'nextPeer', 'destinationASN'],
  outboundTraffic: ['originASN', 'previousPeer', 'myIngressInterface', 'myRouter', 'downstreamPO'],
  eastWest: ['upstreamPO', 'myIngressInterface', 'myRouter', 'downstreamPO'],
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
  eastWest:        'East-West',
  custom:          'Custom',
};

const VIEW_FILTERS: Record<StandardView, StageFilter[]> = {
  networkTransit:  defaultStageFilters,
  inboundTraffic:  inboundStageFilters,
  outboundTraffic: outboundStageFilters,
  eastWest:        eastWestStageFilters,
};

const CUSTOM_STAGE_COLORS: Record<SankeyStage, string> = {
  originASN: '#F97316', previousPeer: '#3B82F6', upstreamPO: '#818CF8',
  myASN: '#14B8A6', myIngressInterface: '#99F6E4', myRouter: '#0E9F8E',
  downstreamPO: '#FB923C', nextPeer: '#F43F5E', destinationASN: '#EC4899',
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

// ── PO prefix expansion helpers ────────────────────────────────────────────

// Same deterministic weight formula as POPopup so sizes stay consistent
function getPrefixWeights(prefixes: string[]): number[] {
  return prefixes.map((_, i) => 0.4 + 0.6 * (((i * 17 + 3) % 7) / 6));
}

function buildPOPrefixNodes(poNode: SankeyNode): SankeyNode[] {
  const prefixes = poNode.prefixes ?? [];
  if (!prefixes.length) return [];
  const weights = getPrefixWeights(prefixes);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  return prefixes.map((prefix, i) => ({
    id: `${poNode.id}-pfx-${i}`,
    name: prefix,
    asnNumber: poNode.asnNumber,
    stage: poNode.stage,
    nodeType: 'prefix' as const,
    trafficGbps: Math.round((poNode.trafficGbps * weights[i] / totalWeight) * 10) / 10,
    country: poNode.country,
    state: poNode.state,
    city: poNode.city,
    inFlows: 0,
    outFlows: 0,
    isMyASN: poNode.isMyASN,
    parentPOId: poNode.id,
  }));
}

// For any link where source or target is an expanded PO, split proportionally
// through prefix sub-nodes. Links not touching any expanded PO pass through unchanged.
function splitLinksForExpandedPOs(
  links: SankeyLink[],
  expandedPOs: Set<string>,
  poById: Map<string, SankeyNode>,
): SankeyLink[] {
  if (expandedPOs.size === 0) return links;
  const result: SankeyLink[] = [];
  for (const link of links) {
    const srcPO = expandedPOs.has(link.source) ? poById.get(link.source) : undefined;
    const tgtPO = expandedPOs.has(link.target) ? poById.get(link.target) : undefined;
    if (!srcPO && !tgtPO) {
      result.push(link);
    } else {
      const po = srcPO ?? tgtPO!;
      const prefixes = po.prefixes ?? [];
      if (!prefixes.length) { result.push(link); continue; }
      const weights = getPrefixWeights(prefixes);
      const totalWeight = weights.reduce((s, w) => s + w, 0);
      for (let i = 0; i < prefixes.length; i++) {
        const frac = weights[i] / totalWeight;
        const v = Math.round(link.value * frac * 10) / 10;
        if (v < 0.05) continue;
        result.push(srcPO
          ? { ...link, source: `${po.id}-pfx-${i}`, value: v, trafficGbps: v }
          : { ...link, target: `${po.id}-pfx-${i}`, value: v, trafficGbps: v },
        );
      }
    }
  }
  return result;
}

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
  const [selectedPONode, setSelectedPONode] = useState<SankeyNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<SankeyLink | null>(null);

  // Which My ASN nodes are manually expanded (icon click)
  const [expandedASNs, setExpandedASNs] = useState<Set<string>>(new Set());
  // Which PO nodes are expanded to show IP prefix sub-nodes
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());
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
    setExpandedPOs(new Set());
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

  const handlePOToggleExpand = useCallback((nodeId: string) => {
    setExpandedPOs(prev => {
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
    setExpandedPOs(new Set());
    setRouterFilterSelections(new Set());
  }, []);

  // Route node clicks: PO nodes open POPopup, prefix sub-nodes open parent PO's popup
  const handleNodeClick = useCallback((node: SankeyNode) => {
    if (node.nodeType === 'protectedObject') {
      setSelectedPONode(node);
      setSelectedNode(null);
    } else if (node.nodeType === 'prefix' && node.parentPOId) {
      const parentPO = sankeyNodes.find(n => n.id === node.parentPOId) ?? null;
      setSelectedPONode(parentPO);
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
      setSelectedPONode(null);
    }
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

    // PO prefix expansion: lookup map + shorthand split helper
    const poById = new Map<string, SankeyNode>(
      sankeyNodes
        .filter(n => n.stage === 'upstreamPO' || n.stage === 'downstreamPO')
        .map(n => [n.id, n]),
    );
    const sp = (links: SankeyLink[]) => splitLinksForExpandedPOs(links, expandedPOs, poById);

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
          const subNodes = myAsnExpandedNodes[node.id] ?? [];
          // When forceExpanded by custom view: only include sub-stages that are
          // explicitly selected (e.g. only Router, or only Ingress, or both).
          // When manually expanded via toggle: include all sub-nodes.
          const filteredSubs = forceExpanded
            ? subNodes.filter(n => cols.has(n.stage))
            : subNodes;
          nodes.push(...filteredSubs);
        } else {
          nodes.push(node);
        }
      } else {
        nodes.push(node);
      }
    }

    // Pass 2: add PO nodes only for visible My ASNs (expand to prefix sub-nodes if expanded)
    if (stageOn('upstreamPO')) {
      for (const node of sankeyNodes) {
        if (node.stage === 'upstreamPO' && visibleMyAsnNumbers.has(node.asnNumber)) {
          if (expandedPOs.has(node.id)) {
            nodes.push(...buildPOPrefixNodes(node));
          } else {
            nodes.push(node);
          }
        }
      }
    }
    if (stageOn('downstreamPO')) {
      for (const node of sankeyNodes) {
        if (node.stage === 'downstreamPO' && visibleMyAsnNumbers.has(node.asnNumber)) {
          if (expandedPOs.has(node.id)) {
            nodes.push(...buildPOPrefixNodes(node));
          } else {
            nodes.push(node);
          }
        }
      }
    }

    // ── Links — view-specific pools ────────────────────────────────────────
    const allLinks: SankeyLink[] = [];

    if (view === 'networkTransit') {
      allLinks.push(...originToPrevLinks);
      allLinks.push(...sp(prevToUpstreamPOLinks));
      allLinks.push(...sp(originToUpstreamPOLinks));
      allLinks.push(...prevToMyAsnDirectLinks);
      allLinks.push(...myAsnToNextDirectLinks);
      allLinks.push(...sp(downstreamPOToNextLinks));
      allLinks.push(...sp(downstreamPOToDestLinks));
      allLinks.push(...nextToDestLinks);
    } else if (view === 'inboundTraffic') {
      allLinks.push(...myAsnToNextDirectLinks);
      allLinks.push(...sp(downstreamPOToNextLinks));
      allLinks.push(...sp(downstreamPOToDestLinks));
      allLinks.push(...nextToDestLinks);
    } else if (view === 'outboundTraffic') {
      allLinks.push(...originToPrevLinks);
      allLinks.push(...sp(prevToUpstreamPOLinks));
      allLinks.push(...sp(originToUpstreamPOLinks));
      allLinks.push(...prevToMyAsnDirectLinks);
    } else if (view === 'eastWest') {
      // upstreamPO ↔ myASN ↔ downstreamPO links are all handled by the per-ASN loop below
    } else {
      // custom: push all pools; bridge eliminates links to unselected node stages
      allLinks.push(...originToPrevLinks);
      allLinks.push(...sp(originToUpstreamPOLinks));
      allLinks.push(...sp(prevToUpstreamPOLinks));
      allLinks.push(...prevToMyAsnDirectLinks);
      allLinks.push(...myAsnToNextDirectLinks);
      allLinks.push(...sp(downstreamPOToNextLinks));
      allLinks.push(...sp(downstreamPOToDestLinks));
      allLinks.push(...nextToDestLinks);
    }

    // ── My ASN internal links (collapsed vs expanded per-ASN) ────────────
    for (const asnNode of sankeyNodes.filter(n => n.stage === 'myASN')) {
      if (!forceExpanded) {
        const f = stageFilters.find(x => x.stage === 'myASN');
        if (f?.selectedASNs.length && !f.selectedASNs.includes(asnNode.asnNumber)) continue;
      }

      if ((stageOn('myASN') && isMyAsnExpanded(asnNode.id)) || forceExpanded) {
        allLinks.push(...sp(myAsnExpandedLinks[asnNode.id] ?? []));
      } else {
        allLinks.push(...sp(upstreamPOToMyAsnLinks.filter(l => l.target === asnNode.id)));
        allLinks.push(...sp(myAsnToDownstreamPOLinks.filter(l => l.source === asnNode.id)));
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
      const expanded = EXPANDED_BASE.filter(s => {
        if (MY_ASN_SUB_STAGES.has(s)) {
          // forceExpanded: only include sub-stages explicitly chosen in custom view
          // manual-expand (myASN selected + toggle): include all sub-stages
          return forceExpanded ? cols.has(s) : cols.has('myASN');
        }
        return cols.has(s);
      });
      customOrders = { compact, expanded };
    }

    // When forceExpanded, treat myASN as enabled for depth-slot allocation of sub-stages.
    // Also add explicitly selected sub-stages so they get their own depth columns.
    const depthEnabledStages = forceExpanded
      ? new Set([...enabledStages, 'myASN', ...Array.from(cols).filter(s => MY_ASN_SUB_STAGES.has(s))])
      : enabledStages;
    const dynamicDepths = computeDynamicDepths(view, depthEnabledStages, anyExpanded, presentStages, customOrders);

    return { nodes, links: semanticLinks, dynamicDepths };
  }, [stageFilters, expandedASNs, expandedPOs, routerFilterSelections, trafficView, customViewConfig]);

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

  // Sankey lasso-select state
  const [sankeyLassoActive, setSankeyLassoActive] = useState(false);
  const [lassoRect, setLassoRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [lassoSelectedIds, setLassoSelectedIds] = useState<Set<string>>(new Set());
  const lassoStartRef = useRef<{ x: number; y: number } | null>(null);
  // Refs so mouseup handler can read latest values without re-creating on every mousemove
  const lassoRectRef = useRef(lassoRect);
  lassoRectRef.current = lassoRect;
  const sankeyNodesRef = useRef(computedSankeyData.nodes);
  sankeyNodesRef.current = computedSankeyData.nodes;

  useEffect(() => {
    if (!sankeyLassoActive) return;
    const handleGlobalMouseUp = () => { lassoStartRef.current = null; };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [sankeyLassoActive]);

  const activateSankeyLasso = useCallback(() => {
    setSankeyLassoActive(true);
    setLassoRect(null);
  }, []);

  const clearSankeyLasso = useCallback(() => {
    setSankeyLassoActive(false);
    setLassoRect(null);
    lassoStartRef.current = null;
    setLassoSelectedIds(new Set());
  }, []);

  const handleLassoMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = chartRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lassoStartRef.current = { x, y };
    setLassoRect({ x1: x, y1: y, x2: x, y2: y });
    e.preventDefault();
  }, []);

  const handleLassoMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!lassoStartRef.current) return;
    const container = chartRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRect = { x1: lassoStartRef.current.x, y1: lassoStartRef.current.y, x2: x, y2: y };
    lassoRectRef.current = newRect;
    setLassoRect(newRect);
  }, []);

  const handleLassoMouseUp = useCallback(() => {
    lassoStartRef.current = null;

    const sel = lassoRectRef.current;
    if (!sel || Math.abs(sel.x2 - sel.x1) < 5) return;

    const container = chartRef.current;
    if (!container) return;

    // Selection bounds in page (client) coordinates
    const containerRect = container.getBoundingClientRect();
    const selLeft   = containerRect.left + Math.min(sel.x1, sel.x2);
    const selRight  = containerRect.left + Math.max(sel.x1, sel.x2);
    const selTop    = containerRect.top  + Math.min(sel.y1, sel.y2);
    const selBottom = containerRect.top  + Math.max(sel.y1, sel.y2);

    // Build map: display name → node.id (ECharts internal key used in series.data)
    const nodes = sankeyNodesRef.current as Array<{ id: string; name: string; stage: string }>;
    const nameToId = new Map(nodes.map(n => [n.name, n.id]));

    // Find SVG text labels whose center falls inside the selection rectangle.
    // Strip the '↓ ' prefix used on myIngressInterface nodes before matching.
    const svg = container.querySelector('svg');
    const selectedIds = new Set<string>();
    if (svg) {
      for (const t of Array.from(svg.querySelectorAll('text'))) {
        const label = t.textContent?.trim() ?? '';
        const displayName = label.replace(/^↓ /, '');
        const nodeId = nameToId.get(displayName);
        if (!nodeId) continue;
        const tr = t.getBoundingClientRect();
        const cx = tr.left + tr.width / 2;
        const cy = tr.top  + tr.height / 2;
        if (cx >= selLeft && cx <= selRight && cy >= selTop && cy <= selBottom) {
          selectedIds.add(nodeId);
        }
      }
    }

    if (selectedIds.size > 0) {
      setLassoSelectedIds(selectedIds);
    }
  }, []);

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
          <div
            className={`sankey-container ${styles.sankeyContainer}`}
            ref={chartRef}
          >
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
              expandedPOs={expandedPOs}
              onPOToggleExpand={handlePOToggleExpand}
              onExpandAll={isForceExpanded ? undefined : handleExpandAll}
              onCollapseAll={isForceExpanded ? undefined : handleCollapseAll}
              allExpanded={isForceExpanded || expandedASNs.size >= allExpandableASNIds.length}
              lassoSelectedIds={lassoSelectedIds}
            />
            {/* Lasso overlay — captures mouse events for drawing selection rect */}
            {sankeyLassoActive && (
              <div
                style={{ position: 'absolute', inset: 0, cursor: 'crosshair', zIndex: 5 }}
                onMouseDown={handleLassoMouseDown}
                onMouseMove={handleLassoMouseMove}
                onMouseUp={handleLassoMouseUp}
              />
            )}
            {/* Selection rectangle */}
            {lassoRect && (
              <div
                style={{
                  position: 'absolute',
                  left: Math.min(lassoRect.x1, lassoRect.x2),
                  top: Math.min(lassoRect.y1, lassoRect.y2),
                  width: Math.abs(lassoRect.x2 - lassoRect.x1),
                  height: Math.abs(lassoRect.y2 - lassoRect.y1),
                  border: '1.5px dashed #6366F1',
                  background: 'rgba(99, 102, 241, 0.08)',
                  pointerEvents: 'none',
                  zIndex: 6,
                }}
              />
            )}
            <button
              className={`${styles.lassoBtn} ${sankeyLassoActive ? styles.lassoBtnActive : ''}`}
              onClick={() => sankeyLassoActive ? clearSankeyLasso() : activateSankeyLasso()}
              title="Lasso select"
            >
              <Lasso size={16} />
            </button>
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

      <POPopup
        isOpen={selectedPONode !== null}
        onClose={() => setSelectedPONode(null)}
        node={selectedPONode}
      />

      <FlowPopup
        isOpen={selectedLink !== null}
        onClose={() => setSelectedLink(null)}
        link={selectedLink}
      />
    </div>
  );
}
