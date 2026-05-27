import { useState, useRef, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { SankeyNode, SankeyLink, StageFilter, SankeyStage } from '../../types';
import styles from './SankeyDiagram.module.css';

interface SankeyDiagramProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  stageFilters: StageFilter[];
  onNodeClick?: (node: SankeyNode) => void;
  onLinkClick?: (link: SankeyLink) => void;
  onStageToggle?: (stage: string) => void;
  onNodeToggleExpand?: (nodeId: string) => void;
  expandedASNs?: Set<string>;
  width?: number;
  height?: number;
}

interface TooltipData {
  type: 'node' | 'link';
  data: SankeyNode | SankeyLink;
  x: number;
  y: number;
}

interface EChartsEventParams {
  dataType?: string;
  data?: { name?: string; source?: string; target?: string };
  event?: { event?: { clientX?: number; clientY?: number } };
}

// ── Node colors by stage ───────────────────────────────────────────────────────
const STAGE_COLORS: Record<SankeyStage, string> = {
  originPO:           '#FED7AA', // soft orange (child of originASN)
  originASN:          '#F97316', // orange
  previousPeer:       '#8B5CF6', // purple
  myASN:              '#14B8A6', // teal
  myIngressInterface: '#99F6E4', // lightest teal
  myRouter:           '#0E9F8E', // medium teal
  myEgressInterface:  '#0D9488', // darkest teal
  nextPeer:           '#3B82F6', // blue
  destinationASN:     '#EC4899', // pink
  destinationPO:      '#FBCFE8', // soft pink (child of destinationASN)
};

// ── Depth maps — compact (no expansion) vs expanded (any My ASN open) ────────
const DEPTH_COMPACT: Record<SankeyStage, number> = {
  originPO:           0,
  originASN:          1,
  previousPeer:       2,
  myASN:              3,
  myIngressInterface: 3, // unused in compact
  myRouter:           4, // unused in compact
  myEgressInterface:  5, // unused in compact
  nextPeer:           4,
  destinationASN:     5,
  destinationPO:      6,
};

const DEPTH_EXPANDED: Record<SankeyStage, number> = {
  originPO:           0,
  originASN:          1,
  previousPeer:       2,
  myASN:              3, // collapsed My ASN nodes stay at 3, long-span link to nextPeer(6)
  myIngressInterface: 3,
  myRouter:           4,
  myEgressInterface:  5,
  nextPeer:           6,
  destinationASN:     7,
  destinationPO:      8,
};

// Label prefix by stage
const STAGE_LABEL_PREFIX: Partial<Record<SankeyStage, string>> = {
  myIngressInterface: '↓ ',
  myEgressInterface:  '↑ ',
};

