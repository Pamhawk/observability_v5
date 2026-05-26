import { Dropdown } from '../common';
import type { StageFilter, SankeyNode } from '../../types';
import styles from './StageFilters.module.css';

interface StageFiltersProps {
  filters: StageFilter[];
  nodes: SankeyNode[];
  onChange: (filters: StageFilter[]) => void;
}

export function StageFilters({ filters, nodes, onChange }: StageFiltersProps) {
  const handleFilterChange = (stage: string, selectedASNs: (string | number)[]) => {
    const newFilters = filters.map(f => {
      if (f.stage === stage) {
        return { ...f, selectedASNs: selectedASNs as number[], enabled: true };
      }
      return f;
    });
    onChange(newFilters);
  };

  const getOptionsForStage = (stage: string) => {
    const stageNodes = nodes.filter(n => n.stage === stage);
    return stageNodes.map(n => ({
      value: n.asnNumber,
      label: `${n.name} (${n.asnNumber})`,
    }));
  };

  return (
    <div className={styles.container}>
      {filters.map((filter) => (
        <Dropdown
          key={filter.stage}
          label={filter.label}
          options={getOptionsForStage(filter.stage)}
          value={filter.selectedASNs}
          onChange={(values) => handleFilterChange(filter.stage, values)}
          multiple
          searchable
          selectAllLabel="All selected"
          color={filter.color}
        />
      ))}
    </div>
  );
}
