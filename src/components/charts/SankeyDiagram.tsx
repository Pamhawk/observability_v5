import { useState, useRef, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { SankeyNode, SankeyLink, StageFilter } from '../../types';
import styles from './SankeyDiagram.module.css';

interface SankeyDiagramProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  stageFilters: StageFilter[];
  onNodeClick?: (node: SankeyNode) => void;
  onLinkClick?: (link: SankeyLink) => void;
  onStageToggle?: (stage: string) => void;
  width?: number;
  height?: number;
}

interface TooltipData {
  type: 'node' | 'link';
  data: SankeyNode | SankeyLink;
  x: number;
  y: number;
}

interface EChartsLabelParams {
  name: string;
}

interface EChartsEventParams {
  dataType?: string;
  data?: { name?: string; source?: string; target?: string };
  event?: { event?: { clientX?: number; clientY?: number } };
}

const STAGE_DEPTH: Record<string, number> = {
  originASN: 0,
  previousPeer: 1,
  myASN: 2,
  nextPeer: 3,
  destinationASN: 4,
};

export function SankeyDiagram({
  nodes,
  links,
  stageFilters,
  onNodeClick,
  onLinkClick,
  onStageToggle,
  width = 900,
  height = 500,
}: SankeyDiagramProps) {
  const chartRef = useRef<ReactECharts>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Keep refs for stable event handlers
  const nodesRef = useRef(nodes);
  const linksRef = useRef(links);
  const stageFiltersRef = useRef(stageFilters);
  const onNodeClickRef = useRef(onNodeClick);
  const onLinkClickRef = useRef(onLinkClick);

  useEffect(() => {
    nodesRef.current = nodes;
    linksRef.current = links;
    stageFiltersRef.current = stageFilters;
    onNodeClickRef.current = onNodeClick;
    onLinkClickRef.current = onLinkClick;
  }, [nodes, links, stageFilters, onNodeClick, onLinkClick]);

  // Node lookup
  const nodeById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // ECharts node data — depth forces column position, itemStyle sets stage color
  const echartsNodes = useMemo(() =>
    nodes.map(node => ({
      name: node.id,
      depth: STAGE_DEPTH[node.stage] ?? 0,
      itemStyle: {
        color: stageFilters.find(f => f.stage === node.stage)?.color ?? '#999',
        borderRadius: 3,
        borderWidth: 0,
      },
    })),
    [nodes, stageFilters],
  );

  // ECharts link data
  const echartsLinks = useMemo(() =>
    links.map(link => ({
      source: link.source,
      target: link.target,
      value: link.value,
    })),
    [links],
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
        formatter: (params: EChartsLabelParams) => {
          const node = nodesRef.current.find(n => n.id === params.name);
          return node?.name || params.name;
        },
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

  // Helper: set cursor on both container and inner SVG (SVG renderer absorbs pointer events)
  const setCursor = (cursor: string) => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const dom = instance.getDom();
    dom.style.cursor = cursor;
    const svg = dom.querySelector('svg');
    if (svg) (svg as SVGElement).style.cursor = cursor;
  };

  // Stable event handlers via refs
  const onEvents = useMemo(() => ({
    click: (params: EChartsEventParams) => {
      if (params.dataType === 'node') {
        const node = nodesRef.current.find(n => n.id === params.data?.name);
        if (node?.isMyASN && onNodeClickRef.current) {
          onNodeClickRef.current(node);
        }
      } else if (params.dataType === 'edge') {
        const link = linksRef.current.find(
          l => l.source === params.data?.source && l.target === params.data?.target
        );
        if (link && onLinkClickRef.current) {
          onLinkClickRef.current(link);
        }
      }
    },
    mouseover: (params: EChartsEventParams) => {
      const clientX = params.event?.event?.clientX ?? 0;
      const clientY = params.event?.event?.clientY ?? 0;

      if (params.dataType === 'node') {
        const node = nodesRef.current.find(n => n.id === params.data?.name);
        setCursor(node?.isMyASN ? 'pointer' : 'default');
        if (node) {
          setTooltip({ type: 'node', data: node, x: clientX, y: clientY });
        }
      } else if (params.dataType === 'edge') {
        setCursor('pointer');
        const link = linksRef.current.find(
          l => l.source === params.data?.source && l.target === params.data?.target
        );
        if (link) {
          setTooltip({ type: 'link', data: link, x: clientX, y: clientY });
        }
      }
    },
    mouseout: () => {
      setCursor('default');
      setTooltip(null);
    },
    globalout: () => {
      setCursor('default');
      setTooltip(null);
    },
  }), []); // Stable — handlers use refs

  const renderTooltip = () => {
    if (!tooltip) return null;

    if (tooltip.type === 'node') {
      const node = tooltip.data as SankeyNode;
      return (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
        >
          <div className={styles.tooltipHeader}>
            {node.name} (AS{node.asnNumber})
          </div>
          <div className={styles.tooltipRow}>
            <span>Traffic:</span>
            <span>{node.trafficGbps.toFixed(1)} Gbps</span>
          </div>
          <div className={styles.tooltipRow}>
            <span>Country:</span>
            <span>{node.country}</span>
          </div>
          {node.state && (
            <div className={styles.tooltipRow}>
              <span>State:</span>
              <span>{node.state}</span>
            </div>
          )}
          {node.city && (
            <div className={styles.tooltipRow}>
              <span>City:</span>
              <span>{node.city}</span>
            </div>
          )}
          {node.stage !== 'originASN' && (
            <div className={styles.tooltipRow}>
              <span>In Flows:</span>
              <span>{node.inFlows}</span>
            </div>
          )}
          {node.stage !== 'destinationASN' && (
            <div className={styles.tooltipRow}>
              <span>Out Flows:</span>
              <span>{node.outFlows}</span>
            </div>
          )}
          {node.isMyASN && (
            <div className={styles.tooltipHint}>Click to view details</div>
          )}
        </div>
      );
    }

    if (tooltip.type === 'link') {
      const link = tooltip.data as SankeyLink;
      const sourceNode = nodeById.get(link.source);
      const targetNode = nodeById.get(link.target);

      return (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
        >
          <div className={styles.tooltipHeader}>
            {sourceNode?.name} ({sourceNode?.asnNumber}) → {targetNode?.name} ({targetNode?.asnNumber})
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
      {/* Legend — click to toggle stage visibility */}
      <div className={styles.legend}>
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
      </div>
      {renderTooltip()}
    </div>
  );
}
