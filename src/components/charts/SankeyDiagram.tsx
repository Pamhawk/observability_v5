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
  originASN:          '#F97316',
  previousPeer:       '#8B5CF6',
  upstreamPO:         '#6EE7B7',
  myASN:              '#14B8A6',
  myIngressInterface: '#99F6E4',
  myRouter:           '#0E9F8E',
  myEgressInterface:  '#0D9488',
  downstreamPO:       '#5EEAD4',
  nextPeer:           '#3B82F6',
  destinationASN:     '#EC4899',
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
  dynamicDepths = {},
  width = 900,
  height = 500,
}: SankeyDiagramProps) {
  const chartRef = useRef<ReactECharts>(null);
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

      return {
        name: node.id,
        depth: dynamicDepths[node.stage] ?? 0,
        itemStyle: {
          color,
          borderRadius: node.nodeType === 'protectedObject' ? 8 : 3,
          borderWidth: node.nodeType === 'router' ? 2 : 0,
          borderColor: node.nodeType === 'router' ? '#0a7a6e' : undefined,
        },
        label: { formatter: () => `${prefix}${node.name}` },
      };
    }),
    [nodes, stageFilters, dynamicDepths],
  );

  const echartsLinks = useMemo(() =>
    links.map(l => ({ source: l.source, target: l.target, value: l.value })),
    [links],
  );

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
      left: 80, right: 150, top: 20, bottom: 10,
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
            width: layout.width ?? 20,
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
    // Small delay to let ECharts finish layout
    const id = setTimeout(updateNodeLayouts, 50);
    return () => clearTimeout(id);
  }, [option, updateNodeLayouts]);

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

      const right = layout.x + layout.width + 3;
      const midY = layout.y + layout.height / 2 - 8;

      // ── My ASN expand icon (on collapsed expandable My ASN nodes) ──────
      if (node.expandable && node.stage === 'myASN') {
        const isExpanded = expandedASNs.has(node.id);
        icons.push(
          <button
            key={`myasn-${node.id}`}
            className={`${styles.iconBtn} ${styles.iconBtnTeal}`}
            style={{ left: right, top: midY }}
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
            style={{ left: right, top: midY }}
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
          {node.prefix && (
            <div className={styles.tooltipRow}>
              <span>Prefix:</span>
              <span className={styles.tooltipMono}>{node.prefix}</span>
            </div>
          )}
          {(node.stage === 'myIngressInterface' || node.stage === 'myEgressInterface') && (
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
    n.stage === 'myIngressInterface' || n.stage === 'myRouter' || n.stage === 'myEgressInterface',
  );

  const renderLegend = () => {
    const hasPO = nodes.some(n =>
      n.stage === 'upstreamPO' || n.stage === 'downstreamPO',
    );
    // Only show the 5 main ASN stage toggles in legend; PO / sub-stage info items are contextual
    const mainFilters = stageFilters.filter(f =>
      ['originASN','previousPeer','myASN','nextPeer','destinationASN'].includes(f.stage),
    );

    return (
      <div className={styles.legend}>
        {mainFilters.map(f => {
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
        {hasPO && (
          <div className={`${styles.legendItem} ${styles.legendItemInfo}`}>
            <span className={styles.legendDot} style={{ backgroundColor: '#6EE7B7', border: '1px solid #14B8A6' }} />
            <span className={styles.legendLabel}>Protected Objects</span>
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
            <div className={`${styles.legendItem} ${styles.legendItemInfo}`}>
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
      {/* Expand/collapse icon overlays */}
      {renderExpandIcons()}
      {renderLegend()}
      {renderTooltip()}
    </div>
  );
}
