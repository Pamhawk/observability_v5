import { useState, useRef, useMemo, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import { Save } from 'lucide-react';
import { Button, TimeRangeSelector } from '../common';
import { QueryChart } from './QueryChart';
import { queryKeywords } from '../../data/mockData';
import { DIMENSION_POOLS } from '../../utils/queryDataGenerator';
import type { Query, TimeRange } from '../../types';
import styles from './QueryEditor.module.css';

interface QueryEditorProps {
  query?: Query | null;
  onSave: (query: Partial<Query>) => void;
  onSaveAsDraft: (query: Partial<Query>) => void;
  onCancel: () => void;
  onChange?: (data: Partial<Query>) => void;
  inline?: boolean;
}

// ── Context-aware auto-complete ──

type CompletionContext =
  | { type: 'start' }
  | { type: 'afterGraphType' }
  | { type: 'afterAggregation' }
  | { type: 'afterMetric'; graphType?: string }
  | { type: 'afterAS' }
  | { type: 'afterBY' }
  | { type: 'afterWHERE' }
  | { type: 'afterWHERE_dimension'; dim: string }
  | { type: 'afterIS'; dim: string }
  | { type: 'afterFROM' }
  | { type: 'afterTO' }
  | { type: 'afterCOMPARE' }
  | { type: 'afterPREVIOUS' }
  | { type: 'afterLET' }
  | { type: 'afterLogical' }
  | { type: 'afterComma_BY' }
  | { type: 'afterComma_IS'; dim: string };

const GRAPH_TYPE_TOKENS = new Set(
  queryKeywords.graphTypes.map(g => g.toUpperCase())
);
const AGG_TOKENS = new Set(
  queryKeywords.aggregations.map(a => a.toUpperCase())
);
const METRIC_TOKENS = new Set(
  queryKeywords.metrics.map(m => m.toUpperCase())
);
const DIMENSION_TOKENS_UPPER = new Set(
  queryKeywords.dimensions.map(d => d.toUpperCase())
);
const LOGICAL_TOKENS = new Set(['AND', 'OR', 'AND NOT', 'OR NOT']);

function findDimensionMatch(token: string): string | undefined {
  const upper = token.toUpperCase();
  return queryKeywords.dimensions.find(d => d.toUpperCase() === upper);
}

function getCompletionContext(textUntilCursor: string, letVars: string[]): CompletionContext {
  // Strip block comments
  let text = textUntilCursor.replace(/\/\*[\s\S]*?\*\//g, '');
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  if (!text) return { type: 'start' };

  // Check if we end with a comma — need to determine if it's in BY or IS context
  if (text.endsWith(',')) {
    const beforeComma = text.slice(0, -1).trim();
    const upper = beforeComma.toUpperCase();

    // Check for IS context: ... IS value, or ... IS NOT value,
    const isMatch = upper.match(/(\S+)\s+IS(?:\s+NOT)?\s+.+$/);
    if (isMatch) {
      // Find the dimension before IS
      const dimPart = beforeComma.match(/([\w.]+)\s+IS(?:\s+NOT)?\s+/i);
      if (dimPart) {
        const dim = findDimensionMatch(dimPart[1]);
        if (dim) return { type: 'afterComma_IS', dim };
      }
    }

    // Check for BY context
    if (upper.includes(' BY ')) {
      return { type: 'afterComma_BY' };
    }

    // Default: might be TABLE aggregation list
    return { type: 'afterAggregation' };
  }

  // Tokenize by spaces (simplified)
  const tokens = text.split(/\s+/);
  const last = tokens[tokens.length - 1]?.toUpperCase() || '';
  const prev = tokens.length >= 2 ? tokens[tokens.length - 2]?.toUpperCase() || '' : '';
  const prevprev = tokens.length >= 3 ? tokens[tokens.length - 3]?.toUpperCase() || '' : '';

  // Check for IS NOT (two-word operator)
  if (last === 'NOT' && prev === 'IS') {
    // Find the dimension before IS
    const dimToken = tokens.length >= 3 ? tokens[tokens.length - 3] : '';
    const dim = findDimensionMatch(dimToken);
    if (dim) return { type: 'afterIS', dim };
  }

  // After IS — suggest values for the dimension
  if (last === 'IS') {
    const dimToken = tokens.length >= 2 ? tokens[tokens.length - 2] : '';
    const dim = findDimensionMatch(dimToken);
    if (dim) return { type: 'afterIS', dim };
  }

  // After a dimension that follows WHERE/AND/OR — suggest operators
  if (findDimensionMatch(tokens[tokens.length - 1] || '')) {
    // Check if this dimension was preceded by WHERE, AND, OR, AND NOT, OR NOT
    if (prev === 'WHERE' || prev === 'OR' || prev === 'AND' ||
        (prev === 'NOT' && (prevprev === 'AND' || prevprev === 'OR'))) {
      const dim = findDimensionMatch(tokens[tokens.length - 1])!;
      return { type: 'afterWHERE_dimension', dim };
    }
  }

  // After WHERE — suggest dimensions
  if (last === 'WHERE') return { type: 'afterWHERE' };

  // After AND/OR/AND NOT/OR NOT — suggest dimensions
  if (last === 'AND' || last === 'OR') {
    // Check if we're inside a WHERE (not BETWEEN...AND)
    const upper = text.toUpperCase();
    if (upper.includes(' WHERE ')) return { type: 'afterLogical' };
  }
  if (last === 'NOT' && (prev === 'AND' || prev === 'OR')) {
    return { type: 'afterLogical' };
  }

  // After BY — suggest dimensions
  if (last === 'BY') return { type: 'afterBY' };

  // After FROM — suggest dimensions
  if (last === 'FROM') return { type: 'afterFROM' };

  // After TO — suggest dimensions
  if (last === 'TO') return { type: 'afterTO' };

  // After AS — user types label in quotes
  if (last === 'AS') return { type: 'afterAS' };

  // After COMPARE — suggest PREVIOUS
  if (last === 'COMPARE') return { type: 'afterCOMPARE' };

  // After PREVIOUS — suggest time periods
  if (last === 'PREVIOUS') return { type: 'afterPREVIOUS' };

  // After LET — user types variable name
  if (last === 'LET') return { type: 'afterLET' };

  // After an aggregation function — suggest metrics
  if (AGG_TOKENS.has(last)) return { type: 'afterAggregation' };

  // After a metric or LET variable — suggest modifiers
  if (METRIC_TOKENS.has(last) || letVars.some(v => v.toUpperCase() === last)) {
    // Detect which graph type is in the script for context-specific suggestions
    const upper = text.toUpperCase();
    let graphType: string | undefined;
    if (upper.includes('SANKEY')) graphType = 'sankey';
    else if (upper.includes('SINGLE VALUE')) graphType = 'singleValue';
    else if (upper.includes('GAUGE')) graphType = 'gauge';
    return { type: 'afterMetric', graphType };
  }

  // After a quoted label (AS "...") — suggest modifiers
  if (text.match(/AS\s+"[^"]*"\s*$/i)) {
    const upper = text.toUpperCase();
    let graphType: string | undefined;
    if (upper.includes('SANKEY')) graphType = 'sankey';
    else if (upper.includes('SINGLE VALUE')) graphType = 'singleValue';
    else if (upper.includes('GAUGE')) graphType = 'gauge';
    return { type: 'afterMetric', graphType };
  }

  // After a graph type — suggest aggregation functions
  // Check multi-word graph types
  const upper = text.toUpperCase();
  const lastTwo = tokens.slice(-2).join(' ').toUpperCase();
  if (['STACKED AREA', 'TIME SERIES', 'SINGLE VALUE'].includes(lastTwo)) {
    return { type: 'afterGraphType' };
  }
  if (/TOP\s+\d+$/i.test(text)) return { type: 'afterGraphType' };
  if (GRAPH_TYPE_TOKENS.has(last) && !['TIME', 'STACKED', 'SINGLE'].includes(last)) {
    return { type: 'afterGraphType' };
  }

  // If the text only has LET statements and nothing else meaningful — suggest graph types
  const withoutLets = text.replace(/\bLET\s+\w+\s*=\s*[^)]*(?:\)|[^\s]*)/gi, '').trim();
  if (!withoutLets || withoutLets.match(/^\/\*.*\*\/\s*$/)) return { type: 'start' };

  // After IS value (in WHERE context, user typed a value and space) — suggest AND, OR, or modifiers
  // This is a catch-all for "we're somewhere in the middle"
  if (upper.includes(' IS ') && upper.includes(' WHERE ')) {
    // If last token looks like a value (not a keyword), suggest logical operators and modifiers
    if (!AGG_TOKENS.has(last) && !GRAPH_TYPE_TOKENS.has(last) &&
        !LOGICAL_TOKENS.has(last) && !DIMENSION_TOKENS_UPPER.has(last) &&
        !['WHERE', 'BY', 'FROM', 'TO', 'AS', 'LIMIT', 'COMPARE', 'PREVIOUS', 'IS', 'NOT', 'MIN', 'MAX', 'THRESHOLDS', 'LET', 'BETWEEN'].includes(last)) {
      return { type: 'afterMetric' };
    }
  }

  return { type: 'start' };
}

