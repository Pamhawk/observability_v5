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
  originToPrevLinks,
  prevToMyAsnLinks,
  myAsnToNextLinks,
  nextToDestLinks,
  poDestLinks,
  myAsnExpandedLinks,
  defaultStageFilters,
} from '../../data/mockData';
import type { SankeyNode, SankeyLink, StageFilter, TimeRange } from '../../types';
import styles from './ASNPathAnalysis.module.css';

// Stages that are sub-types of a parent stage (shown/hidden with their parent)
const SUB_STAGE_PARENT: Record<string, string> = {
  originPO: 'originASN',
  destinationPO: 'destinationASN',
  myIngressInterface: 'myASN',
  myRouter: 'myASN',
  myEgressInterface: 'myASN',
};

// The 5 ASN stages used by the StageFilters dropdowns
const ASN_STAGES = ['originASN', 'previousPeer', 'myASN', 'nextPeer', 'destinationASN'];

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
    const enabledStages = stageFilters.filter(f => f.enabled).map(f => f.stage);

    // Helper: is a stage visible?
    const stageVisible = (stage: string): boolean => {
      const parent = SUB_STAGE_PARENT[stage];
      if (parent) return enabledStages.includes(parent as never);
      return enabledStages.includes(stage as never);
    };

    // Helper: is a node allowed by the ASN selection filter?
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
      if (!stageVisible(node.stage)) continue;
      if (!nodePassesFilter(node)) continue;

      if (node.stage === 'myASN') {
        if (expandedASNs.has(node.id)) {
          // Replace collapsed My ASN node with its ingress/router/egress sub-nodes
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

    // PO layers (origin side)
    if (stageVisible('originPO')) links.push(...poOriginLinks);

    // Origin ASN → Previous Peer
    links.push(...originToPrevLinks);

    // Previous Peer ↔ My ASN: collapsed or expanded per-ASN
    const myAsnNodes = sankeyNodes.filter(n => n.stage === 'myASN');
    for (const asnNode of myAsnNodes) {
      // Skip if myASN stage is disabled or this ASN is filtered out
      if (!stageVisible('myASN')) continue;
      const filter = stageFilters.find(f => f.stage === 'myASN');
      if (filter?.selectedASNs.length && !filter.selectedASNs.includes(asnNode.asnNumber)) continue;

      if (expandedASNs.has(asnNode.id)) {
        links.push(...(myAsnExpandedLinks[asnNode.id] ?? []));
      } else {
        links.push(...(prevToMyAsnLinks[asnNode.id] ?? []));
        links.push(...(myAsnToNextLinks[asnNode.id] ?? []));
      }
    }

    // Next Peer → Destination ASN
    links.push(...nextToDestLinks);

    // PO layers (destination side)
    if (stageVisible('destinationPO')) links.push(...poDestLinks);

    // Remove any links where source or target node doesn't exist in the visible set
    const nodeIds = new Set(nodes.map(n => n.id));
    const validLinks = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

    return { nodes, links: validLinks };
  }, [stageFilters, expandedASNs]);

  // Nodes passed to StageFilters — only ASN-stage nodes (no PO/interface nodes)
  const asnNodesForFilters = useMemo(
    () => sankeyNodes.filter(n => ASN_STAGES.includes(n.stage)),
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
