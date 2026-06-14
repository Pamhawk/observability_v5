import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  /** Called when the My-ASN expand/collapse icon is clicked */
  onNodeToggleExpand?: (nodeId: string) => void;
  expandedASNs?: Set<string>;
  /** Pre-computed column depths from parent */
  dynamicDepths?: Record<string, number>;
  width?: number;
  height?: number;
  /** Global expand/collapse all handlers */
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  allExpanded?: boolean;
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

interface NodeLayout {
  x: number; y: number; width: number; height: number;
}

// ── Node colors by stage ───────────────────────────────────────────────────
const STAGE_COLORS: Record<SankeyStage, string> = {
  originASN:          '#F97316',  // orange
  previousPeer:       '#9333EA',  // proper purple
  upstreamPO:         '#818CF8',  // indigo  (left of teal, cool)
  myASN:              '#14B8A6',  // teal
  myIngressInterface: '#99F6E4',  // light teal
  myRouter:           '#0E9F8E',  // dark teal
  downstreamPO:       '#FB923C',  // amber   (right of teal, warm)
  nextPeer:           '#9333EA',  // proper purple (symmetric with previousPeer)
  destinationASN:     '#EC4899',  // pink
};

// ECharts series margins — keep in sync with the series option below
const CHART_LEFT = 80;
const CHART_TOP  = 20;

