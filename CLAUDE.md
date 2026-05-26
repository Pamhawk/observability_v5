# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Type-check (tsc -b) then build
npm run lint       # ESLint
npm run preview    # Preview production build
```

No test runner is configured.

## Architecture

**Stack:** React 19 + TypeScript + Vite. Routing via react-router-dom v7. Styling via CSS Modules (`.module.css` co-located with components) plus `src/styles/globals.css`.

**Routes** (defined in `src/App.tsx`):
- `/dashboard` → `EdgeProtectDashboard` — pre-built network observability dashboard
- `/observability` → `NetworkObservability` — ASN path analysis feature
- `/my-dashboards` → `MyDashboardsPage` (renders `QueriesPage`)
- `/my-queries` → `MyQueriesPage`

**Source layout:**
- `src/pages/` — top-level route components
- `src/components/layout/` — `Layout`, `Header`, `Sidebar`
- `src/components/charts/` — individual chart components
- `src/components/queries/` — query editor, chart config UI
- `src/components/asn-path-analysis/` — ASN path Sankey + table
- `src/components/common/` — shared UI primitives
- `src/data/mockData.ts` — all mock data (ASNs, routers, queries, dashboards, keywords)
- `src/types/index.ts` — all TypeScript types (single source of truth)
- `src/utils/` — pure utilities

## Charts

All charts use **ECharts** (`echarts-for-react`) **except** `SankeyDiagram.tsx` in `asn-path-analysis`, which uses D3 + d3-sankey.

- Use `notMerge` prop on `ReactECharts` whenever the series count can change between renders, otherwise stale series linger.
- `SankeyPreviewChart.tsx` (ECharts) is used for query-result Sankey previews; `SankeyDiagram.tsx` (D3) is used only in ASN Path Analysis.

## Query Pipeline

SQL-style query scripts flow through this pipeline inside `QueryChart.tsx`:

```
script (SQL string)
  → parseSQL()            src/utils/sqlParser.ts
  → executeMockSQL()      src/utils/sqlMockExecutor.ts   (returns SqlResultTable)
  → recommendCharts()     src/utils/chartRecommender.ts  (auto-picks best chart type)
  → adaptTableToChart()   src/utils/chartDataAdapter.ts  (returns ChartDataResult)
  → <ChartComponent>
```

`QueryChart` is the shared renderer used by `QueryEditor`, `MyQueries`, `QueriesPage`, and `AddQueryPopup`.

The custom DSL parser (`queryParser.ts`) handles a non-SQL query language; `sqlParser.ts` handles the SQL variant.

## Monaco Editor

- Keywords for autocomplete live in `mockData.ts` → `queryKeywords`.
- `registerCompletionItemProvider` stacks; always dispose the old provider before re-registering.
- Use `(window as any).__someFlag__` for HMR-safe module-level flags (plain `let` resets on Vite HMR).
- Set `wordBasedSuggestions: 'off'` to prevent the built-in word scanner from duplicating custom completions.

## Dashboard Grid

Uses `react-grid-layout`. `useContainerWidth()` returns a `mounted` flag — gate grid rendering on `mounted` to avoid width=0 causing wrong breakpoints and corrupted layouts.

## CSS Layout

The height chain uses `height: 100vh` (not `min-height`) on the root layout to enable proper overflow scrolling in child panels.
