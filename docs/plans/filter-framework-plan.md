# Config-Driven Global Filter Framework — Implementation Plan

## Goal
Add a shared filtering framework to the config-driven Next.js dashboard: global + tab-level + cross-tab drill filters, canonical dimensions mapped to per-chart SQL parameters, URL-shareable state, and applied-filter display (chips + print). Everything stays declarative (JSON + SQL); modules remain config-driven renderers.

## Confirmed decisions
- **State management:** Zustand store + URL-sync middleware, context-scoped per dashboard.
- **Mapping model:** Central filter *dimensions* + per-chart `filterBindings` (dimensionId → sqlParamName).
- **Scopes:** global, tab-level, cross-tab drill. **Replace** the existing chart-local `filterConfig`/`ChartFilters` model with the dimension-based model.
- **Drill selection:** implement for **both** `MapModule` and `LineChartModule`.
- **Applied-filter display:** chip bar + print/export summary.
- **Global filter placement:** configurable via dashboard `filterLayout: "sidebar" | "top"`; `"top"` sits below a new dashboard `reportName`.

## Breaking config shape change
Top-level dashboard config becomes an object (was `TabsConfig[]`):

```jsonc
{
  "reportName": "string",
  "filterLayout": "sidebar" | "top",
  "filters": [ /* FilterDimension[] */ ],
  "tabs": [ /* TabsConfig[] */ ]
}
```

- **FilterDimension:** `{ id, label, type: "string" | "number" | "dateString" | "dateRange" | "select", scope: "global" | "tab", tab?, options?, defaultValue? }`
- **TabsComponentConfig** gains:
  - `filterBindings: Record<dimensionId, sqlParamName>`
  - `drill?: { targetTab, selectionMode: "single" | "multi", selectionBindings: Record<selectionKey, dimensionId> }`
- Remove `filterConfig` from `BaseChartProps` (`types/baseChart.d.ts`). No module `index.tsx` reads `filterConfig` today (only docs reference it), so this is code-safe — but the `filterConfig` field must also be removed from every component in `cudoTest.json` and from `LineChartModule/instructions.md`. Note `ChartWrapper` currently spreads `{...baseProps}` (incl. `filterConfig`) into the module, so that spread must be reworked.

## Store
`stores/filterProvider.tsx` — Zustand + per-dashboard context. **Zustand is not yet a dependency — run `npm install zustand` in Phase 1.**
- Keys: `global:<dimId>`, `tab:<tabId>:<dimId>`, plus `activeTab`.
- Actions: `setFilter`, `clearDimension`, `clearAll`, `applySelection(entries, navigateTo?)`, `setActiveTab`.
- URL handling via `hooks/useFilterUrlSync.ts`: keeps the small `activeTab` in the URL live; **filters are NOT written to the URL** (selections can be large, e.g. 200+ FINs). Shareable state uses server-side snapshots instead (see Shareable state).

## ChartWrapper changes — `components/ChartWrapper/index.tsx`
- Merge global + active-tab dimension values → map through `filterBindings` → build params object.
- Include params in the React Query key **and** POST body.
- Remove `useChartState` / `ChartFilters` rendering.
- When `drill` is configured, pass `onSelectionChange` + `selectionMode` to the module; on selection call `applySelection(entries, drill.targetTab)` (navigates only when `targetTab` is set).

## Module contract change
- Extend `ChartWrapperInjectedProps` with optional `selectionMode?` and `onSelectionChange?(rows)`.
- Wire multi-select in `MapModule` (regions/points) and `LineChartModule` (points/brush).
- Update each module's `instructions.md` (+ `chartType.d.ts` if needed).
- Run `npm run module:validate` and `npm run module:generateRegistry`.

## New components
- `components/DashboardShell` — `reportName` + sidebar|top filter bar + controlled tabs.
- `components/FilterBar` — global dimension controls.
- `components/TabFilters` — tab-scoped controls.
- `components/FilterControl` — per-type input (reuse `ChartFilters` logic; add `select` + `dateRange`).
- `components/ActiveFilters` — chip bar + `@media print` export summary.
- `components/ShareButton` — creates a server-side snapshot and copies a permalink.

