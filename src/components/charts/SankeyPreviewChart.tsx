import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { SankeyNodeData, SankeyLinkData } from '../../utils';


interface SankeyPreviewChartProps {
  height?: number;
  nodes?: SankeyNodeData[];
  links?: SankeyLinkData[];
}

const defaultNodes: SankeyNodeData[] = [
  { name: 'Google (15169)', asnNumber: '15169', trafficGbps: 45.2, country: 'United States', inFlows: 32100, outFlows: 28400 },
  { name: 'Cloudflare (13335)', asnNumber: '13335', trafficGbps: 38.5, country: 'United States', inFlows: 28500, outFlows: 24200 },
  { name: 'Amazon (16509)', asnNumber: '16509', trafficGbps: 32.1, country: 'United States', inFlows: 22800, outFlows: 19500 },
  { name: 'MyNet-Core (64512)', asnNumber: '64512', trafficGbps: 65.3, country: 'Germany', inFlows: 65000, outFlows: 65000 },
  { name: 'MyNet-West (64513)', asnNumber: '64513', trafficGbps: 50.8, country: 'France', inFlows: 50000, outFlows: 50000 },
  { name: 'Enterprise-A (65001)', asnNumber: '65001', trafficGbps: 33.2, country: 'Germany', inFlows: 33000, outFlows: 12000 },
  { name: 'Enterprise-B (65002)', asnNumber: '65002', trafficGbps: 47.1, country: 'United Kingdom', inFlows: 47000, outFlows: 15000 },
  { name: 'Enterprise-C (65003)', asnNumber: '65003', trafficGbps: 35.4, country: 'France', inFlows: 35000, outFlows: 10000 },
];

const defaultLinks: SankeyLinkData[] = [
  { source: 'Google (15169)', target: 'MyNet-Core (64512)', value: 25, trafficGbps: 25.0, topProtocol: 'TCP', topApplication: 'HTTPS/443' },
  { source: 'Google (15169)', target: 'MyNet-West (64513)', value: 20, trafficGbps: 20.0, topProtocol: 'TCP', topApplication: 'HTTPS/443' },
  { source: 'Cloudflare (13335)', target: 'MyNet-Core (64512)', value: 22, trafficGbps: 22.0, topProtocol: 'TCP', topApplication: 'HTTPS/443' },
  { source: 'Cloudflare (13335)', target: 'MyNet-West (64513)', value: 16, trafficGbps: 16.0, topProtocol: 'UDP', topApplication: 'QUIC/443' },
  { source: 'Amazon (16509)', target: 'MyNet-Core (64512)', value: 18, trafficGbps: 18.0, topProtocol: 'TCP', topApplication: 'HTTPS/443' },
  { source: 'Amazon (16509)', target: 'MyNet-West (64513)', value: 14, trafficGbps: 14.0, topProtocol: 'TCP', topApplication: 'HTTP/80' },
  { source: 'MyNet-Core (64512)', target: 'Enterprise-A (65001)', value: 33, trafficGbps: 33.0, topProtocol: 'TCP', topApplication: 'HTTPS/443' },
  { source: 'MyNet-Core (64512)', target: 'Enterprise-B (65002)', value: 32, trafficGbps: 32.0, topProtocol: 'TCP', topApplication: 'SSH/22' },
  { source: 'MyNet-West (64513)', target: 'Enterprise-B (65002)', value: 15, trafficGbps: 15.0, topProtocol: 'UDP', topApplication: 'DNS/53' },
  { source: 'MyNet-West (64513)', target: 'Enterprise-C (65003)', value: 35, trafficGbps: 35.0, topProtocol: 'TCP', topApplication: 'HTTPS/443' },
];

export function SankeyPreviewChart({ height = 280, nodes, links }: SankeyPreviewChartProps) {
  const chartNodes = nodes || defaultNodes;
  const chartLinks = links || defaultLinks;

  // Build a lookup for rich tooltips
  const nodeMap = new Map(chartNodes.map(n => [n.name, n]));

  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const node = nodeMap.get(params.name);
          if (node) {
            return `<div style="font-weight:600;margin-bottom:6px;">${node.name}${node.asnNumber ? ` (AS${node.asnNumber})` : ''}</div>
              <div style="display:flex;justify-content:space-between;gap:16px;"><span>Traffic:</span><span style="font-weight:500;">${node.trafficGbps?.toFixed(1) ?? '—'} Gbps</span></div>
              <div style="display:flex;justify-content:space-between;gap:16px;"><span>Country:</span><span style="font-weight:500;">${node.country ?? '—'}</span></div>
              <div style="display:flex;justify-content:space-between;gap:16px;"><span>In Flows:</span><span style="font-weight:500;">${node.inFlows?.toLocaleString() ?? '—'}</span></div>
              <div style="display:flex;justify-content:space-between;gap:16px;"><span>Out Flows:</span><span style="font-weight:500;">${node.outFlows?.toLocaleString() ?? '—'}</span></div>`;
          }
          return params.name;
        }
        if (params.dataType === 'edge') {
          const link = chartLinks.find(
            (l: SankeyLinkData) => l.source === params.data?.source && l.target === params.data?.target
          );
          const srcNode = nodeMap.get(params.data?.source ?? '');
          const tgtNode = nodeMap.get(params.data?.target ?? '');
          const srcLabel = srcNode?.asnNumber ? `${srcNode.name} (AS${srcNode.asnNumber})` : params.data?.source;
          const tgtLabel = tgtNode?.asnNumber ? `${tgtNode.name} (AS${tgtNode.asnNumber})` : params.data?.target;
          if (link) {
            return `<div style="font-weight:600;margin-bottom:6px;">${srcLabel} → ${tgtLabel}</div>
              <div style="display:flex;justify-content:space-between;gap:16px;"><span>Traffic:</span><span style="font-weight:500;">${link.trafficGbps?.toFixed(1) ?? link.value.toFixed(1)} Gbps</span></div>
              <div style="display:flex;justify-content:space-between;gap:16px;"><span>Top Protocol:</span><span style="font-weight:500;">${link.topProtocol ?? '—'}</span></div>
              <div style="display:flex;justify-content:space-between;gap:16px;"><span>Top Application:</span><span style="font-weight:500;">${link.topApplication ?? '—'}</span></div>`;
          }
          return `${params.data?.source} → ${params.data?.target}: ${params.data?.value}`;
        }
        return '';
      },
    },
    series: [
      {
        type: 'sankey',
        data: chartNodes.map(n => ({ name: n.name })),
        links: chartLinks.map(l => ({ source: l.source, target: l.target, value: l.value })),
        emphasis: {
          focus: 'adjacency',
        },
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
        },
        itemStyle: {
          borderWidth: 0,
        },
        label: {
          fontSize: 10,
          color: '#374151',
        },
        nodeWidth: 14,
        nodeGap: 10,
        layoutIterations: 32,
        left: 10,
        right: 10,
        top: 10,
        bottom: 10,
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      notMerge
      style={{ height, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
