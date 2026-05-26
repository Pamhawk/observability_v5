import { useState, useRef, useCallback, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Play, ToggleLeft, ToggleRight, Sparkles, ArrowRight, Trash2, Plus, ChevronRight, Lock, Globe } from 'lucide-react';
import { Button, TimeRangeSelector } from '../common';
import { SqlResultTableView } from './SqlResultTableView';
import { ChartTypeSelector } from './ChartTypeSelector';
import { ChartConfigPanel } from './ChartConfigPanel';
import { parseSQL } from '../../utils/sqlParser';
import { executeMockSQL } from '../../utils/sqlMockExecutor';
import { recommendCharts } from '../../utils/chartRecommender';
import { adaptTableToChart } from '../../utils/chartDataAdapter';
import { nlToSql, NL_EXAMPLES } from '../../utils/nlToSql';
import { DIMENSION_POOLS, METRIC_RANGES } from '../../utils/queryDataGenerator';
import type { ChartDataResult } from '../../utils/queryDataGenerator';
import type { Query, QueryWidget, TimeRange, ChartType, ChartConfig, ChartRecommendation, SqlResultTable } from '../../types';
import styles from './SqlQueryEditor.module.css';

const SQL_COMPLETION_KEY = '__sqlEditor_completionDisposable__';

interface MonacoTextModel {
  getWordUntilPosition: (pos: { lineNumber: number; column: number }) => { startColumn: number; endColumn: number };
  getValueInRange: (range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }) => string;
}
interface MonacoPosition { lineNumber: number; column: number }
interface CompletionItem {
  label: string; kind: number; insertText: string;
  range: { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number };
  insertTextRules?: number;
}
type WinStore = Record<string, unknown>;

interface SqlQueryEditorProps {
  query?: Query | null;
  onSave: (query: Partial<Query>) => void;
  onSaveAsDraft?: (query: Partial<Query>) => void;
  onCancel: () => void;
  onChange?: (data: Partial<Query>) => void;
  inline?: boolean;
  initialExpandedWidgetId?: string;
  initialStep?: 'query' | 'widgets';
  mode?: 'new' | 'edit' | 'clone';
}