## Shareable state (permalink snapshots)
Filter selections can be large, so they are never serialized into the URL. Instead:
- `POST /api/filters/snapshot` persists `{ dashboard, state: { values, activeTab } }` and returns a short `id`.
- `GET /api/filters/snapshot/<id>` returns the stored snapshot.
- Share links use `?s=<id>&tab=<trigger>`; on load, `useFilterUrlSync` fetches the snapshot and hydrates, then strips `s`.
- Storage: Databricks Delta table `filter_snapshots(id, dashboard, state, created_at)` in ``westeurope_extollo_2026007fielddatadev75cd75`.`2018001_cudo_mvp_dev``` via the existing `runQuery` client (catalog/schema overridable through `FILTER_SNAPSHOT_CATALOG` / `FILTER_SNAPSHOT_SCHEMA`).

## Generation + provider — `scripts/pages/generateNextPage.ts`
- The generator reads its dashboard registry from **`pagesConfig/pages.json`** (not `pagesConfig/index.ts`, which is stale/unused and still references a non-existent `cudo-test`). `pages.json` already maps `cudoTest` → `cudoTest.json`; no registry edit needed.
- The config is currently cast to `TabsConfig[]` and JSON-stringified into the page. Update the cast + template to the new config-object shape; render `DashboardShell` wrapped in `FilterProvider`, passing `reportName`, `filterLayout`, `filters`, and `tabs`.
- ⚠️ The script skips existing page dirs — delete `app/Dashboards/cudoTest/page.tsx` to regenerate under the new shape.

## Migration
Rewrite `pagesConfig/cudoTest.json` to the new shape: wrap the current `TabsConfig[]` under `tabs`, add `reportName`, `filterLayout`, and `filters` (dimensions for `ecu_fault_nm`, `fin`). Replace each component's `filterConfig` array with a `filterBindings` map (`ecu_fault_nm` → `ecu_fault_nm`, `fin` → `fin`). Single-select SQL already uses `:ecu_fault_nm` / `:fin` — keep as-is unless the chart becomes a drill target (see SQL notes).

## Backend / SQL notes
- `app/api/data/[...chartIDs]/route.ts` `RequestBody` is currently `{ filters?: { from?: string; to?: string } }` (nested under `filters`, and already stale — runtime sends `filters` keyed by param name, e.g. `ecu_fault_nm`/`fin`). Widen the inner `filters` value to `Record<string, QueryParameterValue>`. `runQuery(query, parameters)` already accepts `QueryParameters` (= `Record<string, QueryParameterValue>`) and passes it as `namedParameters` — no warehouse change.
- `QueryParameterValue` is scalar (`string | number | boolean | bigint | Date | null`) — **no array support**. Multi-select drill must pass a comma-joined string; each drill-target SQL predicate must be rewritten from the current `COALESCE(:p,'')='' OR col=:p` form to `(:p IS NULL OR array_contains(split(:p, ','), col))`. This is a per-target SQL edit, not just a param widen. *(Confirm approach before Phase 6.)*

## Phases
1. `npm install zustand` + types + config shape + store foundation (`FilterProvider`, URL-sync stub).
2. `ChartWrapper` param resolution (global + tab) + API route body widening + migrate `cudoTest.json` (incl. removing `filterConfig`) + delete & regenerate page from the new template.
3. Filter UI: `DashboardShell` layout (sidebar/top), `FilterBar`, `TabFilters`, `FilterControl`.
4. Shareable links via server-side filter snapshots (permalink `?s=<id>`); `activeTab` synced live in URL.
5. `ActiveFilters` chip bar + print/export summary.
6. Drill: module callback contract + `MapModule` + `LineChartModule` wiring + navigation; multi-select SQL strategy.
7. Docs (`AGENTS.md`, module instructions incl. removing `filterConfig` references), `module:validate`, `module:generateRegistry`, typecheck/lint.

## Verification
- `npx tsc --noEmit` and `npm run lint` clean.
- `npm run module:validate` + `npm run module:generateRegistry` pass and leave no uncommitted registry drift.
- Manual smoke test of `cudoTest`: global + tab filters change chart data, drill navigates tabs and applies selection, applied-filter chips render, URL round-trips (shareable link restores state), and print/export summary shows active filters.
