import {
  BarChart3, PieChart as PieIcon, Activity, TrendingUp,
  Gauge, Hash, Globe2, Grid3X3, GitBranch, Table2,
} from 'lucide-react';
import type { ChartRecommendation, ChartType } from '../../types';
import styles from './ChartTypeSelector.module.css';

const CHART_ICONS: Record<ChartType, React.ReactNode> = {
  areaTimeSeries: <TrendingUp size={18} />,
  timeSeries: <Activity size={18} />,
  stackedArea: <TrendingUp size={18} />,
  bar: <BarChart3 size={18} />,
  topNBar: <BarChart3 size={18} />,
  stackedBar: <BarChart3 size={18} />,
  groupedBar: <BarChart3 size={18} />,
  pie: <PieIcon size={18} />,
  donut: <PieIcon size={18} />,
  gauge: <Gauge size={18} />,
  singleValue: <Hash size={18} />,
  geoMap: <Globe2 size={18} />,
  heatmap: <Grid3X3 size={18} />,
  sankey: <GitBranch size={18} />,
  table: <Table2 size={18} />,
};

const CHART_LABELS: Record<ChartType, string> = {
  areaTimeSeries: 'Area Time Series',
  timeSeries: 'Time Series',
  stackedArea: 'Stacked Area',
  bar: 'Bar',
  topNBar: 'Top N',
  stackedBar: 'Stacked Bar',
  groupedBar: 'Grouped Bar',
  pie: 'Pie',
  donut: 'Donut',
  gauge: 'Gauge',
  singleValue: 'Single Value',
  geoMap: 'Geo Map',
  heatmap: 'Heatmap',
  sankey: 'Sankey',
  table: 'Table',
};

interface ChartTypeSelectorProps {
  recommendations: ChartRecommendation[];
  selectedType: ChartType | null;
  onSelect: (chartType: ChartType) => void;
}

function StarRating({ score }: { score: number }) {
  return (
    <span className={styles.stars}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < score ? styles.starFilled : styles.starEmpty}>
          {i < score ? '\u2605' : '\u2606'}
        </span>
      ))}
    </span>
  );
}

export function ChartTypeSelector({ recommendations, selectedType, onSelect }: ChartTypeSelectorProps) {
  if (recommendations.length === 0) return null;

  const bestScore = recommendations[0]?.score || 0;

  return (
    <div className={styles.container}>
      <div className={styles.label}>Visualization</div>
      <div className={styles.pills}>
        {recommendations.map(rec => (
          <button
            key={rec.chartType}
            className={`${styles.pill} ${selectedType === rec.chartType ? styles.selected : ''}`}
            onClick={() => onSelect(rec.chartType)}
            title={rec.reason}
          >
            <span className={styles.pillIcon}>{CHART_ICONS[rec.chartType]}</span>
            <span className={styles.pillLabel}>{CHART_LABELS[rec.chartType]}</span>
            <StarRating score={rec.score} />
            {rec.score === bestScore && rec.score >= 4 && (
              <span className={styles.bestFit}>Best</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