export function SankeyDiagram({
  nodes,
  links,
  stageFilters,
  onNodeClick,
  onLinkClick,
  onStageToggle,
  onNodeToggleExpand,
  expandedASNs = new Set(),
  width = 900,
  height = 500,
}: SankeyDiagramProps) {
  const chartRef = useRef<ReactECharts>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Keep refs for stable event handlers
  const nodesRef = useRef(nodes);
  const linksRef = useRef(links);
  const onNodeClickRef = useRef(onNodeClick);
  const onLinkClickRef = useRef(onLinkClick);
  const onNodeToggleExpandRef = useRef(onNodeToggleExpand);
  const expandedASNsRef = useRef(expandedASNs);

  useEffect(() => {
    nodesRef.current = nodes;
    linksRef.current = links;
    onNodeClickRef.current = onNodeClick;
    onLinkClickRef.current = onLinkClick;
    onNodeToggleExpandRef.current = onNodeToggleExpand;
    expandedASNsRef.current = expandedASNs;
  }, [nodes, links, onNodeClick, onLinkClick, onNodeToggleExpand, expandedASNs]);

  const nodeById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Is any My ASN currently expanded? → determines which depth map to use
  const anyExpanded = useMemo(
    () => nodes.some(n =>
      n.stage === 'myIngressInterface' ||
      n.stage === 'myRouter' ||
      n.stage === 'myEgressInterface'
    ),
    [nodes]
  );
  const depthMap = anyExpanded ? DEPTH_EXPANDED : DEPTH_COMPACT;

  // ECharts node data
  const echartsNodes = useMemo(() =>
    nodes.map(node => {
      const stageColor = STAGE_COLORS[node.stage];
      // Fall back to stageFilters color for the 5 main ASN stages if defined
      const filterColor = stageFilters.find(f => f.stage === node.stage)?.color;
      const color = filterColor ?? stageColor ?? '#999';

      const prefix = STAGE_LABEL_PREFIX[node.stage] ?? '';
      const expandIcon = node.expandable ? (expandedASNs.has(node.id) ? '' : ' ▶') : '';

      return {
        name: node.id,
        depth: depthMap[node.stage] ?? 0,
        itemStyle: {
          color,
          borderRadius: node.nodeType === 'protectedObject' ? 8 : 3,
          borderWidth: node.nodeType === 'router' ? 2 : 0,
          borderColor: node.nodeType === 'router' ? '#0a7a6e' : undefined,
        },
        label: {
          formatter: () => `${prefix}${node.name}${expandIcon}`,
        },
      };
    }),
    [nodes, stageFilters, depthMap, expandedASNs]
  );

  const echartsLinks = useMemo(() =>
    links.map(link => ({
      source: link.source,
      target: link.target,
      value: link.value,
    })),
    [links]
  );

  const enabledCount = stageFilters.filter(f => f.enabled).length;

  const option: EChartsOption = useMemo(() => ({
    tooltip: { show: false },
    series: [{
      type: 'sankey',
      data: echartsNodes,
      links: echartsLinks,
      emphasis: {
        focus: 'adjacency',
        lineStyle: { opacity: 0.7 },
      },
      lineStyle: {
        color: 'gradient',
        curveness: 0.5,
        opacity: 0.4,
      },
      label: {
        show: true,
        fontSize: 11,
        color: '#374151',
      },
      nodeWidth: 20,
      nodeGap: 12,
      layoutIterations: 32,
      left: 20,
      right: 20,
      top: 20,
      bottom: 10,
    }],
  }), [echartsNodes, echartsLinks]);

  const setCursor = (cursor: string) => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const dom = instance.getDom();
    dom.style.cursor = cursor;
    const svg = dom.querySelector('svg');
    if (svg) (svg as SVGElement).style.cursor = cursor;
  };

  const onEvents = useMemo(() => ({
    click: (params: EChartsEventParams) => {
      if (params.dataType !== 'node') {
        if (params.dataType === 'edge') {
          const link = linksRef.current.find(
            l => l.source === params.data?.source && l.target === params.data?.target
          );
          if (link && onLinkClickRef.current) onLinkClickRef.current(link);
        }
        return;
      }

      const node = nodesRef.current.find(n => n.id === params.data?.name);
      if (!node) return;

      if (node.expandable) {
        // Collapsed My ASN → expand
        onNodeToggleExpandRef.current?.(node.id);
      } else if (node.stage === 'myIngressInterface' || node.stage === 'myEgressInterface') {
        // Clicking ingress/egress interface collapses the parent ASN
        if (node.parentAsnId) onNodeToggleExpandRef.current?.(node.parentAsnId);
      } else if (node.stage === 'myRouter') {
        // Router click → open detail popup
        onNodeClickRef.current?.(node);
      }
    },

    mouseover: (params: EChartsEventParams) => {
      const clientX = params.event?.event?.clientX ?? 0;
      const clientY = params.event?.event?.clientY ?? 0;

      if (params.dataType === 'node') {
        const node = nodesRef.current.find(n => n.id === params.data?.name);
        if (!node) return;

        const isClickable =
          node.expandable ||
          node.stage === 'myRouter' ||
          node.stage === 'myIngressInterface' ||
          node.stage === 'myEgressInterface';
        setCursor(isClickable ? 'pointer' : 'default');
        setTooltip({ type: 'node', data: node, x: clientX, y: clientY });

      } else if (params.dataType === 'edge') {
        setCursor('pointer');
        const link = linksRef.current.find(
          l => l.source === params.data?.source && l.target === params.data?.target
        );
        if (link) setTooltip({ type: 'link', data: link, x: clientX, y: clientY });
      }
    },

    mouseout: () => { setCursor('default'); setTooltip(null); },
    globalout: () => { setCursor('default'); setTooltip(null); },
  }), []);

  // ── Tooltip rendering ────────────────────────────────────────────────────────
  const renderTooltip = () => {
    if (!tooltip) return null;

    if (tooltip.type === 'node') {
      const node = tooltip.data as SankeyNode;

      // Determine action hint based on node type
      let hint: string | null = null;
      if (node.expandable) hint = 'Click to expand routers & interfaces';
      else if (node.stage === 'myIngressInterface' || node.stage === 'myEgressInterface') hint = 'Click to collapse';
      else if (node.stage === 'myRouter') hint = 'Click for router details';

      return (
        <div className={styles.tooltip} style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}>
          <div className={styles.tooltipHeader}>
            {node.nodeType === 'protectedObject' ? `${node.name}` : node.name}
            {node.asnNumber > 0 && node.nodeType === 'asn' && (
              <span className={styles.tooltipAsn}> (AS{node.asnNumber})</span>
            )}
          </div>

          {node.prefix && (
            <div className={styles.tooltipRow}>
              <span>Prefix:</span>
              <span className={styles.tooltipMono}>{node.prefix}</span>
            </div>
          )}

          {(node.stage === 'myIngressInterface' || node.stage === 'myEgressInterface') && (
            <div className={styles.tooltipRow}>
              <span>Router:</span>
              <span>{node.routerDisplayName}</span>
            </div>
          )}

          {(node.stage === 'myIngressInterface' || node.stage === 'myEgressInterface') && (
            <div className={styles.tooltipRow}>
              <span>Direction:</span>
              <span>{node.interfaceDir === 'ingress' ? '↓ Ingress' : '↑ Egress'}</span>
            </div>
          )}

          <div className={styles.tooltipRow}>
            <span>Traffic:</span>
            <span>{node.trafficGbps.toFixed(1)} Gbps</span>
          </div>

          {node.country && (
            <div className={styles.tooltipRow}>
              <span>Location:</span>
              <span>{[node.city, node.country].filter(Boolean).join(', ')}</span>
            </div>
          )}

          {node.stage !== 'originASN' && node.stage !== 'originPO' && node.inFlows > 0 && (
            <div className={styles.tooltipRow}>
              <span>In Flows:</span>
              <span>{node.inFlows}</span>
            </div>
          )}

          {node.stage !== 'destinationASN' && node.stage !== 'destinationPO' && node.outFlows > 0 && (
            <div className={styles.tooltipRow}>
              <span>Out Flows:</span>
              <span>{node.outFlows}</span>
            </div>
          )}

          {hint && <div className={styles.tooltipHint}>{hint}</div>}
        </div>
      );
    }

    if (tooltip.type === 'link') {
      const link = tooltip.data as SankeyLink;
      const sourceNode = nodeById.get(link.source);
      const targetNode = nodeById.get(link.target);

      return (
        <div className={styles.tooltip} style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}>
          <div className={styles.tooltipHeader}>
            {sourceNode?.name} → {targetNode?.name}
          </div>
          <div className={styles.tooltipRow}>
            <span>Traffic:</span>
            <span>{link.trafficGbps.toFixed(1)} Gbps</span>
          </div>
          <div className={styles.tooltipRow}>
            <span>Top Protocol:</span>
            <span>{link.topProtocol}</span>
          </div>
          <div className={styles.tooltipRow}>
            <span>Top Application:</span>
            <span>{link.topApplication.name}: {link.topApplication.port}</span>
          </div>
          <div className={styles.tooltipHint}>Click to view flow details</div>
        </div>
      );
    }

    return null;
  };

  // ── Legend ───────────────────────────────────────────────────────────────────
  // Shows the 5 main stage filters + PO and interface indicators when relevant
  const renderLegend = () => {
    const hasPO = nodes.some(n => n.stage === 'originPO' || n.stage === 'destinationPO');
    const hasExpanded = anyExpanded;

    return (
      <div className={styles.legend}>
        {/* Main stage toggles */}
        {stageFilters.map(f => {
          const canToggle = f.enabled ? enabledCount > 2 : true;
          return (
            <div
              key={f.stage}
              className={`${styles.legendItem} ${!f.enabled ? styles.legendItemDisabled : ''} ${!canToggle ? styles.legendItemLocked : ''}`}
              onClick={() => canToggle && onStageToggle?.(f.stage)}
              title={!canToggle ? 'At least 2 stages must remain visible' : f.enabled ? `Hide ${f.label}` : `Show ${f.label}`}
            >
              <span className={styles.legendDot} style={{ backgroundColor: f.enabled ? f.color : undefined }} />
              <span className={styles.legendLabel}>{f.label}</span>
            </div>
          );
        })}

        {/* Informational PO indicator */}
        {hasPO && (
          <div className={`${styles.legendItem} ${styles.legendItemInfo}`} title="Protected Object prefixes">
            <span className={styles.legendDot} style={{ backgroundColor: '#FED7AA', border: '1px solid #F97316' }} />
            <span className={styles.legendLabel}>Protected Objects</span>
          </div>
        )}

        {/* Informational expanded interface indicator */}
        {hasExpanded && (
          <>
            <div className={`${styles.legendItem} ${styles.legendItemInfo}`} title="Ingress interface (click to collapse)">
              <span className={styles.legendDot} style={{ backgroundColor: STAGE_COLORS.myIngressInterface }} />
              <span className={styles.legendLabel}>↓ Ingress</span>
            </div>
            <div className={`${styles.legendItem} ${styles.legendItemInfo}`} title="Router node (click for details)">
              <span className={styles.legendDot} style={{ backgroundColor: STAGE_COLORS.myRouter }} />
              <span className={styles.legendLabel}>Router</span>
            </div>
            <div className={`${styles.legendItem} ${styles.legendItemInfo}`} title="Egress interface (click to collapse)">
              <span className={styles.legendDot} style={{ backgroundColor: STAGE_COLORS.myEgressInterface }} />
              <span className={styles.legendLabel}>↑ Egress</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge
        style={{ width, height: height - 30 }}
        opts={{ renderer: 'svg' }}
        onEvents={onEvents}
      />
      {renderLegend()}
      {renderTooltip()}
    </div>
  );
}
