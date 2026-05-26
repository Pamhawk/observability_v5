import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Button } from '../common';
import { QueryChart } from './QueryChart';
import type { Query, QueryWidget } from '../../types';
import styles from './AddQueryPopup.module.css';

export interface WidgetSelection {
  queryId: string;
  widgetId: string;
}

interface AddQueryPopupProps {
  queries: Query[];
  onAdd: (items: WidgetSelection[]) => void;
  onCancel: () => void;
}

interface FlatWidget {
  queryId: string;
  queryName: string;
  widget: QueryWidget;
}

export function AddQueryPopup({ queries, onAdd, onCancel }: AddQueryPopupProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<FlatWidget | null>(null);
  const [search, setSearch] = useState('');

  // Flatten: one row per widget across all saved non-draft public queries
  const flatWidgets: FlatWidget[] = queries
    .filter(q => !q.isDraft && !q.isPrivate)
    .flatMap(q =>
      (q.widgets || []).map(w => ({
        queryId: q.id,
        queryName: q.name,
        widget: w,
      }))
    );

  // Filter by search term (widget name, query name, or chart type)
  const filteredWidgets = search.trim()
    ? flatWidgets.filter(fw => {
        const term = search.toLowerCase();
        return (
          fw.widget.name.toLowerCase().includes(term) ||
          fw.queryName.toLowerCase().includes(term) ||
          fw.widget.graphType.toLowerCase().includes(term)
        );
      })
    : flatWidgets;

  const rowKey = (item: FlatWidget) => `${item.queryId}::${item.widget.id}`;

  const toggleSelect = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedKeys(next);
  };

  const handleCheckboxClick = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    toggleSelect(key);
  };

  const handleAdd = () => {
    const items: WidgetSelection[] = flatWidgets
      .filter(fw => selectedKeys.has(rowKey(fw)))
      .map(fw => ({ queryId: fw.queryId, widgetId: fw.widget.id }));
    onAdd(items);
  };

  // Find the query for preview
  const previewQuery = previewItem
    ? queries.find(q => q.id === previewItem.queryId) || null
    : null;

  return (
    <div className={styles.container}>
      <div className={styles.body}>
        {/* Left: Widget list with checkboxes */}
        <div className={styles.listPanel}>
          <div className={styles.listHeader}>
            Widget Selector
          </div>
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
                return (
                  <div
                    key={key}
                    className={`${styles.queryRow} ${selectedKeys.has(key) ? styles.selected : ''} ${previewItem && rowKey(previewItem) === key ? styles.previewing : ''}`}
                    onClick={() => setPreviewItem(fw)}
                  >
                    <div
                      className={`${styles.checkbox} ${selectedKeys.has(key) ? styles.checked : ''}`}
                      onClick={(e) => handleCheckboxClick(e, key)}
                    >
                      {selectedKeys.has(key) && <Check size={12} className={styles.checkIcon} />}
                    </div>
                    <div className={styles.queryInfo}>
                      <div className={styles.queryName}>{fw.widget.name}</div>
                      <div className={styles.queryMeta}>
                        <span className={styles.queryType}>{fw.widget.graphType}</span>
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
                  : 'No widgets available. Open a query in "Queries & Widgets" and save widgets to it first.'}
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div className={styles.previewPanel}>
          <div className={styles.previewHeader}>Preview</div>
          {previewItem && previewQuery ? (
            <div className={styles.previewContent}>
              <div className={styles.previewTitle}>{previewItem.widget.name}</div>
              <div className={styles.previewDesc}>
                From query: <strong>{previewItem.queryName}</strong>
              </div>
              <div className={styles.previewChart}>
                <QueryChart
                  script={previewQuery.script}
                  height={280}
                  title={previewItem.widget.name}
                  chartConfig={previewItem.widget.chartConfig}
                />
              </div>
            </div>
          ) : (
            <div className={styles.previewEmpty}>
              Click on a widget to preview it
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleAdd}
          disabled={selectedKeys.size === 0}
        >
          Add ({selectedKeys.size})
        </Button>
      </div>
    </div>
  );
}
