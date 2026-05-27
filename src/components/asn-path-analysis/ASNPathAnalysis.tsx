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
} from '../../data/mockData';
import type { SankeyNode, SankeyLink, StageFilter, TimeRange } from '../../types';
import styles from './ASNPathAnalysis.module.css';

// My ASN sub-stages (always controlled by the myASN filter visibility + expand state)
const MY_ASN_SUB_STAGES = new Set(['myIngressInterface', 'myRouter', 'myEgressInterface']);

// All 9 independently-controlled stages (for the minimum-2-enabled guard)
const INDEPENDENT_STAGES = [
  'originPO', 'originASN', 'previousPeerPO', 'previousPeer',
  'myASN', 'nextPeer', 'nextPeerPO', 'destinationASN', 'destinationPO',
];

export function ASNPathAnalysis() {
  const [stageFilters, setStageFilters] = useState<StageFilter[]>(defaultStageFilters);
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    preset: '1h',
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date(),
  }));
  const [selectedNode, setSelectedNode] = useState<SankeyNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<SankeyLink | null>(null);

  // Which My ASN nodes are currently expanded (showing ingress→router→egress)
  const [expandedASNs, setExpandedASNs] = useState<Set<string>>(new Set());

  const handleStageVisibilityToggle = useCallback((stage: string) => {
    const enabledCount = stageFilters.filter(f => f.enabled).length;
    const targetFilter = stageFilters.find(f => f.stage === stage);
    if (targetFilter?.enabled && enabledCount <= 2) return;
    setStageFilters(prev => prev.map(f =>
      f.stage === stage ? { ...f, enabled: !f.enabled } : f
    ));
  }, [stageFilters]);


  // Toggle expand/collapse for a given My ASN node id
  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedASNs(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Clicking a My Router node opens the detail popup (same UX as before)
  const handleNodeClick = useCallback((node: SankeyNode) => {
    if (node.stage === 'myRouter' || node.isMyASN) {
      setSelectedNode(node);
    }
  }, []);

  const handleLinkClick = useCallback((link: SankeyLink) => {
    setSelectedLink(link);
  }, []);

  // ── Build the Sankey data ──────────────────────────────────────────────────
  // Combines base nodes + PO nodes + expanded/collapsed My ASN nodes,
  // filtered by stage visibility and ASN selection.
  const computedSankeyData = useMemo(() => {
    const enabledStages = new Set(stageFilters.filter(f => f.enabled).map(f => f.stage));

    // Is a stage independently enabled?
    const stageOn = (stage: string) => enabledStages.has(stage as never);

    // My ASN sub-stage visibility depends on myASN being enabled
    const subStageOn = (stage: string) =>
      MY_ASN_SUB_STAGES.has(stage) ? stageOn('myASN') : stageOn(stage);

    // Helper: is a node allowed by the ASN/PO selection filter?
    const nodePassesFilter = (node: SankeyNode): boolean => {
      const filter = stageFilters.find(f => f.stage === node.stage);
      if (filter && filter.selectedASNs.length > 0) {
        return filter.selectedASNs.includes(node.asnNumber);
      }
      return true;
    };

    // ── Nodes ──────────────────────────────────────────────────────────────
    const nodes: SankeyNode[] = [];

    for (const node of sankeyNodes) {
      if (!subStageOn(node.stage)) continue;
      if (!nodePassesFilter(node)) continue;

      if (node.stage === 'myASN') {
        if (expandedASNs.has(node.id)) {
          const expanded = myAsnExpandedNodes[node.id] ?? [];
          nodes.push(...expanded);
        } else {
          nodes.push(node);
        }
      } else {
        nodes.push(node);
      }
    }

    // ── Links ──────────────────────────────────────────────────────────────
    const links: SankeyLink[] = [];

    if (stageOn('originPO'))       links.push(...poOriginLinks);
    links.push(...originToPrevLinks);
    if (stageOn('previousPeerPO')) links.push(...poPrevPeerLinks);

    // Previous Peer ↔ My ASN: collapsed or expanded per-ASN
    const myAsnNodes = sankeyNodes.filter(n => n.stage === 'myASN');
    if (stageOn('myASN')) {
      for (const asnNode of myAsnNodes) {
        const filter = stageFilters.find(f => f.stage === 'myASN');
        if (filter?.selectedASNs.length && !filter.selectedASNs.includes(asnNode.asnNumber)) continue;
        if (expandedASNs.has(asnNode.id)) {
          links.push(...(myAsnExpandedLinks[asnNode.id] ?? []));
        } else {
          links.push(...(prevToMyAsnLinks[asnNode.id] ?? []));
          links.push(...(myAsnToNextLinks[asnNode.id] ?? []));
        }
      }
    }

    links.push(...nextToDestLinks);
    if (stageOn('nextPeerPO'))     links.push(...poNextPeerLinks);
    if (stageOn('destinationPO'))  links.push(...poDestLinks);

    // Drop links whose source/target isn't in the visible node set
    const nodeIds = new Set(nodes.map(n => n.id));
    const validLinks = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

    return { nodes, links: validLinks };
  }, [stageFilters, expandedASNs]);

  // All non-interface nodes passed to StageFilters for dropdown option building
  const asnNodesForFilters = useMemo(
    () => sankeyNodes.filter(n => INDEPENDENT_STAGES.includes(n.stage)),
    []
  );

  // Measure the chart container for dynamic Sankey sizing
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 900, height: 500 });

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setChartSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleDownloadPNG = () => {
    const svgElement = document.querySelector('.sankey-container svg');
    if (!svgElement) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = 'asn-path-analysis.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
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

      {/* Stage Filters — only ASN stages have dropdowns */}
      <StageFilters
        filters={stageFilters}
        nodes={asnNodesForFilters}
        onChange={setStageFilters}
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
              onStageToggle={handleStageVisibilityToggle}
              onNodeToggleExpand={handleToggleExpand}
              expandedASNs={expandedASNs}
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
        onCollapse={(nodeId) => {
          handleToggleExpand(nodeId);
          setSelectedNode(null);
        }}
        node={selectedNode}
      />

      <FlowPopup
        isOpen={selectedLink !== null}
        onClose={() => setSelectedLink(null)}
        link={selectedLink}
      />
    </div>
  );
}
