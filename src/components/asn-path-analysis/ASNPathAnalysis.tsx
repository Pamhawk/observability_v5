import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Camera } from 'lucide-react';
import { Card, TimeRangeSelector, ExportDropdown } from '../common';
import { SankeyDiagram } from '../charts';
import { StageFilters } from './StageFilters';
import { MyASNPopup } from './MyASNPopup';
import { FlowPopup } from './FlowPopup';
import { ASNPathTable } from './ASNPathTable';
import {
  sankeyNodes,
  myAsnExpandedNodes,
  originToPrevLinks,
  prevToUpstreamPOLinks,
  upstreamPOToMyAsnLinks,
  myAsnToDownstreamPOLinks,
  downstreamPOToNextLinks,
  nextToDestLinks,
  myAsnExpandedLinks,
  defaultStageFilters,
} from '../../data/mockData';
import type { SankeyNode, SankeyLink, StageFilter, TimeRange, SankeyStage } from '../../types';
import styles from './ASNPathAnalysis.module.css';

// My ASN sub-stages: visibility follows myASN filter
const MY_ASN_SUB_STAGES = new Set(['myIngressInterface', 'myRouter', 'myEgressInterface']);

// All independently-controlled stages (for filter dropdowns)
const INDEPENDENT_STAGES: SankeyStage[] = [
  'originASN', 'previousPeer', 'upstreamPO', 'myASN', 'downstreamPO', 'nextPeer', 'destinationASN',
];

// Ordered stage sequences for dynamic depth mapping
// Flow: originASN → previousPeer → upstreamPO → myASN → downstreamPO → nextPeer → destinationASN
const COMPACT_STAGE_ORDER: SankeyStage[] = [
  'originASN', 'previousPeer', 'upstreamPO', 'myASN', 'downstreamPO', 'nextPeer', 'destinationASN',
];

const EXPANDED_STAGE_ORDER: SankeyStage[] = [
  'originASN', 'previousPeer', 'upstreamPO',
  'myIngressInterface', 'myRouter', 'myEgressInterface',
  'downstreamPO', 'nextPeer', 'destinationASN',
];

// PO stages only get a column when at least one node of that stage is actually present.
// Without this guard, enabled-but-empty PO columns still get a depth slot, and ECharts
// distributes all column widths evenly (including the empty ones), creating visual gaps.
const PO_STAGES = new Set<string>(['upstreamPO', 'downstreamPO']);

function computeDynamicDepths(
  enabledStages: Set<string>,
  anyExpanded: boolean,
  presentStages: Set<string>,   // actual stages that have ≥1 node in the current render
): Record<string, number> {
  const seq = anyExpanded ? EXPANDED_STAGE_ORDER : COMPACT_STAGE_ORDER;
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

export function ASNPathAnalysis() {
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
    // Track which My ASN asnNumbers are visible (for PO node inclusion)
    const visibleMyAsnNumbers = new Set<number>();

    // Pass 1: build non-PO nodes
    for (const node of sankeyNodes) {
      if (node.stage === 'upstreamPO' || node.stage === 'downstreamPO') continue;

      // Sub-stages of myASN follow the myASN filter
      const stageEnabled = MY_ASN_SUB_STAGES.has(node.stage)
        ? stageOn('myASN') : stageOn(node.stage);
      if (!stageEnabled) continue;
      if (!passesFilter(node)) continue;

      if (node.stage === 'myASN') {
        visibleMyAsnNumbers.add(node.asnNumber);
        if (isMyAsnExpanded(node.id)) {
          nodes.push(...(myAsnExpandedNodes[node.id] ?? []));
        } else {
          nodes.push(node);
        }
      } else {
        nodes.push(node);
      }
    }

    // Pass 2: add PO nodes only for visible My ASNs
    // upstreamPO: sits between previousPeer and myASN
    if (stageOn('upstreamPO')) {
      for (const node of sankeyNodes) {
        if (node.stage === 'upstreamPO' && visibleMyAsnNumbers.has(node.asnNumber)) {
          nodes.push(node);
        }
      }
    }
    // downstreamPO: sits between myASN and nextPeer
    if (stageOn('downstreamPO')) {
      for (const node of sankeyNodes) {
        if (node.stage === 'downstreamPO' && visibleMyAsnNumbers.has(node.asnNumber)) {
          nodes.push(node);
        }
      }
    }

    // ── Links ──────────────────────────────────────────────────────────────
    // Always add all structural links; the bridge function handles routing around
    // any hidden nodes (disabled stages, filtered-out ASNs, etc.)
    const allLinks: SankeyLink[] = [];

    // Origin → Previous Peer
    allLinks.push(...originToPrevLinks);

    // Previous Peer → Upstream PO
    // (if upstreamPO is disabled or its nodes are filtered out, bridge creates prev→myASN)
    allLinks.push(...prevToUpstreamPOLinks);

    // My ASN connections (collapsed vs expanded, per-ASN)
    for (const asnNode of sankeyNodes.filter(n => n.stage === 'myASN')) {
      const f = stageFilters.find(x => x.stage === 'myASN');
      if (f?.selectedASNs.length && !f.selectedASNs.includes(asnNode.asnNumber)) continue;

      if (stageOn('myASN') && isMyAsnExpanded(asnNode.id)) {
        // Expanded view: upstreamPO → ingress → router → egress → downstreamPO
        allLinks.push(...(myAsnExpandedLinks[asnNode.id] ?? []));
      } else {
        // Collapsed view: upstreamPO → myASN → downstreamPO
        // (if myASN stage is disabled, bridge creates upstreamPO→downstreamPO through hidden myASN)
        allLinks.push(...upstreamPOToMyAsnLinks.filter(l => l.target === asnNode.id));
        allLinks.push(...myAsnToDownstreamPOLinks.filter(l => l.source === asnNode.id));
      }
    }

    // Downstream PO → Next Peer
    // (if downstreamPO is disabled, bridge creates myASN→nextPeer)
    allLinks.push(...downstreamPOToNextLinks);

    // Next Peer → Destination
    allLinks.push(...nextToDestLinks);

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

    // ── Dynamic depths ─────────────────────────────────────────────────────
    const anyExpanded = nodes.some(n => MY_ASN_SUB_STAGES.has(n.stage));
    const presentStages = new Set(nodes.map(n => n.stage));
    const dynamicDepths = computeDynamicDepths(enabledStages, anyExpanded, presentStages);

    return { nodes, links: validLinks, dynamicDepths };
  }, [stageFilters, expandedASNs, routerFilterSelections]);

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

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <div className={styles.headerRight}>
          <ExportDropdown />
        </div>
      </div>

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
