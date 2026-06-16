import { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Dropdown } from '../common';
import type { StageFilter, SankeyNode } from '../../types';
import styles from './StageFilters.module.css';

interface StageFiltersProps {
  filters: StageFilter[];
  nodes: SankeyNode[];
  onChange: (filters: StageFilter[]) => void;
  onStageToggle: (stage: string) => void;
}

export function StageFilters({ filters, nodes, onChange, onStageToggle }: StageFiltersProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close add-menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    if (addMenuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addMenuOpen]);

  const enabledFilters  = filters.filter(f => f.enabled);
  const disabledFilters = filters.filter(f => !f.enabled);
  const enabledCount    = enabledFilters.length;

  const handleFilterChange = (stage: string, selectedASNs: (string | number)[]) => {
    onChange(filters.map(f =>
      f.stage === stage ? { ...f, selectedASNs: selectedASNs as number[], enabled: true } : f,
    ));
  };

  const getOptionsForStage = (stage: string) => {
    const seen = new Set<number>();
    return nodes
      .filter(n => n.stage === stage)
      .filter(n => {
        if (seen.has(n.asnNumber)) return false;
        seen.add(n.asnNumber);
        return true;
      })
      .map(n => ({
        value: n.asnNumber,
        label: `${n.name} (AS${n.asnNumber})`,
      }));
  };

  const canRemove = (f: StageFilter) => f.enabled && enabledCount > 2;

  return (
    <div className={styles.container}>
      {/* Active stage chips */}
      {enabledFilters.map(filter => (
        <div key={filter.stage} className={styles.chip}>
          <Dropdown
            label={filter.label}
            options={getOptionsForStage(filter.stage)}
            value={filter.selectedASNs}
            onChange={vals => handleFilterChange(filter.stage, vals)}
            multiple
            searchable
            selectAllLabel="All selected"
            color={filter.color}
          />
          <button
            className={styles.removeBtn}
            disabled={!canRemove(filter)}
            onClick={() => onStageToggle(filter.stage)}
            title={canRemove(filter) ? `Remove ${filter.label} column` : 'At least 2 stages must remain visible'}
          >
            <X size={11} />
          </button>
        </div>
      ))}

      {/* Add stage button */}
      {disabledFilters.length > 0 && (
        <div className={styles.addWrapper} ref={addMenuRef}>
          <button
            className={styles.addBtn}
            onClick={() => setAddMenuOpen(o => !o)}
            title="Add a column back"
          >
            <Plus size={13} />
            <span>Add column</span>
          </button>
          {addMenuOpen && (
            <div className={styles.addMenu}>
              {disabledFilters.map(f => (
                <button
                  key={f.stage}
                  className={styles.addMenuItem}
                  onClick={() => { onStageToggle(f.stage); setAddMenuOpen(false); }}
                >
                  <span className={styles.addMenuDot} style={{ backgroundColor: f.color }} />
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
