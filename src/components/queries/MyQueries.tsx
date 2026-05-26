import { useState, useMemo, useRef, useCallback } from 'react';
import { Plus, Edit2, Copy, Trash2, Search, AlertTriangle, Lock, MoreVertical } from 'lucide-react';
import { Button, Modal, TimeRangeSelector, ExportDropdown } from '../common';
import { SqlQueryEditor } from './SqlQueryEditor';
import { QueryChart } from './QueryChart';
import { sampleQueries } from '../../data/mockData';
import type { Query, TimeRange } from '../../types';
import styles from './MyQueries.module.css';

const MOCK_TABLE_COLS = [
  { key: 'origin', label: 'Origin', right: false },
  { key: 'my_asn', label: 'My ASN', right: false },
  { key: 'destination', label: 'Destination', right: false },
  { key: 'geo', label: 'Origin Geo', right: false },
  { key: 'traffic', label: 'Traffic', right: true },
  { key: 'total', label: 'Total traffic', right: true },
  { key: 'flows', label: 'Flow count', right: true },
  { key: 'avg_size', label: 'Avg flow size', right: true },
  { key: 'peak', label: 'Peak traffic', right: true },
  { key: 'protocol', label: 'Protocol mix', right: false },
];

const MOCK_TABLE_ROWS = [
  { origin: 'Google (AS15169)', my_asn: 'MySP-Core (AS65001)', destination: 'Amazon (AS16509)', geo: 'Chicago, US', traffic: '324.7 Gbps', total: '14.5 TB', flows: '1,250,000', avg_size: '12.4 MB', peak: '410.2 Gbps', protocol: '55% TCP, 20% UDP; 25% Ot...' },
  { origin: 'Cloudflare (AS13335)', my_asn: 'MySP-Edge (AS65002)', destination: 'Akamai (AS20940)', geo: 'Frankfurt, DE', traffic: '72.2 Gbps', total: '3.2 TB', flows: '450,000', avg_size: '8.1 MB', peak: '95.5 Gbps', protocol: '80% TCP, 10% UDP; 10% Ot...' },
  { origin: 'Google (AS15169)', my_asn: 'MySP-Core (AS65001)', destination: 'Amazon (AS16509)', geo: 'Chicago, US', traffic: '311.0 Gbps', total: '13.9 TB', flows: '1,180,000', avg_size: '11.8 MB', peak: '395.4 Gbps', protocol: '52% TCP, 23% UDP; 25% Ot...' },
  { origin: 'Cloudflare (AS13335)', my_asn: 'MySP-Edge (AS65002)', destination: 'Akamai (AS20940)', geo: 'Frankfurt, DE', traffic: '68.5 Gbps', total: '3.0 TB', flows: '427,000', avg_size: '7.9 MB', peak: '89.1 Gbps', protocol: '76% TCP, 14% UDP; 10% Ot...' },
  { origin: 'Google (AS15169)', my_asn: 'MySP-Core (AS65001)', destination: 'Amazon (AS16509)', geo: 'Chicago, US', traffic: '298.3 Gbps', total: '13.4 TB', flows: '1,095,000', avg_size: '11.2 MB', peak: '374.9 Gbps', protocol: '58% TCP, 18% UDP; 24% Ot...' },
  { origin: 'Cloudflare (AS13335)', my_asn: 'MySP-Edge (AS65002)', destination: 'Akamai (AS20940)', geo: 'Frankfurt, DE', traffic: '65.1 Gbps', total: '2.9 TB', flows: '411,000', avg_size: '7.5 MB', peak: '82.7 Gbps', protocol: '78% TCP, 12% UDP; 10% Ot...' },
  { origin: 'Google (AS15169)', my_asn: 'MySP-Core (AS65001)', destination: 'Amazon (AS16509)', geo: 'Chicago, US', traffic: '289.7 Gbps', total: '13.0 TB', flows: '1,050,000', avg_size: '10.8 MB', peak: '362.1 Gbps', protocol: '53% TCP, 22% UDP; 25% Ot...' },
  { origin: 'Cloudflare (AS13335)', my_asn: 'MySP-Edge (AS65002)', destination: 'Akamai (AS20940)', geo: 'Frankfurt, DE', traffic: '61.8 Gbps', total: '2.8 TB', flows: '398,000', avg_size: '7.2 MB', peak: '79.3 Gbps', protocol: '75% TCP, 15% UDP; 10% Ot...' },
];

