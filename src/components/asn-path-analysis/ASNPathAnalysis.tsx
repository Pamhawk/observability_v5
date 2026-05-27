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
  poOriginLinks,
  poPrevPeerLinks,
  originToPrevLinks,
  prevToMyAsnLinks,
  myAsnToNextLinks,
  nextToDestLinks,
  poNextPeerLinks,
  poDestLinks,
  myAsnExpandedLinks,
  defaultStageFilters,
  asnNodeIDsWithPOs,
} from '../../data/mockData';
import type { SankeyNode, SankeyLink, StageFilter, TimeRange, SankeyStage } from '../../types';
import styles from './ASNPathAnalysis.module.css';

// My ASN sub-stages: visibility follows myASN filter
const MY_ASN_SUB_STAGES = new Set(['myIngressInterface', 'myRouter', 'myEgressInterface']);

// All independently-controlled stages (for filter dropdowns + bridging)
const INDEPENDENT_STAGES = [
  'originPO', 'originASN', 'previousPeerPO', 'previousPeer',
  'myASN', 'nextPeer', 'nextPeerPO', 'destinationASN', 'destinationPO',
];

// Which PO stage corresponds to each ASN stage (for expand-icon visibility)
const PO_STAGE_FOR_ASN: Partial<Record<string, string>> = {
  originASN:      'originPO',
  previousPeer:   'previousPeerPO',
  nextPeer:       'nextPeerPO',
  destinationASN: 'destinationPO',
};

// Ordered stage sequences for dynamic depth mapping
const COMPACT_STAGE_ORDER: SankeyStage[] = [
  'originPO', 'originASN', 'previousPeerPO', 'previousPeer',
  'myASN',
  'nextPeer', 'nextPeerPO', 'destinationASN', 'destinationPO',
];

const EXPANDED_STAGE_ORDER: SankeyStage[] = [
  'originPO', 'originASN', 'previousPeerPO', 'previousPeer',
  'myIngressInterface', 'myRouter', 'myEgressInterface',
  'nextPeer', 'nextPeerPO', 'destinationASN', 'destinationPO',
];

function computeDynamicDepths(
  enabledStages: Set<string>,
  anyExpanded: boolean,
): Record<string, number> {
  const seq = anyExpanded ? EXPANDED_STAGE_ORDER : COMPACT_STAGE_ORDER;
  const depths: Record<string, number> = {};
  let d = 0;
  for (const stage of seq) {
    const active = MY_ASN_SUB_STAGES.has(stage)
      ? enabledStages.has('myASN')
      : enabledStages.has(stage);
    if (active) depths[stage] = d++;
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
  // Which ASN nodes have their PO layer expanded (PO icon click)
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());
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

  const handleTogglePOExpand = useCallback((nodeId: string) => {
    setExpandedPOs(prev => {
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
    const stageOn = (s: string) => enabledStages.has(s as never);

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

    // ── Nodes ──────────────────────────────────────────────────────────────
    const nodes: SankeyNode[] = [];

    for (const node of sankeyNodes) {
      // Sub-stages of myASN follow the myASN filter
      const stageEnabled = MY_ASN_SUB_STAGES.has(node.stage)
        ? stageOn('myASN') : stageOn(node.stage);
      if (!stageEnabled) continue;
      if (!passesFilter(node)) continue;

      if (node.stage === 'myASN') {
        if (isMyAsnExpanded(node.id)) {
          nodes.push(...(myAsnExpandedNodes[node.id] ?? []));
        } else {
          nodes.push(node);
        }
      } else if (node.stage === 'originPO') {
        const anyExpanded = poOriginLinks.some(l => l.source === node.id && expandedPOs.has(l.target));
        if (anyExpanded) nodes.push(node);
      } else if (node.stage === 'previousPeerPO') {
        const anyExpanded = poPrevPeerLinks.some(l => l.source === node.id && expandedPOs.has(l.target));
        if (anyExpanded) nodes.push(node);
      } else if (node.stage === 'nextPeerPO') {
        const anyExpanded = poNextPeerLinks.some(l => l.target === node.id && expandedPOs.has(l.source));
        if (anyExpanded) nodes.push(node);
      } else if (node.stage === 'destinationPO') {
        const anyExpanded = poDestLinks.some(l => l.target === node.id && expandedPOs.has(l.source));
        if (anyExpanded) nodes.push(node);
      } else {
        nodes.push(node);
      }
    }

    // ── Links ──────────────────────────────────────────────────────────────
    const allLinks: SankeyLink[] = [];

    // Origin PO → Origin ASN (only for expanded ASNs)
    if (stageOn('originPO')) {
      allLinks.push(...poOriginLinks.filter(l => expandedPOs.has(l.target)));
    }

    allLinks.push(...originToPrevLinks);

    // Prev Peer PO → Prev Peer (only for expanded prev peers)
    if (stageOn('previousPeerPO')) {
      allLinks.push(...poPrevPeerLinks.filter(l => expandedPOs.has(l.target)));
    }

    // Prev Peer ↔ My ASN (collapsed or expanded per-ASN)
    if (stageOn('myASN')) {
      for (const asnNode of sankeyNodes.filter(n => n.stage === 'myASN')) {
        const f = stageFilters.find(x => x.stage === 'myASN');
        if (f?.selectedASNs.length && !f.selectedASNs.includes(asnNode.asnNumber)) continue;
        if (isMyAsnExpanded(asnNode.id)) {
          allLinks.push(...(myAsnExpandedLinks[asnNode.id] ?? []));
        } else {
          allLinks.push(...(prevToMyAsnLinks[asnNode.id] ?? []));
          allLinks.push(...(myAsnToNextLinks[asnNode.id] ?? []));
        }
      }
    }

    allLinks.push(...nextToDestLinks);

    // Next Peer → Next Peer PO (only for expanded next peers)
    if (stageOn('nextPeerPO')) {
      allLinks.push(...poNextPeerLinks.filter(l => expandedPOs.has(l.source)));
    }

    // Dest ASN → Dest PO (only for expanded dest ASNs)
    if (stageOn('destinationPO')) {
      allLinks.push(...poDestLinks.filter(l => expandedPOs.has(l.source)));
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

    // ── Dynamic depths ─────────────────────────────────────────────────────
    const anyExpanded = nodes.some(n => MY_ASN_SUB_STAGES.has(n.stage));
    const dynamicDepths = computeDynamicDepths(enabledStages, anyExpanded);

    return { nodes, links: validLinks, dynamicDepths };
  }, [stageFilters, expandedASNs, expandedPOs, routerFilterSelections]);

  // Nodes for StageFilters dropdown options (all independently-controlled stages)
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
              onTogglePOExpand={handleTogglePOExpand}
              expandedASNs={expandedASNs}
              expandedPOs={expandedPOs}
              asnNodesWithPOs={asnNodeIDsWithPOs}
              poStageForAsn={PO_STAGE_FOR_ASN}
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
