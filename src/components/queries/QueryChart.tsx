import { useMemo } from 'react';
import { parseSQL } from '../../utils/sqlParser';
import { executeMockSQL } from '../../utils/sqlMockExecutor';
import { recommendCharts } from '../../utils/chartRecommender';
import { adaptTableToChart } from '../../utils/chartDataAdapter';
import type { ChartDataResult } from '../../utils';
import type { ChartConfig } from '../../types';
import {
  ChartExportWrapper,
  TimeSeriesChart,
  BarChart,
  PieChart,
  GaugeChart,
  GeoMapChart,
  HeatmapChart,
  SankeyPreviewChart,
  TableChart,
  MultiBarChart,
} from '../charts';

interface QueryChartProps {
  script: string;
  height: number;
  title?: string;
  timePreset?: string;
  chartConfig?: ChartConfig;
}

export function QueryChart({ script, height, title, timePreset = '1d', chartConfig }: QueryChartProps) {
  const chartData = useMemo<ChartDataResult | null>(() => {
    const parsed = parseSQL(script);
    if (!parsed) return null;
    const table = executeMockSQL(parsed, timePreset);
    // Use provided config, or auto-recommend the best chart
    const config = chartConfig || recommendCharts(table)[0]?.defaultConfig;
    if (!config) return null;
    return adaptTableToChart(table, config);
  }, [script, chartConfig, timePreset]);

  if (!chartData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height, color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Unable to parse query
      </div>
    );
  }

  const filename = (title || 'chart').replace(/\s+/g, '-').toLowerCase();

  const renderChart = () => {
    const cfg = chartConfig;
    switch (chartData.type) {
      case 'timeSeries': {
        const tsCfg = cfg?.chartType === 'timeSeries' || cfg?.chartType === 'stackedArea' ? cfg : null;
        return (
          <TimeSeriesChart
            dynamicSeries={chartData.dynamicSeries}
            timestamps={chartData.timestamps}
            unit={chartData.unit}
            height={height}
            stacked={chartData.stacked}
            yAxisLabel={tsCfg?.yAxisLabel}
            trendline={tsCfg?.trendline}
            thresholdLine={tsCfg?.thresholdLine}
            thresholdValue={tsCfg?.thresholdValue}
            showTotalLine={tsCfg?.showTotalLine}
          />
        );
      }
      case 'bar': {
        const barCfg = cfg?.chartType === 'bar' || cfg?.chartType === 'topNBar' ? cfg : null;
        return (
          <BarChart
            data={chartData.data}
            height={height}
            unit={chartData.unit}
            horizontal={chartData.horizontal}
            yAxisLabel={barCfg?.yAxisLabel}
            thresholdLine={barCfg?.thresholdLine}
            thresholdValue={barCfg?.thresholdValue}
            showValueLabels={barCfg?.showValueLabels}
          />
        );
      }
      case 'pie': {
        const pieCfg = cfg?.chartType === 'pie' || cfg?.chartType === 'donut' ? cfg : null;
        return (
          <PieChart
            data={chartData.data}
            height={height}
            labelFormat={pieCfg?.labelFormat}
            showValueLabels={pieCfg?.showValueLabels}
          />
        );
      }
      case 'donut': {
        const pieCfg = cfg?.chartType === 'pie' || cfg?.chartType === 'donut' ? cfg : null;
        return (
          <PieChart
            data={chartData.data}
            height={height}
            donut
            total={chartData.total}
            labelFormat={pieCfg?.labelFormat}
            showValueLabels={pieCfg?.showValueLabels}
          />
        );
      }
      case 'gauge': {
        const gaugeCfg = cfg?.chartType === 'gauge' ? cfg : null;
        return (
          <GaugeChart
            value={chartData.value}
            min={chartData.min}
            max={chartData.max}
            thresholds={chartData.thresholds}
            label={chartData.label}
            unit={gaugeCfg?.unit}
            height={height}
          />
        );
      }
      case 'singleValue': {
        const delta = chartData.comparePrevious;
        const isPositive = delta && delta.percent >= 0;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height }}>
            <div style={{ fontSize: Math.min(48, height * 0.3), fontWeight: 700, color: 'var(--color-primary)' }}>
              {typeof chartData.value === 'number' ? chartData.value.toLocaleString() : chartData.value}
            </div>
            <div style={{ fontSize: Math.min(16, height * 0.08), color: 'var(--color-text-secondary)', marginTop: 8 }}>
              {title || chartData.label} ({chartData.unit})
            </div>
            {delta && (
              <div style={{
                fontSize: Math.min(13, height * 0.06),
                color: isPositive ? 'var(--color-success)' : 'var(--color-error)',
                marginTop: 4,
              }}>
                {isPositive ? '+' : ''}{delta.percent.toFixed(1)}% vs {delta.period} ago
              </div>
            )}
          </div>
        );
      }
      case 'geoMap':
        return <GeoMapChart data={chartData.data} height={height} />;
      case 'heatmap': {
        const hmCfg = cfg?.chartType === 'heatmap' ? cfg : null;
        return (
          <HeatmapChart
            xLabels={chartData.xLabels}
            yLabels={chartData.yLabels}
            data={chartData.data}
            height={height}
            xAxisLabel={hmCfg?.xAxisLabel}
            yAxisLabel={hmCfg?.yAxisLabel}
            xSort={hmCfg?.xSort}
            ySort={hmCfg?.ySort}
          />
        );
      }
      case 'sankey':
        return (
          <SankeyPreviewChart
            nodes={chartData.nodes}
            links={chartData.links}
            height={height}
          />
        );
      case 'stackedBar': {
        const mbCfg = cfg?.chartType === 'stackedBar' ? cfg : null;
        return (
          <MultiBarChart
            categories={chartData.categories}
            series={chartData.series}
            height={height}
            stacked
            unit={chartData.unit}
            yAxisLabel={mbCfg?.yAxisLabel}
            horizontal={mbCfg?.orientation === 'horizontal'}
            showValueLabels={mbCfg?.showValueLabels}
            showTotalOnBar={mbCfg?.showTotalOnBar}
            showSegmentLabels={mbCfg?.showSegmentLabels}
            segmentLabelFormat={mbCfg?.segmentLabelFormat}
          />
        );
      }
      case 'groupedBar': {
        const mbCfg = cfg?.chartType === 'groupedBar' ? cfg : null;
        return (
          <MultiBarChart
            categories={chartData.categories}
            series={chartData.series}
            height={height}
            unit={chartData.unit}
            yAxisLabel={mbCfg?.yAxisLabel}
            horizontal={mbCfg?.orientation === 'horizontal'}
            showValueLabels={mbCfg?.showValueLabels}
          />
        );
      }
      case 'table':
        return (
          <TableChart
            columns={chartData.columns}
            rows={chartData.rows}
            height={height}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ChartExportWrapper filename={filename}>
      {renderChart()}
    </ChartExportWrapper>
  );
}
