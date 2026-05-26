import { useState, useMemo } from 'react';
import { Check, Search } from 'lucide-react';
import { Button } from '../common';
import { QueryChart } from './QueryChart';
import type { Query, QueryWidget } from '../../types';
import type { WidgetSelection } from './AddQueryPopup';
import styles from './DashboardEditPopup.module.css';

interface DashboardEditPopupProps {
  mode: 'new' | 'edit' | 'clone';
  queries: Query[];
  initialName: string;
  initialDescription: string;
  currentWidgets: WidgetSelection[];
  onSave: (name: string, description: string, widgets: WidgetSelection[]) => void;
  onCancel: () => void;
}

interface FlatWidget {
  queryId: string;
  queryName: string;
  widget: QueryWidget;
}

export function DashboardEditPopup({
  mode,
  queries,
  initialName,
  initialDescription,
  currentWidgets,
  onSave,
  onCancel,
}: DashboardEditPopupProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [search, setSearch] = useState('');
  const [previewItem, setPreviewItem] = useState<FlatWidget | null>(null);

  // Initialize selected keys from current widgets
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const sel of currentWidgets) {
      initial.add(`${sel.queryId}::${sel.widgetId}`);
    }
    return initial;
  });

  // Flatten available widgets (non-draft, non-private queries)
  const flatWidgets: FlatWidget[] = useMemo(() => queries
    .filter(q => !q.isDraft && !q.isPrivate)
    .flatMap(q =>
      (q.widgets || []).map(w => ({
        queryId: q.id,
        queryName: q.name,
        widget: w,
      }))
    ), [queries]);

  const filteredWidgets = useMemo(() => search.trim()
    ? flatWidgets.filter(fw => {
        const term = search.toLowerCase();
        return (
          fw.widget.name.toLowerCase().includes(term) ||
          fw.queryName.toLowerCase().includes(term) ||
          fw.widget.graphType.toLowerCase().includes(term)
        );
      })
    : flatWidgets, [flatWidgets, search]);

  const rowKey = (item: FlatWidget) => `${item.queryId}::${item.widget.id}`;

  const toggleSelect = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  const selectedCount = selectedKeys.size;

  const handleSave = () => {
    if (!name.trim()) return;
    const selections: WidgetSelection[] = flatWidgets
      .filter(fw => selectedKeys.has(rowKey(fw)))
      .map(fw => ({ queryId: fw.queryId, widgetId: fw.widget.id }));
    onSave(name.trim(), description.trim(), selections);
  };

  const previewQuery = previewItem
    ? queries.find(q => q.id === previewItem.queryId) || null
    : null;

  return (
    <div className={styles.container}>
      {/* Name + description */}
      <div className={styles.formSection}>
        <div className={styles.formField}>
          <label className={styles.label}>
            Dashboard Name <span className={styles.required}>*</span>
          </label>
          <input
            className={`${styles.input} ${!name.trim() ? styles.inputError : ''}`}
            type="text"
            placeholder="e.g. Traffic Overview, Daily Monitoring…"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>Description (optional)</label>
          <input
            className={styles.input}
            type="text"
            placeholder="Describe the purpose of this dashboard"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* Widget selector */}
      <div className={styles.widgetSelector}>
        {/* Left: widget list */}
        <div className={styles.listPanel}>
          <div className={styles.listHeader}>Widget Selector</div>
          <div className={styles.searchBar}>
            <Search size={14} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search by name, query, or chart type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <span className={styles.searchCount}>
                {filteredWidgets.length} of {flatWidgets.length}
              </span>
            )}
          </div>
          <div className={styles.listScroll}>
            {filteredWidgets.length > 0 ? (
              filteredWidgets.map(fw => {
                const key = rowKey(fw);
                const isSelected = selectedKeys.has(key);
                const isPreviewing = previewItem && rowKey(previewItem) === key;
                return (
                  <div
                    key={key}
                    className={`${styles.widgetRow} ${isSelected ? styles.selected : ''} ${isPreviewing ? styles.previewing : ''}`}
                    onClick={() => setPreviewItem(fw)}
                  >
                    <div
                      className={`${styles.checkbox} ${isSelected ? styles.checked : ''}`}
                      onClick={e => { e.stopPropagation(); toggleSelect(key); }}
                    >
                      {isSelected && <Check size={11} />}
                    </div>
                    <div className={styles.widgetInfo}>
                      <div className={styles.widgetName}>{fw.widget.name}</div>
                      <div className={styles.widgetMeta}>
                        <span className={styles.widgetType}>{fw.widget.graphType}</span>
                        <span className={styles.queryTag}>{fw.queryName}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyList}>
                {search.trim()
                  ? 'No widgets match your search.'
                  : 'No widgets available. Create queries with widgets first.'}
              </div>
            )}
          </div>
        </div>

        {/* Right: preview */}
        <div className={styles.previewPanel}>
          <div className={styles.previewHeader}>Preview</div>
          {previewItem && previewQuery ? (
            <div className={styles.previewContent}>
              <div className={styles.previewTitle}>{previewItem.widget.name}</div>
              <div className={styles.previewDesc}>
                From: <strong>{previewItem.queryName}</strong>
              </div>
              <div className={styles.previewChart}>
                <QueryChart
                  script={previewQuery.script}
                  height={240}
                  title={previewItem.widget.name}
                  chartConfig={previewItem.widget.chartConfig}
                />
              </div>
            </div>
          ) : (
            <div className={styles.previewEmpty}>Click a widget to preview</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!name.trim()}
        >
          {mode === 'new' ? `Create Dashboard (${selectedCount})` : `Save Dashboard (${selectedCount} widgets)`}
        </Button>
      </div>
    </div>
  );
}