// Guard against multiple Monaco registrations (survives Vite HMR)
const MONACO_REG_KEY = '__queryDSL_registered__';
const MONACO_COMPLETION_KEY = '__queryDSL_completionDisposable__';

interface MonacoTextModel {
  getWordUntilPosition: (pos: { lineNumber: number; column: number }) => { startColumn: number; endColumn: number };
  getValueInRange: (range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }) => string;
  getValue: () => string;
}
interface MonacoPosition { lineNumber: number; column: number }
interface CompletionItem {
  label: string; kind: number; insertText: string;
  range: { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number };
  detail?: string; sortText?: string; insertTextRules?: number; documentation?: string;
}
type WinStore = Record<string, unknown>;

export function QueryEditor({ query, onSave, onSaveAsDraft, onCancel, onChange, inline }: QueryEditorProps) {
  const [title, setTitle] = useState(query?.name || '');
  const [description, setDescription] = useState(query?.description || '');
  const [script, setScript] = useState(query?.script || '');
  const [graphType, setGraphType] = useState<Query['graphType']>(query?.graphType || 'bar');
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    preset: '1h',
    start: new Date(Date.now() - 60 * 60 * 1000),
    end: new Date(),
  }));
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  // Report changes to parent (for auto-save-as-draft on outside click)
  useEffect(() => {
    onChange?.({
      name: title,
      description,
      script,
      graphType,
    });
  }, [title, description, script, graphType, onChange]);

  // Auto-detect graph type from script content
  const detectedGraphType = useMemo(() => {
    const cleaned = script.replace(/\/\*[\s\S]*?\*\//g, '');
    const upper = cleaned.toUpperCase().trim();
    if (upper.includes('STACKED AREA')) return 'stackedArea' as const;
    if (upper.includes('TIME SERIES')) return 'timeSeries' as const;
    if (upper.includes('SINGLE VALUE')) return 'singleValue' as const;
    if (/TOP\s+\d+/.test(upper)) return 'topNBar' as const;
    if (upper.includes('HEATMAP')) return 'heatmap' as const;
    if (upper.includes('SANKEY')) return 'sankey' as const;
    if (upper.includes('GAUGE')) return 'gauge' as const;
    if (/\bGEO\b/.test(upper)) return 'geoMap' as const;
    if (/\bDONUT\b/.test(upper)) return 'donut' as const;
    if (/\bPIE\b/.test(upper)) return 'pie' as const;
    if (/\bBAR\b/.test(upper)) return 'bar' as const;
    if (/\bTABLE\b/.test(upper)) return 'table' as const;
    return null;
  }, [script]);

  const hasPreview = script.trim().length > 0 && detectedGraphType !== null;
  const activeGraphType = detectedGraphType || graphType;

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Language, theme, and tokenizer are idempotent — register once
    const win = window as unknown as WinStore;
    if (!win[MONACO_REG_KEY]) {
      win[MONACO_REG_KEY] = true;

      monaco.languages.register({ id: 'queryDSL' });

      // Custom theme matching Query DSL Reference v5 Word document colors
      monaco.editor.defineTheme('queryDSLTheme', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '9CA3AF', fontStyle: 'italic' },
          { token: 'type', foreground: '2563EB', fontStyle: 'bold' },          // Graph types — Blue
          { token: 'function', foreground: '7C3AED', fontStyle: 'bold' },      // Aggregations — Purple
          { token: 'metricsToken', foreground: '059669' },                      // Metrics — Green
          { token: 'variable', foreground: '0891B2' },                          // Dimensions — Teal
          { token: 'keyword', foreground: 'EA580C', fontStyle: 'bold' },       // Modifiers — Orange
          { token: 'operatorWord', foreground: '4B5563' },                      // IS, NOT, AND, OR — Dark gray
          { token: 'operator', foreground: '4B5563' },                          // ==, !=, etc — Dark gray
          { token: 'number', foreground: 'B91C1C' },                            // Numbers — Dark red
          { token: 'string', foreground: 'DC2626' },                            // Strings — Red
          { token: 'valueToken', foreground: 'DC2626' },                        // Values — Red
          { token: 'delimiter', foreground: '6B7280' },                         // Commas, arithmetic — Gray
          { token: 'delimiter.parenthesis', foreground: '6B7280' },             // () — Gray
        ],
        colors: {
          'editor.background': '#FAFAFA',
        },
      });

      // Monarch tokenizer with v5-accurate token categories
      monaco.languages.setMonarchTokensProvider('queryDSL', {
        graphTypeWords: [
          'TIME', 'SERIES', 'STACKED', 'AREA', 'SINGLE', 'VALUE',
          'PIE', 'DONUT', 'BAR', 'TOP', 'GAUGE', 'GEO', 'HEATMAP', 'SANKEY', 'TABLE',
        ],
        functions: queryKeywords.aggregations,
        metrics: queryKeywords.metrics,
        dimensions: queryKeywords.dimensions,
        modifiers: [
          'BY', 'WHERE', 'LIMIT', 'LET', 'AS', 'FROM', 'TO',
          'COMPARE', 'PREVIOUS', 'THRESHOLDS',
        ],
        operators: ['IS', 'NOT', 'AND', 'OR', 'BETWEEN'],

        tokenizer: {
          root: [
            [/\/\*/, 'comment', '@comment'],
            [/\d+[hdwm]\b/, 'number'],
            [/\d+/, 'number'],
            [/"[^"]*"/, 'string'],
            [/[a-zA-Z_][\w.]*/, {
              cases: {
                '@functions': 'function',
                '@metrics': 'metricsToken',
                '@dimensions': 'variable',
                '@modifiers': 'keyword',
                '@operators': 'operatorWord',
                '@graphTypeWords': 'type',
                '@default': 'valueToken',
              }
            }],
            [/[=!<>]+/, 'operator'],
            [/[*/+-]/, 'delimiter'],
            [/[()]/, 'delimiter.parenthesis'],
            [/,/, 'delimiter'],
          ],
          comment: [
            [/\*\//, 'comment', '@pop'],
            [/./, 'comment'],
          ],
        },
      });

    } // end language/theme/tokenizer guard

    // Completion provider: dispose previous and re-register
    // (registerCompletionItemProvider stacks — must dispose old on HMR reload)
    if (win[MONACO_COMPLETION_KEY]) {
      (win[MONACO_COMPLETION_KEY] as { dispose: () => void }).dispose();
    }
    win[MONACO_COMPLETION_KEY] = monaco.languages.registerCompletionItemProvider('queryDSL', {
      provideCompletionItems: (model: MonacoTextModel, position: MonacoPosition) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        // Get all text from start to cursor
        const textUntilCursor = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Extract LET variable names from the full text
        const fullText = model.getValue();
        const letVars: string[] = [];
        const letRegex = /\bLET\s+(\w+)\s*=/gi;
        let lm: RegExpExecArray | null;
        while ((lm = letRegex.exec(fullText)) !== null) {
          letVars.push(lm[1]);
        }

        const ctx = getCompletionContext(textUntilCursor, letVars);
        const suggestions: CompletionItem[] = [];

        switch (ctx.type) {
          case 'start':
            suggestions.push(
              ...queryKeywords.graphTypes.map(g => ({
                label: g, kind: monaco.languages.CompletionItemKind.Class,
                insertText: g + ' ', range, detail: 'Graph Type', sortText: '0' + g,
              })),
              { label: 'LET', kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: 'LET ', range, detail: 'Variable definition', sortText: '1LET' },
              { label: '/*', kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: '/* ${1:comment} */\n', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range, detail: 'Comment', sortText: '2comment' },
            );
            break;

          case 'afterGraphType':
            suggestions.push(
              ...queryKeywords.aggregations.map(fn => ({
                label: fn, kind: monaco.languages.CompletionItemKind.Function,
                insertText: fn + ' ', range, detail: 'Aggregation',
              })),
              ...letVars.map(v => ({
                label: v, kind: monaco.languages.CompletionItemKind.Variable,
                insertText: v + ' ', range, detail: 'LET Variable',
              })),
            );
            break;

          case 'afterAggregation':
            suggestions.push(
              ...queryKeywords.metrics.map(m => ({
                label: m, kind: monaco.languages.CompletionItemKind.Field,
                insertText: m + ' ', range, detail: 'Metric',
              })),
            );
            break;

          case 'afterMetric': {
            const mods = [
              { label: 'AS', detail: 'Display label' },
              { label: 'BY', detail: 'Group by dimension' },
              { label: 'WHERE', detail: 'Filter condition' },
              { label: 'LIMIT', detail: 'Limit results' },
            ];
            if (ctx.graphType === 'sankey') {
              mods.push({ label: 'FROM', detail: 'Source dimension' });
              mods.push({ label: 'TO', detail: 'Target dimension' });
            }
            if (ctx.graphType === 'singleValue') {
              mods.push({ label: 'COMPARE PREVIOUS', detail: 'Compare with previous period' });
            }
            if (ctx.graphType === 'gauge') {
              mods.push({ label: 'MIN', detail: 'Gauge minimum' });
              mods.push({ label: 'MAX', detail: 'Gauge maximum' });
              mods.push({ label: 'THRESHOLDS', detail: 'Warning and critical thresholds' });
            }
            mods.push({ label: 'AND', detail: 'Additional condition' });
            mods.push({ label: 'OR', detail: 'Alternative condition' });
            suggestions.push(
              ...mods.map(m => ({
                label: m.label, kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: m.label + ' ', range, detail: m.detail,
              })),
            );
            break;
          }

          case 'afterAS':
            break;

          case 'afterBY':
          case 'afterComma_BY':
          case 'afterWHERE':
          case 'afterLogical':
          case 'afterFROM':
          case 'afterTO':
            suggestions.push(
              ...queryKeywords.dimensions.map(d => ({
                label: d, kind: monaco.languages.CompletionItemKind.Variable,
                insertText: d + ' ', range, detail: 'Dimension',
              })),
            );
            break;

          case 'afterWHERE_dimension':
            suggestions.push(
              { label: 'IS', kind: monaco.languages.CompletionItemKind.Operator,
                insertText: 'IS ', range, detail: 'Equals' },
              { label: 'IS NOT', kind: monaco.languages.CompletionItemKind.Operator,
                insertText: 'IS NOT ', range, detail: 'Not equals' },
              { label: '==', kind: monaco.languages.CompletionItemKind.Operator,
                insertText: '== ', range, detail: 'Equals (numeric)' },
              { label: '!=', kind: monaco.languages.CompletionItemKind.Operator,
                insertText: '!= ', range, detail: 'Not equals (numeric)' },
              { label: '>', kind: monaco.languages.CompletionItemKind.Operator,
                insertText: '> ', range, detail: 'Greater than' },
              { label: '>=', kind: monaco.languages.CompletionItemKind.Operator,
                insertText: '>= ', range, detail: 'Greater or equal' },
              { label: '<', kind: monaco.languages.CompletionItemKind.Operator,
                insertText: '< ', range, detail: 'Less than' },
              { label: '<=', kind: monaco.languages.CompletionItemKind.Operator,
                insertText: '<= ', range, detail: 'Less or equal' },
              { label: 'BETWEEN', kind: monaco.languages.CompletionItemKind.Operator,
                insertText: 'BETWEEN ', range, detail: 'Range (inclusive)' },
            );
            break;

          case 'afterIS':
          case 'afterComma_IS': {
            const pool = DIMENSION_POOLS[ctx.dim] || [];
            suggestions.push(
              ...pool.map(v => ({
                label: v, kind: monaco.languages.CompletionItemKind.Value,
                insertText: v, range, detail: `${ctx.dim} value`,
              })),
            );
            break;
          }

          case 'afterCOMPARE':
            suggestions.push({
              label: 'PREVIOUS', kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: 'PREVIOUS ', range, detail: 'Compare with previous period',
            });
            break;

          case 'afterPREVIOUS':
            for (const p of ['1h', '6h', '12h', '24h', '7d', '30d']) {
              suggestions.push({
                label: p, kind: monaco.languages.CompletionItemKind.Value,
                insertText: p, range, detail: 'Time period',
              });
            }
            break;

          case 'afterLET':
            break;
        }

        return { suggestions };
      },
      triggerCharacters: [' ', '.', ','],
    });
  };

  // Update graphType when auto-detection changes
  if (detectedGraphType && detectedGraphType !== graphType) {
    setGraphType(detectedGraphType);
  }

  const handleSave = () => {
    onSave({
      name: title || 'Untitled Query',
      description,
      script,
      graphType: activeGraphType,
      isDraft: false,
    });
  };

  const handleSaveAsDraft = () => {
    onSaveAsDraft({
      name: title || 'Untitled Query',
      description,
      script,
      graphType: activeGraphType,
      isDraft: true,
    });
  };

  const renderPreview = () => {
    if (!hasPreview) {
      return (
        <div className={styles.previewPlaceholder}>
          <p>Start writing your query to see a preview</p>
        </div>
      );
    }

    return <QueryChart script={script} height={350} title={title} timePreset={timeRange.preset} />;
  };

  return (
    <div className={`${styles.container} ${inline ? styles.inline : ''}`}>
      {/* Title + Description row */}
      <div className={styles.titleWrapper}>
        <div className={styles.titleFields}>
          <input
            type="text"
            placeholder="Write your title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.titleInput}
          />
          <input
            type="text"
            placeholder="Add a description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={styles.descriptionInput}
          />
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Editor + Preview side by side */}
      <div className={styles.mainArea}>
        <div className={styles.editorSection}>
          <div className={styles.editorWrapper}>
            <Editor
              height="100%"
              language="queryDSL"
              value={script}
              onChange={(value) => setScript(value || '')}
              onMount={handleEditorMount}
              theme="queryDSLTheme"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 2,
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                wordBasedSuggestions: 'off',
              }}
            />
          </div>
        </div>

        <div className={styles.previewSection}>
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>{title || 'Query Preview'}</span>
          </div>
          <div className={styles.previewContent}>
            {renderPreview()}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={handleSaveAsDraft}>
          Save as Draft
        </Button>
        <Button variant="primary" icon={<Save size={16} />} onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
