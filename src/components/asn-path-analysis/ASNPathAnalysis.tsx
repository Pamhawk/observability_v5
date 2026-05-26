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
  sankeyLinks,
  defaultStageFilters,
} from '../../data/mockData';
import type { SankeyNode, SankeyLink, StageFilter, TimeRange } from '../../types';
import styles from './ASNPathAnalysis.module.css';

export function ASNPathAnalysis() {
  const [stageFilters, setStageFilters] = useState<StageFilter[]>(defaultStageFilters);
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    preset: '1h',
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date(),
  }));
  const [selectedNode, setSelectedNode] = useState<SankeyNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<SankeyLink | null>(null);

  const handleStageVisibilityToggle = useCallback((stage: string) => {
    const enabledCount = stageFilters.filter(f => f.enabled).length;
    const targetFilter = stageFilters.find(f => f.stage === stage);
    // Prevent disabling if only 2 stages are enabled and this one is enabled
    if (targetFilter?.enabled && enabledCount <= 2) return;

    setStageFilters(prev => prev.map(f =>
      f.stage === stage ? { ...f, enabled: !f.enabled } : f
    ));
  }, [stageFilters]);

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

  // Filter nodes and links based on stage filters
  const filteredData = useMemo(() => {
    const enabledStages = stageFilters.filter(f => f.enabled).map(f => f.stage);

    // Filter nodes by enabled stages and selected ASNs
    const filteredNodes = sankeyNodes.filter(node => {
      if (!enabledStages.includes(node.stage)) return false;

      const stageFilter = stageFilters.find(f => f.stage === node.stage);
      if (stageFilter && stageFilter.selectedASNs.length > 0) {
        return stageFilter.selectedASNs.includes(node.asnNumber);
      }
      return true;
    });

    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

    // Filter links to only include those between filtered nodes
    const filteredLinks = sankeyLinks.filter(
      link => filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target)
    );

    return { nodes: filteredNodes, links: filteredLinks };
  }, [stageFilters]);

  const handleNodeClick = (node: SankeyNode) => {
    if (node.isMyASN) {
      setSelectedNode(node);
    }
  };

  const handleLinkClick = (link: SankeyLink) => {
    setSelectedLink(link);
  };

  const handleDownloadPNG = () => {
    // Get the SVG element
    const svgElement = document.querySelector('.sankey-container svg');
    if (!svgElement) return;

    // Create a canvas
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

      {/* Stage Filters */}
      <StageFilters
        filters={stageFilters}
        nodes={sankeyNodes}
        onChange={setStageFilters}
      />

      {/* Sankey Diagram — fills available space */}
      <Card className={styles.chartCard} noPadding>
        <div className={styles.sankeyRow}>
          <div className={`sankey-container ${styles.sankeyContainer}`} ref={chartRef}>
            <SankeyDiagram
              nodes={filteredData.nodes}
              links={filteredData.links}
              stageFilters={stageFilters}
              onNodeClick={handleNodeClick}
              onLinkClick={handleLinkClick}
              onStageToggle={handleStageVisibilityToggle}
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