export function SqlQueryEditor({ query, onSave, onSaveAsDraft, onCancel, onChange, inline, initialExpandedWidgetId, initialStep, mode = 'edit' }: SqlQueryEditorProps) {
  const [step, setStep] = useState<'query' | 'widgets'>(
    initialExpandedWidgetId ? 'widgets' : (initialStep ?? 'query')
  );
  const [title, setTitle] = useState(query?.name || '');
  const [description, setDescription] = useState(query?.description || '');
  const [isPrivate, setIsPrivate] = useState(query?.isPrivate ?? false);
  const [sql, setSql] = useState(query?.script || '');
  const [autoRun, setAutoRun] = useState(true);
  const [resultTable, setResultTable] = useState<SqlResultTable | null>(null);
  const [recommendations, setRecommendations] = useState<ChartRecommendation[]>([]);
  // If a specific widget is being opened, seed chart state from it
  const initialWidget = initialExpandedWidgetId
    ? (query?.widgets || []).find(w => w.id === initialExpandedWidgetId) ?? null
    : null;
  const [selectedChartType, setSelectedChartType] = useState<ChartType | null>(
    initialWidget?.graphType ?? query?.graphType ?? null
  );
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(
    initialWidget?.chartConfig ?? query?.chartConfig ?? null
  );
  const [chartData, setChartData] = useState<ChartDataResult | null>(null);
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    preset: '1h',
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date(),
  }));

  // Widget list state
  const [savedWidgets, setSavedWidgets] = useState<QueryWidget[]>(query?.widgets || []);
  // expandedWidgetId: which saved widget accordion is open (null = showing "Add Widget" form)
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(initialWidget?.id ?? null);
  const [expandedWidgetName, setExpandedWidgetName] = useState(initialWidget?.name ?? '');
  const [newWidgetName, setNewWidgetName] = useState('');

  const [nlPrompt, setNlPrompt] = useState('');
  const [nlPlaceholderIdx, setNlPlaceholderIdx] = useState(() => Math.floor(Math.random() * NL_EXAMPLES.length));

  // Rotate placeholder every 4 seconds when input is empty
  useEffect(() => {
    if (nlPrompt) return;
    const timer = setInterval(() => {
      setNlPlaceholderIdx(prev => (prev + 1) % NL_EXAMPLES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [nlPrompt]);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI assistant: generate SQL from natural language
  const handleGenerate = useCallback(() => {
    const generated = nlToSql(nlPrompt);
    if (generated) {
      setSql(generated);
      setNlPrompt('');
    }
  }, [nlPrompt]);

  // Report changes upward
  useEffect(() => {
    onChange?.({
      name: title,
      description,
      script: sql,
      graphType: selectedChartType || 'table',
      chartConfig: chartConfig || undefined,
      widgets: savedWidgets,
    });
  }, [title, description, sql, selectedChartType, chartConfig, savedWidgets, onChange]);

  // Execute SQL query
  const executeQuery = useCallback(() => {
    if (!sql.trim()) {
      setResultTable(null);
      setRecommendations([]);
      setSqlError(null);
      setChartData(null);
      return;
    }

    const parsed = parseSQL(sql);
    if (!parsed) {
      setSqlError('Invalid SQL. Expected: SELECT ... FROM ...');
      setResultTable(null);
      setRecommendations([]);
      setChartData(null);
      return;
    }

    setSqlError(null);
    const result = executeMockSQL(parsed, timeRange.preset);
    setResultTable(result);

    // Get recommendations
    const recs = recommendCharts(result);
    setRecommendations(recs);

    // Auto-select best chart if none selected or current type not in recommendations
    if (recs.length > 0) {
      const currentTypeAvailable = selectedChartType && recs.some(r => r.chartType === selectedChartType);
      if (!currentTypeAvailable) {
        setSelectedChartType(recs[0].chartType);
        setChartConfig(recs[0].defaultConfig);
      }
    }
  }, [sql, selectedChartType, timeRange.preset]);

  // Auto-run with debounce
  useEffect(() => {
    if (!autoRun) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(executeQuery, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [sql, autoRun, executeQuery, timeRange.preset]);

  // Run on initial load if query has content
  useEffect(() => {
    if (sql.trim()) queueMicrotask(executeQuery);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When chart type changes, adopt the default config from recommendations
  const handleChartTypeSelect = useCallback((type: ChartType) => {
    setSelectedChartType(type);
    const rec = recommendations.find(r => r.chartType === type);
    if (rec) setChartConfig(rec.defaultConfig);
  }, [recommendations]);

  // Generate chart data whenever config or table changes
  useEffect(() => {
    if (!resultTable || !chartConfig) {
      queueMicrotask(() => setChartData(null));
      return;
    }
    try {
      const data = adaptTableToChart(resultTable, chartConfig);
      queueMicrotask(() => setChartData(data));
    } catch (err) {
      console.error('Chart adaptation error:', err);
      queueMicrotask(() => setChartData(null));
    }
  }, [resultTable, chartConfig]);

  // Monaco mount handler
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    const win = window as unknown as WinStore;

    // Dispose previous completion provider if any
    if (win[SQL_COMPLETION_KEY]) {
      (win[SQL_COMPLETION_KEY] as { dispose: () => void }).dispose();
    }

    // Register custom completion for SQL
    const disposable = monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: [' ', '.', ','],
      provideCompletionItems: (model: MonacoTextModel, position: MonacoPosition) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: word.endColumn,
        };

        const upper = textUntilPosition.toUpperCase();
        const suggestions: CompletionItem[] = [];

        // SQL keywords
        const keywords = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'AS', 'AND', 'OR', 'IN', 'NOT', 'BETWEEN', 'LIKE', 'ASC', 'DESC', 'HAVING', 'DISTINCT'];
        for (const kw of keywords) {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
          });
        }

        // Aggregation functions
        const fns = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'MEDIAN', 'P95', 'P99'];
        for (const fn of fns) {
          suggestions.push({
            label: fn,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: `${fn}($0)`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          });
        }

        // Table names (after FROM or JOIN)
        if (/FROM\s+$/i.test(upper) || /JOIN\s+$/i.test(upper)) {
          const tables = ['flows', 'traffic', 'routers', 'interfaces', 'bgp'];
          for (const t of tables) {
            suggestions.push({
              label: t,
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: t,
              range,
            });
          }
        }

        // Column names — use underscore versions of dimension/metric names
        const allColumns = [
          ...Object.keys(DIMENSION_POOLS).map(k => k.replace(/\./g, '_')),
          ...Object.keys(METRIC_RANGES).map(k => k.replace(/\./g, '_')),
          'time',
        ];
        const uniqueCols = [...new Set(allColumns)];
        for (const col of uniqueCols) {
          suggestions.push({
            label: col,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: col,
            range,
          });
        }

        return { suggestions };
      },
    });

    win[SQL_COMPLETION_KEY] = disposable;
  }, []);

  // Toggle accordion open/close for a saved widget
  const handleToggleWidget = useCallback((widget: QueryWidget) => {
    if (expandedWidgetId === widget.id) {
      setExpandedWidgetId(null);
      setExpandedWidgetName('');
      if (recommendations.length > 0) {
        setSelectedChartType(recommendations[0].chartType);
        setChartConfig(recommendations[0].defaultConfig);
      }
    } else {
      setExpandedWidgetId(widget.id);
      setExpandedWidgetName(widget.name);
      setSelectedChartType(widget.graphType);
      const rec = recommendations.find(r => r.chartType === widget.graphType);
      setChartConfig(widget.chartConfig || rec?.defaultConfig || null);
    }
  }, [expandedWidgetId, recommendations]);

  // Confirm update of the currently-expanded saved widget
  const handleUpdateWidget = useCallback(() => {
    if (!expandedWidgetId || !selectedChartType || !chartConfig) return;
    const name = expandedWidgetName.trim() || expandedWidgetId;
    setSavedWidgets(prev => prev.map(w =>
      w.id === expandedWidgetId ? { ...w, name, graphType: selectedChartType, chartConfig } : w
    ));
    setExpandedWidgetId(null);
    setExpandedWidgetName('');
    if (recommendations.length > 0) {
      setSelectedChartType(recommendations[0].chartType);
      setChartConfig(recommendations[0].defaultConfig);
    }
  }, [expandedWidgetId, expandedWidgetName, selectedChartType, chartConfig, recommendations]);

  // Save a brand-new widget from the Add Widget form
  const handleSaveNewWidget = useCallback(() => {
    if (!selectedChartType || !chartConfig) return;
    const name = newWidgetName.trim() || `Widget ${savedWidgets.length + 1}`;
    setSavedWidgets(prev => [...prev, { id: `widget-${Date.now()}`, name, graphType: selectedChartType, chartConfig }]);
    setNewWidgetName('');
  }, [selectedChartType, chartConfig, newWidgetName, savedWidgets.length]);

  // Delete a saved widget
  const handleDeleteWidget = useCallback((widgetId: string) => {
    setSavedWidgets(prev => prev.filter(w => w.id !== widgetId));
    if (expandedWidgetId === widgetId) {
      setExpandedWidgetId(null);
      setExpandedWidgetName('');
    }
  }, [expandedWidgetId]);

  const handleSave = () => {
    onSave({
      name: title || 'Untitled',
      description,
      script: sql,
      graphType: selectedChartType || 'table',
      chartConfig: chartConfig || undefined,
      widgets: savedWidgets,
      isPrivate,
    });
  };

  const handleSaveAsDraft = () => {
    onSaveAsDraft?.({
      name: title || 'Untitled',
      description,
      script: sql,
      graphType: selectedChartType || 'table',
      chartConfig: chartConfig || undefined,
      widgets: savedWidgets,
      isPrivate,
    });
  };

  const handleSaveAndNext = () => {
    setStep('widgets');
  };

  const stepLabel = mode === 'new' ? 'New Query' : mode === 'clone' ? 'Clone Query' : 'Edit Query';
  const widgetStepLabel = mode === 'new' ? 'Add Widgets' : mode === 'clone' ? 'Clone Widgets' : 'Edit Widgets';

  return (
    <div className={`${styles.container} ${inline ? styles.inline : ''}`}>
      {/* Step indicator */}
      <div className={styles.stepBar}>
        <button
          className={`${styles.stepBtn} ${step === 'query' ? styles.stepActive : styles.stepDone}`}
          onClick={() => setStep('query')}
        >
          1. {stepLabel}
        </button>
        <span className={styles.stepArrow}>›</span>
        <button
          className={`${styles.stepBtn} ${step === 'widgets' ? styles.stepActive : ''}`}
          onClick={() => step === 'widgets' && setStep('widgets')}
        >
          2. {widgetStepLabel}
        </button>
      </div>

      {/* Header: title + description + privacy + time */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <input
            className={`${styles.titleInput} ${mode === 'clone' && !title ? styles.titleRequired : ''}`}
            type="text"
            placeholder={mode === 'clone' ? 'Query name (required) *' : 'Query name...'}
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <input
            className={styles.descInput}
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        <div className={styles.headerRight}>
          <button
            className={`${styles.privacyToggle} ${isPrivate ? styles.privacyPrivate : styles.privacyPublic}`}
            onClick={() => setIsPrivate(!isPrivate)}
            title={isPrivate ? 'Private — only visible to you' : 'Public — visible to all users with access'}
          >
            {isPrivate ? <Lock size={13} /> : <Globe size={13} />}
            <span>{isPrivate ? 'Private' : 'Public'}</span>
          </button>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {/* Two-column body */}
      <div className={styles.body}>
        {/* Left column: full-width in step 1, hidden in step 2 */}
        <div className={`${styles.leftColumn} ${step === 'widgets' ? styles.hidden : styles.leftColumnFull}`}>
          <div className={styles.editorSection}>
            <div className={styles.aiAssistant}>
              <Sparkles size={14} className={styles.aiIcon} />
              <input
                className={styles.aiInput}
                type="text"
                placeholder={`e.g. "${NL_EXAMPLES[nlPlaceholderIdx]}"`}
                value={nlPrompt}
                onChange={e => setNlPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && nlPrompt.trim()) handleGenerate(); }}
              />
              <button
                className={styles.aiBtn}
                onClick={handleGenerate}
                disabled={!nlPrompt.trim()}
                title="Generate SQL from description"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          <div className={styles.editorWrapper}>
              <Editor
                height="300px"
                language="sql"
                theme="vs"
                value={sql}
                onChange={v => setSql(v || '')}
                onMount={handleEditorMount}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  fontSize: 13,
                  tabSize: 2,
                  wordWrap: 'on',
                  automaticLayout: true,
                  padding: { top: 8 },
                  scrollbar: { vertical: 'auto', horizontal: 'auto' },
                }}
              />
            </div>
            <div className={styles.editorControls}>
              <Button
                variant="primary"
                size="sm"
                icon={<Play size={14} />}
                onClick={executeQuery}
              >
                Run
              </Button>
              <button
                className={styles.autoRunToggle}
                onClick={() => setAutoRun(!autoRun)}
                title={autoRun ? 'Auto-run enabled' : 'Auto-run disabled'}
              >
                {autoRun ? <ToggleRight size={20} className={styles.toggleOn} /> : <ToggleLeft size={20} />}
                <span className={styles.autoRunLabel}>Auto</span>
              </button>
              {sqlError && <span className={styles.error}>{sqlError}</span>}
            </div>
          </div>

          {resultTable && (
            <div className={styles.resultSection}>
              <SqlResultTableView
                result={resultTable}
                isCollapsed={isTableCollapsed}
                onToggleCollapse={() => setIsTableCollapsed(!isTableCollapsed)}
              />
            </div>
          )}
        </div>

        {/* Right column: hidden in step 1, full-width two-column layout in step 2 */}
        <div className={`${styles.rightColumn} ${step === 'query' ? styles.hidden : styles.rightColumnFull}`}>

          {/* Step 2 LEFT: widget list + config form (scrollable) */}
          <div className={styles.step2Left}>

            {/* Saved widgets — accordion list */}
            {savedWidgets.length > 0 && (
              <div className={styles.widgetList}>
                <div className={styles.widgetListHeader}>
                  Saved Widgets ({savedWidgets.length})
                </div>
                {savedWidgets.map(widget => {
                  const isOpen = expandedWidgetId === widget.id;
                  return (
                    <div key={widget.id} className={`${styles.widgetAccordion} ${isOpen ? styles.widgetAccordionOpen : ''}`}>
                      <div className={styles.widgetAccordionHeader} onClick={() => handleToggleWidget(widget)}>
                        <ChevronRight size={14} className={`${styles.chevronIcon} ${isOpen ? styles.chevronOpen : ''}`} />
                        <span className={styles.widgetCardName}>{widget.name}</span>
                        <span className={styles.widgetCardType}>{widget.graphType}</span>
                        <button
                          className={`${styles.widgetActionBtn} ${styles.widgetActionDelete}`}
                          onClick={e => { e.stopPropagation(); handleDeleteWidget(widget.id); }}
                          title="Delete widget"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {isOpen && (
                        <div className={styles.widgetAccordionBody}>
                          <input
                            className={styles.widgetNameInput}
                            type="text"
                            placeholder="Widget name..."
                            value={expandedWidgetName}
                            onChange={e => setExpandedWidgetName(e.target.value)}
                          />
                          {resultTable && recommendations.length > 0 ? (
                            <>
                              <ChartTypeSelector
                                recommendations={recommendations}
                                selectedType={selectedChartType}
                                onSelect={handleChartTypeSelect}
                              />
                              {selectedChartType && chartConfig && (
                                <div className={styles.configPanel}>
                                  <ChartConfigPanel
                                    chartType={selectedChartType}
                                    config={chartConfig}
                                    columns={resultTable.columns}
                                    onChange={setChartConfig}
                                  />
                                </div>
                              )}
                            </>
                          ) : (
                            <div className={styles.accordionPlaceholder}>
                              Run a query first to edit chart settings
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Widget form — hidden while a saved widget accordion is open */}
            {!expandedWidgetId && (
              <div className={`${styles.widgetFormSection} ${savedWidgets.length === 0 ? styles.widgetFormFirst : ''}`}>
                <div className={styles.widgetFormHeader}>
                  <Plus size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Add Widget
                </div>
                <input
                  className={styles.widgetNameInput}
                  type="text"
                  placeholder="Widget name..."
                  value={newWidgetName}
                  onChange={e => setNewWidgetName(e.target.value)}
                />
                {resultTable && recommendations.length > 0 ? (
                  <>
                    <ChartTypeSelector
                      recommendations={recommendations}
                      selectedType={selectedChartType}
                      onSelect={handleChartTypeSelect}
                    />
                    {selectedChartType && chartConfig && (
                      <div className={styles.configPanel}>
                        <ChartConfigPanel
                          chartType={selectedChartType}
                          config={chartConfig}
                          columns={resultTable.columns}
                          onChange={setChartConfig}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.rightPlaceholder}>
                    <p>Run a query to see chart recommendations</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2 RIGHT: large chart preview + pinned action button */}
          <div className={styles.step2Right}>
            <div className={styles.step2PreviewArea}>
              {chartData ? (
                <ChartPreview data={chartData} />
              ) : (
                <div className={styles.chartPlaceholder}>
                  {resultTable
                    ? 'Configure chart settings to see a preview'
                    : 'Run a query first to see a chart preview'}
                </div>
              )}
            </div>
            {resultTable && recommendations.length > 0 && selectedChartType && chartConfig && (
              <div className={styles.widgetActionFooter}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={expandedWidgetId ? handleUpdateWidget : handleSaveNewWidget}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {expandedWidgetId ? 'Update Widget' : 'Save Widget'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className={styles.footer}>
        <div className={styles.footerRight}>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          {onSaveAsDraft && (
            <Button variant="secondary" size="sm" onClick={handleSaveAsDraft}>Save as Draft</Button>
          )}
          {step === 'query' ? (
            <Button variant="primary" size="sm" onClick={handleSaveAndNext} disabled={!title.trim()}>
              Save &amp; Next →
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={handleSave}>Save</Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Internal chart preview that renders from ChartDataResult
function ChartPreview({ data }: { data: ChartDataResult }) {
  // Reuse the existing chart rendering from QueryChart but directly with data
  // We import the individual chart components
  return <ChartPreviewRenderer data={data} />;
}

// Lazy import to avoid circular deps — render chart from ChartDataResult
import { TimeSeriesChart, BarChart, PieChart, GaugeChart, GeoMapChart, HeatmapChart, SankeyPreviewChart, TableChart, MultiBarChart, ChartExportWrapper } from '../charts';

function ChartPreviewRenderer({ data }: { data: ChartDataResult }) {
  const height = 400;

  switch (data.type) {
    case 'timeSeries':
      return (
        <ChartExportWrapper title="Preview">
          <TimeSeriesChart
            dynamicSeries={data.dynamicSeries}
            timestamps={data.timestamps}
            unit={data.unit}
            height={height}
            stacked={data.stacked}
          />
        </ChartExportWrapper>
      );
    case 'bar':
      return (
        <ChartExportWrapper title="Preview">
          <BarChart
            data={data.data}
            unit={data.unit}
            height={height}
            horizontal={data.horizontal}
          />
        </ChartExportWrapper>
      );
    case 'pie':
      return (
        <ChartExportWrapper title="Preview">
          <PieChart data={data.data} height={height} />
        </ChartExportWrapper>
      );
    case 'donut':
      return (
        <ChartExportWrapper title="Preview">
          <PieChart data={data.data} height={height} donut total={data.total} />
        </ChartExportWrapper>
      );
    case 'gauge':
      return (
        <ChartExportWrapper title="Preview">
          <GaugeChart
            value={data.value}
            min={data.min}
            max={data.max}
            thresholds={data.thresholds}
            label={data.label}
            height={height}
          />
        </ChartExportWrapper>
      );
    case 'singleValue':
      return (
        <ChartExportWrapper title="Preview">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height, gap: 8 }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--color-primary)' }}>
              {data.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              {data.label} {data.unit && `(${data.unit})`}
            </div>
            {data.comparePrevious && (
              <div style={{ fontSize: 13, color: data.comparePrevious.percent >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                {data.comparePrevious.percent >= 0 ? '+' : ''}{data.comparePrevious.percent}% vs {data.comparePrevious.period}
              </div>
            )}
          </div>
        </ChartExportWrapper>
      );
    case 'geoMap':
      return (
        <ChartExportWrapper title="Preview">
          <GeoMapChart data={data.data} height={height} />
        </ChartExportWrapper>
      );
    case 'heatmap':
      return (
        <ChartExportWrapper title="Preview">
          <HeatmapChart
            xLabels={data.xLabels}
            yLabels={data.yLabels}
            data={data.data}
            height={height}
          />
        </ChartExportWrapper>
      );
    case 'sankey':
      return (
        <ChartExportWrapper title="Preview">
          <SankeyPreviewChart nodes={data.nodes} links={data.links} height={height} />
        </ChartExportWrapper>
      );
    case 'stackedBar':
      return (
        <ChartExportWrapper title="Preview">
          <MultiBarChart
            categories={data.categories}
            series={data.series}
            height={height}
            stacked
            unit={data.unit}
          />
        </ChartExportWrapper>
      );
    case 'groupedBar':
      return (
        <ChartExportWrapper title="Preview">
          <MultiBarChart
            categories={data.categories}
            series={data.series}
            height={height}
            unit={data.unit}
          />
        </ChartExportWrapper>
      );
    case 'table':
      return <TableChart columns={data.columns} rows={data.rows} height={height} />;
    default:
      return <div className={styles.chartPlaceholder}>Unsupported chart type</div>;
  }
}