// Label prefix by stage
const STAGE_LABEL_PREFIX: Partial<Record<SankeyStage, string>> = {
  myIngressInterface: '↓ ',
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
  dynamicDepths = {},
  width = 900,
  height = 500,
  onExpandAll,
  onCollapseAll,
  allExpanded = false,
}: SankeyDiagramProps) {
  const chartRef = useRef<ReactECharts>(null);
  const containerDivRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [nodeLayouts, setNodeLayouts] = useState<Record<string, NodeLayout>>({});

  // Stable refs so event handlers don't become stale
  const nodesRef = useRef(nodes);
  const linksRef = useRef(links);
  const onNodeClickRef = useRef(onNodeClick);
  const onLinkClickRef = useRef(onLinkClick);
  const onNodeToggleExpandRef = useRef(onNodeToggleExpand);

  useEffect(() => {
    nodesRef.current = nodes;
    linksRef.current = links;
    onNodeClickRef.current = onNodeClick;
    onLinkClickRef.current = onLinkClick;
    onNodeToggleExpandRef.current = onNodeToggleExpand;
  }, [nodes, links, onNodeClick, onLinkClick, onNodeToggleExpand]);

  const nodeById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // ── ECharts options ───────────────────────────────────────────────────────
  const echartsNodes = useMemo(() =>
    nodes.map(node => {
      const filterColor = stageFilters.find(f => f.stage === node.stage)?.color;
      const color = filterColor ?? STAGE_COLORS[node.stage] ?? '#999';
      const prefix = STAGE_LABEL_PREFIX[node.stage] ?? '';
      const isPO = node.nodeType === 'protectedObject';

      const isPeer = node.stage === 'previousPeer' || node.stage === 'nextPeer';

      return {
        name: node.id,
        depth: dynamicDepths[node.stage] ?? 0,
        itemStyle: {
          color,
          opacity:      isPeer ? 0.35 : 1,
          borderRadius: isPO ? 8 : (node.nodeType === 'router' ? 4 : 3),
          borderWidth:  node.nodeType === 'router' ? 2 : 0,
          borderColor:  node.nodeType === 'router' ? '#0a7a6e' : undefined,
        },
        label: { formatter: () => `${prefix}${node.name}` },
      };
    }),
    [nodes, stageFilters, dynamicDepths],
  );

  const echartsLinks = useMemo(() => {
    // PO nodes are transparent, so links connected to them must not use the PO
    return links.map(l => ({ source: l.source, target: l.target, value: l.value }));
  }, [links, nodes]);

  const option: EChartsOption = useMemo(() => ({
    tooltip: { show: false },
    series: [{
      type: 'sankey',
      data: echartsNodes,
      links: echartsLinks,
      emphasis: { focus: 'adjacency', lineStyle: { opacity: 0.7 } },
      lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.4 },
      label: { show: true, fontSize: 11, color: '#374151' },
      nodeWidth: 24,
      nodeGap: 48,
      layoutIterations: 32,
      left: CHART_LEFT, right: 150, top: CHART_TOP, bottom: 10,
    }],
  }), [echartsNodes, echartsLinks]);

  // ── Read node positions from ECharts after render ─────────────────────────
  const updateNodeLayouts = useCallback(() => {
    try {
      const instance = chartRef.current?.getEchartsInstance();
      if (!instance) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seriesModel = (instance as any).getModel().getSeries()[0];
      if (!seriesModel) return;
      const data = seriesModel.getData();
      const layouts: Record<string, NodeLayout> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.each((idx: number) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layout = data.getItemLayout(idx) as any;
        const name = data.getName(idx) as string;
        if (layout && name) {
          layouts[name] = {
            x: layout.x ?? 0,
            y: layout.y ?? 0,
            // ECharts Sankey uses `dx` (not `width`) for node bar width
            width: layout.dx ?? layout.width ?? 24,
            height: layout.dy ?? layout.height ?? 0,
          };
        }
      });
      setNodeLayouts(layouts);
    } catch {
      // ECharts internal API unavailable — icons won't render
    }
  }, []);

  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    instance.on('finished', updateNodeLayouts);
    return () => { instance.off('finished', updateNodeLayouts); };
  }, [updateNodeLayouts]);

  // Also update layouts whenever option changes (re-render)
  useEffect(() => {
    const id = setTimeout(updateNodeLayouts, 80);
    return () => clearTimeout(id);
  }, [option, updateNodeLayouts]);

  // Re-anchor overlay buttons whenever the container is resized
  useEffect(() => {
    const el = containerDivRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setTimeout(updateNodeLayouts, 80);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateNodeLayouts]);

  // ── Cursor helper ─────────────────────────────────────────────────────────
  const setCursor = (cursor: string) => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const dom = instance.getDom();
    dom.style.cursor = cursor;
    const svg = dom.querySelector('svg');
    if (svg) (svg as SVGElement).style.cursor = cursor;
  };

  // ── Event handlers ────────────────────────────────────────────────────────
  const onEvents = useMemo(() => ({
    // ALL node clicks open the info popup; expand/collapse is icon-only
    click: (params: EChartsEventParams) => {
      if (params.dataType === 'node') {
        const node = nodesRef.current.find(n => n.id === params.data?.name);
        if (node) onNodeClickRef.current?.(node);
      } else if (params.dataType === 'edge') {
        const link = linksRef.current.find(
          l => l.source === params.data?.source && l.target === params.data?.target,
        );
        if (link) onLinkClickRef.current?.(link);
      }
    },

    mouseover: (params: EChartsEventParams) => {
      const cx = params.event?.event?.clientX ?? 0;
      const cy = params.event?.event?.clientY ?? 0;
      if (params.dataType === 'node') {
        const node = nodesRef.current.find(n => n.id === params.data?.name);
        if (!node) return;
        setCursor('pointer');
        setTooltip({ type: 'node', data: node, x: cx, y: cy });
      } else if (params.dataType === 'edge') {
        setCursor('pointer');
        const link = linksRef.current.find(
          l => l.source === params.data?.source && l.target === params.data?.target,
        );
        if (link) setTooltip({ type: 'link', data: link, x: cx, y: cy });
      }
    },

    mouseout:  () => { setCursor('default'); setTooltip(null); },
    globalout: () => { setCursor('default'); setTooltip(null); },
  }), []);

  // ── Overlay expand/collapse icons ─────────────────────────────────────────
  const renderExpandIcons = () => {
    const icons: React.ReactNode[] = [];

    for (const node of nodes) {
      const layout = nodeLayouts[node.id];
      if (!layout || layout.height < 6) continue;

      // ECharts layout coords are in chart-area space (origin inside the margins).
      // Add CHART_LEFT / CHART_TOP to convert to container-relative pixel coords.
      const right = layout.x + CHART_LEFT + layout.width + 3;
      const topY  = layout.y + CHART_TOP  + 4;

      // ── My ASN expand icon (on collapsed expandable My ASN nodes) ──────
      if (node.expandable && node.stage === 'myASN') {
        const isExpanded = expandedASNs.has(node.id);
        icons.push(
          <button
            key={`myasn-${node.id}`}
            className={`${styles.iconBtn} ${styles.iconBtnTeal}`}
            style={{ left: right, top: topY }}
            title={isExpanded ? 'Collapse routers & interfaces' : 'Expand routers & interfaces'}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onNodeToggleExpandRef.current?.(node.id); }}
          >
            {isExpanded ? '◀' : '▶'}
          </button>,
        );
      }

      // ── My ASN collapse icon (on router nodes, to collapse back) ───────
      if (node.stage === 'myRouter' && node.parentAsnId) {
        icons.push(
          <button
            key={`collapse-${node.id}`}
            className={`${styles.iconBtn} ${styles.iconBtnTealOutline}`}
            style={{ left: right, top: topY }}
            title="Collapse back to ASN node"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onNodeToggleExpandRef.current?.(node.parentAsnId!); }}
          >
            ✕
          </button>,
        );
      }
    }

    return icons;
  };

  // ── Tooltip rendering ─────────────────────────────────────────────────────
  const renderTooltip = () => {
    if (!tooltip) return null;

    if (tooltip.type === 'node') {
      const node = tooltip.data as SankeyNode;
      let hint: string | null = null;
      if (node.expandable) hint = 'Click ▶ to expand routers & interfaces';
      else if (node.stage === 'myRouter') hint = 'Click node for details · ✕ to collapse';
      else hint = 'Click node for details';

      return (
        <div className={styles.tooltip} style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}>
          <div className={styles.tooltipHeader}>
            {node.name}
            {node.asnNumber > 0 && node.nodeType === 'asn' && (
              <span className={styles.tooltipAsn}> (AS{node.asnNumber})</span>
            )}
          </div>
          {node.prefixes && node.prefixes.length > 0 && (
            <div className={styles.tooltipPrefixes}>
              <div className={styles.tooltipPrefixLabel}>Protected Prefixes</div>
              {node.prefixes.slice(0, 3).map(p => (
                <div key={p} className={styles.tooltipMono}>{p}</div>
              ))}
              {node.prefixes.length > 3 && (
                <div className={styles.tooltipPrefixMore}>+{node.prefixes.length - 3} more</div>
              )}
            </div>
          )}
          {node.stage === 'myIngressInterface' && (
            <>
              <div className={styles.tooltipRow}>
                <span>Router:</span><span>{node.routerDisplayName}</span>
              </div>
              <div className={styles.tooltipRow}>
                <span>Direction:</span>
                <span>{node.interfaceDir === 'ingress' ? '↓ Ingress' : '↑ Egress'}</span>
              </div>
            </>
          )}
          <div className={styles.tooltipRow}>
            <span>Traffic:</span><span>{node.trafficGbps.toFixed(1)} Gbps</span>
          </div>
          {node.country && (
            <div className={styles.tooltipRow}>
              <span>Location:</span>
              <span>{[node.city, node.country].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {node.stage !== 'originASN' && node.inFlows > 0 && (
            <div className={styles.tooltipRow}><span>In Flows:</span><span>{node.inFlows}</span></div>
          )}
          {node.stage !== 'destinationASN' && node.outFlows > 0 && (
            <div className={styles.tooltipRow}><span>Out Flows:</span><span>{node.outFlows}</span></div>
          )}
          {hint && <div className={styles.tooltipHint}>{hint}</div>}
        </div>
      );
    }

    if (tooltip.type === 'link') {
      const link = tooltip.data as SankeyLink;
      const srcNode = nodeById.get(link.source);
      const dstNode = nodeById.get(link.target);
      return (
        <div className={styles.tooltip} style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}>
          <div className={styles.tooltipHeader}>{srcNode?.name} → {dstNode?.name}</div>
          <div className={styles.tooltipRow}><span>Traffic:</span><span>{link.trafficGbps.toFixed(1)} Gbps</span></div>
          <div className={styles.tooltipRow}><span>Top Protocol:</span><span>{link.topProtocol}</span></div>
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

  // ── Legend ────────────────────────────────────────────────────────────────
  const enabledCount = stageFilters.filter(f => f.enabled).length;
  const anyExpanded = nodes.some(n =>
    n.stage === 'myIngressInterface' || n.stage === 'myRouter',
  );

  const renderLegend = () => {
    const hasUPO = nodes.some(n => n.stage === 'upstreamPO');
    const hasDPO = nodes.some(n => n.stage === 'downstreamPO');
    // Show all view-specific stage toggles; PO stages rendered as info-only items
    const PO_STAGES = new Set(['upstreamPO', 'downstreamPO']);
    const toggleableFilters = stageFilters.filter(f => !PO_STAGES.has(f.stage));

    return (
      <div className={styles.legend}>
        <div className={styles.legendItems}>
          {toggleableFilters.map(f => {
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
          {hasUPO && (
            <div className={`${styles.legendItem} ${styles.legendItemInfo}`}>
              <span className={styles.legendDot} style={{ backgroundColor: STAGE_COLORS.upstreamPO }} />
              <span className={styles.legendLabel}>Upstream PO</span>
            </div>
          )}
          {hasDPO && (
            <div className={`${styles.legendItem} ${styles.legendItemInfo}`}>
              <span className={styles.legendDot} style={{ backgroundColor: STAGE_COLORS.downstreamPO }} />
              <span className={styles.legendLabel}>Downstream PO</span>
            </div>
          )}
          {anyExpanded && (
            <>
              <div className={`${styles.legendItem} ${styles.legendItemInfo}`}>
                <span className={styles.legendDot} style={{ backgroundColor: STAGE_COLORS.myIngressInterface }} />
                <span className={styles.legendLabel}>↓ Ingress</span>
              </div>
              <div className={`${styles.legendItem} ${styles.legendItemInfo}`}>
                <span className={styles.legendDot} style={{ backgroundColor: STAGE_COLORS.myRouter }} />
                <span className={styles.legendLabel}>Router</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const showExpandToggle = onExpandAll !== undefined || onCollapseAll !== undefined;

  return (
    <div className={styles.container} ref={containerDivRef}>
      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge
        style={{ width, height: height - 30 }}
        opts={{ renderer: 'svg' }}
        onEvents={onEvents}
      />
      {/* Expand/collapse icon overlays */}
      {renderExpandIcons()}
      {/* Expand / Collapse All toggle — top-right of chart area */}
      {showExpandToggle && (
        <button
          className={styles.expandToggleBtn}
          onClick={anyExpanded ? onCollapseAll : onExpandAll}
          title={anyExpanded ? 'Collapse all My ASN nodes' : 'Expand all My ASN nodes'}
        >
          {anyExpanded ? '⊟ Collapse All' : '⊞ Expand All'}
        </button>
      )}
      {renderLegend()}
      {renderTooltip()}
    </div>
  );
}