export function MyQueries() {
  const [queries, setQueries] = useState<Query[]>(sampleQueries.filter(q => !q.isDraft));
  const [drafts, setDrafts] = useState<Query[]>(sampleQueries.filter(q => q.isDraft));
  const [activeTab, setActiveTab] = useState<'queries' | 'drafts'>('queries');
  const [search, setSearch] = useState('');
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [showNewEditor, setShowNewEditor] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    preset: '1h',
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date(),
  }));

  // Edit popup state
  const [showEditEditor, setShowEditEditor] = useState(false);
  const [editingQuery, setEditingQuery] = useState<Query | null>(null);
  const [editorMode, setEditorMode] = useState<'new' | 'edit' | 'clone'>('new');
  const [editorInitialStep, setEditorInitialStep] = useState<'query' | 'widgets'>('query');
  const [editorExpandedWidgetId, setEditorExpandedWidgetId] = useState<string | undefined>(undefined);
  const [editorKey, setEditorKey] = useState(0);

  // Clone state (uses full editor like edit, but with empty name)
  const [cloneTarget, setCloneTarget] = useState<Query | null>(null);
  const [cloneName, setCloneName] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Query | null>(null);

  // Per-widget actions state
  const [widgetMenuOpenId, setWidgetMenuOpenId] = useState<string | null>(null);

  // Track current new-editor data for auto-save-as-draft on outside click
  const newEditorDataRef = useRef<Partial<Query>>({});
  const handleNewEditorChange = useCallback((data: Partial<Query>) => {
    newEditorDataRef.current = data;
  }, []);

  const currentList = activeTab === 'queries' ? queries : drafts;

  const filteredList = useMemo(() => {
    const filtered = currentList.filter(q =>
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      q.description.toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [currentList, search]);

  const handleNewQuery = () => {
    setEditorMode('new');
    setShowNewEditor(true);
  };

  const handleOpenEditModal = (query: Query) => {
    setSelectedQuery(query);
    setEditingQuery(query);
    setEditorMode('edit');
    setEditorInitialStep('query');
    setEditorExpandedWidgetId(undefined);
    setEditorKey(k => k + 1);
    setShowEditEditor(true);
    setMenuOpenId(null);
  };

  const handleOpenAtWidgets = (query: Query, expandWidgetId?: string) => {
    setSelectedQuery(query);
    setEditingQuery(query);
    setEditorMode('edit');
    setEditorInitialStep('widgets');
    setEditorExpandedWidgetId(expandWidgetId);
    setEditorKey(k => k + 1);
    setShowEditEditor(true);
    setMenuOpenId(null);
  };

  const handleCloneRequest = (query: Query) => {
    // V5: clone opens full editor with empty name/description
    const cloned: Query = {
      ...query,
      id: `query-${Date.now()}`,
      name: '',
      description: '',
      lastEdited: new Date().toISOString(),
    };
    setCloneTarget(query);
    setCloneName('');
    setEditingQuery(cloned);
    setEditorMode('clone');
    setEditorInitialStep('query');
    setEditorExpandedWidgetId(undefined);
    setEditorKey(k => k + 1);
    setShowEditEditor(true);
    setMenuOpenId(null);
  };

  const handleCloneConfirm = () => {
    // no-op: clone now handled by the full editor save flow
    setCloneTarget(null);
    setCloneName('');
  };

  const handleDeleteRequest = (query: Query) => {
    setDeleteTarget(query);
    setMenuOpenId(null);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    if (deleteTarget.isDraft) {
      setDrafts(drafts.filter(q => q.id !== deleteTarget.id));
    } else {
      setQueries(queries.filter(q => q.id !== deleteTarget.id));
    }
    if (selectedQuery?.id === deleteTarget.id) {
      setSelectedQuery(null);
      setShowEditEditor(false);
      setEditingQuery(null);
    }
    setDeleteTarget(null);
  };

  const handleDeleteWidget = useCallback((queryId: string, widgetId: string) => {
    const updateQuery = (list: Query[]) =>
      list.map(q => q.id === queryId
        ? { ...q, widgets: (q.widgets || []).filter(w => w.id !== widgetId) }
        : q
      );
    setQueries(prev => updateQuery(prev));
    setDrafts(prev => updateQuery(prev));
    if (selectedQuery?.id === queryId) {
      setSelectedQuery(prev => prev ? { ...prev, widgets: (prev.widgets || []).filter(w => w.id !== widgetId) } : prev);
    }
    setWidgetMenuOpenId(null);
  }, [selectedQuery]);

  const handleCopyWidget = useCallback((queryId: string, widgetId: string) => {
    const updateQuery = (list: Query[]) =>
      list.map(q => {
        if (q.id !== queryId) return q;
        const src = (q.widgets || []).find(w => w.id === widgetId);
        if (!src) return q;
        const clone = { ...src, id: `widget-${Date.now()}`, name: `${src.name} (copy)` };
        return { ...q, widgets: [...(q.widgets || []), clone] };
      });
    setQueries(prev => updateQuery(prev));
    setDrafts(prev => updateQuery(prev));
    if (selectedQuery?.id === queryId) {
      const src = (selectedQuery.widgets || []).find(w => w.id === widgetId);
      if (src) {
        const clone = { ...src, id: `widget-${Date.now()}`, name: `${src.name} (copy)` };
        setSelectedQuery(prev => prev ? { ...prev, widgets: [...(prev.widgets || []), clone] } : prev);
      }
    }
    setWidgetMenuOpenId(null);
  }, [selectedQuery]);

  // Save handler for NEW queries (from popup)
  const handleSaveNewQuery = (queryData: Partial<Query>) => {
    const newQuery: Query = {
      id: `query-${Date.now()}`,
      name: queryData.name || 'Untitled',
      description: queryData.description || '',
      script: queryData.script || '',
      graphType: queryData.graphType || 'bar',
      widgets: queryData.widgets || [],
      isDraft: false,
      lastEdited: new Date().toISOString(),
      createdBy: 'user-1',
    };
    setQueries([...queries, newQuery]);
    setShowNewEditor(false);
  };

  const handleSaveNewAsDraft = (queryData: Partial<Query>) => {
    const newDraft: Query = {
      id: `draft-${Date.now()}`,
      name: queryData.name || 'Untitled',
      description: queryData.description || '',
      script: queryData.script || '',
      graphType: queryData.graphType || 'bar',
      widgets: queryData.widgets || [],
      isDraft: true,
      lastEdited: new Date().toISOString(),
      createdBy: 'user-1',
    };
    setDrafts([...drafts, newDraft]);
    setShowNewEditor(false);
  };

  // Auto-save as draft when clicking outside the new query editor
  const handleNewEditorBackdropClick = () => {
    const data = newEditorDataRef.current;
    if (data.script || data.name) {
      handleSaveNewAsDraft(data);
    } else {
      setShowNewEditor(false);
    }
    newEditorDataRef.current = {};
  };

  // Save handler for EDIT popup (existing queries)
  const handleEditSave = (queryData: Partial<Query>) => {
    if (!editingQuery) return;
    const updatedQuery: Query = {
      ...editingQuery,
      name: queryData.name || editingQuery.name,
      description: queryData.description || '',
      script: queryData.script || '',
      graphType: queryData.graphType || editingQuery.graphType,
      widgets: queryData.widgets ?? editingQuery.widgets,
      isDraft: false,
      lastEdited: new Date().toISOString(),
    };

    // Remove from old list
    if (editingQuery.isDraft) {
      setDrafts(drafts.filter(q => q.id !== editingQuery.id));
    } else {
      setQueries(queries.filter(q => q.id !== editingQuery.id));
    }
    setQueries(prev => [...prev, updatedQuery]);
    setSelectedQuery(updatedQuery);
    setShowEditEditor(false);
    setEditingQuery(null);
  };

  const handleEditSaveAsDraft = (queryData: Partial<Query>) => {
    if (!editingQuery) return;
    const updatedDraft: Query = {
      ...editingQuery,
      name: queryData.name || editingQuery.name,
      description: queryData.description || '',
      script: queryData.script || '',
      graphType: queryData.graphType || editingQuery.graphType,
      widgets: queryData.widgets ?? editingQuery.widgets,
      isDraft: true,
      lastEdited: new Date().toISOString(),
    };

    // Remove from old list
    setDrafts(drafts.filter(q => q.id !== editingQuery.id));
    setQueries(queries.filter(q => q.id !== editingQuery.id));
    setDrafts(prev => [...prev, updatedDraft]);
    setSelectedQuery(updatedDraft);
    setShowEditEditor(false);
    setEditingQuery(null);
  };

  const handleEditCancel = () => {
    setShowEditEditor(false);
    setEditingQuery(null);
  };

  const renderWidgetList = (query: Query) => {
    const widgets = query.widgets || [];
    const widgetCount = widgets.length;
    return (
      <div className={styles.previewWidgets}>
        <div className={styles.widgetSectionHeader}>
          <span>Widgets</span>
          {widgetCount > 0 && <span className={styles.widgetCount}>{widgetCount}</span>}
          <button className={styles.widgetEditBtn} onClick={() => handleOpenEditModal(query)}>
            Edit query
          </button>
          <div className={styles.widgetSectionSpacer} />
          <button className={styles.addWidgetBtn} onClick={() => handleOpenAtWidgets(query)}>
            + Add widget
          </button>
        </div>
        {widgetCount === 0 ? (
          <div className={styles.noWidgets}>
            <p>No widgets added yet</p>
            <p className={styles.noWidgetsHint}>Click to add widgets based on this query</p>
            <Button variant="primary" size="sm" onClick={() => handleOpenAtWidgets(query)}>
              Add widget
            </Button>
          </div>
        ) : (
          <div className={styles.widgetGrid}>
            {widgets.map(widget => (
              <div key={widget.id} className={styles.widgetPreviewCard}>
                <div className={styles.widgetPreviewHeader}>
                  <span className={styles.widgetPreviewName}>{widget.name}</span>
                  <span className={styles.widgetPreviewType}>{widget.graphType}</span>
                  <div className={styles.widgetPreviewActions}>
                    <button
                      className={styles.widgetActionDanger}
                      title="Delete widget"
                      onClick={() => handleDeleteWidget(query.id, widget.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      title="Clone widget"
                      onClick={() => handleCopyWidget(query.id, widget.id)}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      title="Edit widget"
                      onClick={() => handleOpenAtWidgets(query, widget.id)}
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
                <div className={styles.widgetPreviewChart}>
                  <QueryChart
                    script={query.script}
                    height={240}
                    title={widget.name}
                    timePreset={timeRange.preset}
                    chartConfig={widget.chartConfig}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>Queries &amp; Widgets</h2>
        <div className={styles.headerActions}>
          <ExportDropdown />
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={handleNewQuery}
          >
            New Query
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Left: Query List */}
        <div className={styles.listPanel}>
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'queries' ? styles.active : ''}`}
              onClick={() => setActiveTab('queries')}
            >
              Queries ({queries.length})
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'drafts' ? styles.active : ''}`}
              onClick={() => setActiveTab('drafts')}
            >
              Drafts ({drafts.length})
            </button>
          </div>

          {/* Search (sort by name only in V5) */}
          <div className={styles.searchSortRow}>
            <div className={styles.searchWrapper}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Search queries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* List */}
          <div className={styles.list}>
            {filteredList.map((query) => (
              <div
                key={query.id}
                className={`${styles.listItem} ${selectedQuery?.id === query.id ? styles.selected : ''}`}
                onClick={() => setSelectedQuery(query)}
                onDoubleClick={() => handleOpenEditModal(query)}
              >
                <div className={styles.listItemInfo}>
                  <span className={styles.queryName}>
                    {query.name}
                    {query.isDraft && <span className={styles.draftTag}>Draft</span>}
                    {query.isPrivate && <Lock size={11} className={styles.privateIcon} title="Private query" />}
                  </span>
                  <span className={styles.queryDescription} title={query.description}>{query.description}</span>
                  <span className={styles.queryDate}>{formatDate(query.lastEdited)}</span>
                </div>
                <div className={styles.listItemActions}>
                  <button
                    className={styles.menuBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === query.id ? null : query.id);
                    }}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuOpenId === query.id && (
                    <div className={styles.menu}>
                      <button onClick={() => handleOpenEditModal(query)}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button onClick={() => handleCloneRequest(query)}>
                        <Copy size={14} /> Clone
                      </button>
                      <button className={styles.danger} onClick={() => handleDeleteRequest(query)}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredList.length === 0 && (
              <div className={styles.emptyState}>
                <p>No {activeTab} found</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview — V5: top (query table output) + bottom (widget grid) */}
        <div className={styles.previewPanel}>
          {selectedQuery ? (
            <div className={styles.preview}>
              <div className={styles.previewHeader}>
                <div className={styles.previewTitleRow}>
                  <div>
                    <h3>
                      {selectedQuery.name}
                      {selectedQuery.isDraft && <span className={styles.draftTag}>Draft</span>}
                      {selectedQuery.isPrivate && <Lock size={12} className={styles.privateIcon} title="Private" />}
                    </h3>
                    {selectedQuery.description && <p>{selectedQuery.description}</p>}
                  </div>
                  <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
                </div>
                <div className={styles.previewMeta}>
                  <span>Last edited: {formatDate(selectedQuery.lastEdited)}</span>
                </div>
              </div>

              {/* Top: query table output */}
              <div className={styles.previewQueryOutput}>
                <div className={styles.queryOutputMeta}>
                  <span className={styles.queryOutputLabel}>Query Output</span>
                  <span className={styles.queryOutputStats}>{MOCK_TABLE_ROWS.length} rows · 14.2 ms</span>
                </div>
                <div className={styles.queryOutputTableWrap}>
                  <table className={styles.queryOutputTable}>
                    <thead>
                      <tr>
                        {MOCK_TABLE_COLS.map(col => (
                          <th key={col.key} className={col.right ? styles.right : ''}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_TABLE_ROWS.map((row, i) => (
                        <tr key={i}>
                          {MOCK_TABLE_COLS.map(col => (
                            <td key={col.key} className={col.right ? styles.right : ''}>{row[col.key as keyof typeof row]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom: widget grid */}
              {renderWidgetList(selectedQuery)}
            </div>
          ) : (
            <div className={styles.previewPlaceholder}>
              <p>Select a query to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* New Query Modal — clicking outside auto-saves as draft */}
      <Modal
        isOpen={showNewEditor}
        onClose={() => setShowNewEditor(false)}
        onBackdropClick={handleNewEditorBackdropClick}
        title="New Query"
        size="full"
        showClose={false}
      >
        <SqlQueryEditor
          onSave={handleSaveNewQuery}
          onSaveAsDraft={handleSaveNewAsDraft}
          onCancel={() => { setShowNewEditor(false); newEditorDataRef.current = {}; }}
          onChange={handleNewEditorChange}
          mode="new"
        />
      </Modal>

      {/* Edit / Clone Query Modal */}
      <Modal
        isOpen={showEditEditor}
        onClose={handleEditCancel}
        title={editorMode === 'clone' ? 'Clone Query' : 'Edit Query'}
        size="full"
        showClose={false}
      >
        <SqlQueryEditor
          key={editorKey}
          query={editingQuery ?? undefined}
          onSave={handleEditSave}
          onSaveAsDraft={handleEditSaveAsDraft}
          onCancel={handleEditCancel}
          mode={editorMode}
          initialStep={editorInitialStep}
          initialExpandedWidgetId={editorExpandedWidgetId}
        />
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Query"
        size="sm"
      >
        <div className={styles.dialogContent}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
            <AlertTriangle size={24} style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: '0 0 var(--spacing-xs)', fontWeight: 500 }}>
                Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              </p>
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                This action cannot be undone. The query and all associated widgets will be permanently removed.
              </p>
            </div>
          </div>
          <div className={styles.dialogActions}>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" className={styles.deleteBtn} onClick={handleDeleteConfirm}>
              Delete Query
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
