<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project-specific guidance

## What this repository does

This is a config-driven Next.js dashboard MVP built on the App Router.
For normal dashboard work, the source of truth is declarative dashboard config plus SQL, not page-specific React code.

The intended end state is:

1. A user asks for one or more visualizations and names the source database tables.
2. The agent selects suitable existing modules from `modules/`.
3. The agent reads each selected module's `instructions.md`, `chartType.d.ts`, and `chartDataSchema.ts`.
4. The agent writes or updates dashboard JSON and SQL so the SQL output matches the module schema exactly.
5. Existing generation and runtime code render the dashboard without page-specific module implementation changes.

## Important paths

- `pagesConfig/pages.json`: Registry the generator reads — maps each `dashboardName` to its config JSON. (`pagesConfig/index.ts` is legacy and not used by generation.)
- `pagesConfig/*.json`: Declarative dashboard definition. Top level is a `DashboardConfig` object: `{ reportName, filters, tabs, actions? }`. Each component carries `chartID`, `chartConfig`, optional `filterBindings`, and optional `enhancedTooltip`.
- `pagesConfig/sql/<chartID>.sql`: SQL source for a chart. `chartID` maps directly to the SQL filename. The framework always binds one JSON object as `:input`; chart SQL declares its accepted filter and connection fields with `from_json` and a typed `STRUCT`.
- `pagesConfig/sql/tooltipSql/<chartID>.tooltip.sql`: Batched detail query for selected rows. It also returns exact `sourceField` aliases used by outgoing chart connection mappings.
- `app/Dashboards/<DashboardName>/page.tsx`: Generated App Router page files. These are generated outputs, not the authoring surface for dashboards.
- `scripts/pages/generateNextPage.ts`: Creates `app/Dashboards/<DashboardName>/page.tsx` from `pagesConfig/pages.json` and the referenced JSON.
- `components/TabsWrapper/index.tsx`: Renders tab and row layout, derives a dashboard-wide `chartID` to `chartTitle` map, and passes each chart config into `ChartWrapper`.
- `components/ChartWrapper/index.tsx`: Resolves the module by `moduleName`, fetches chart data from `/api/data/chart/<chartID>`, validates it with the module's Zod schema, owns selection/lasso/context-menu behavior, and injects runtime props.
- `app/api/data/chart/[...chartIDs]/route.ts`: Loads `pagesConfig/sql/<chartID>.sql`, executes it, and returns the query result.
- `app/api/data/chart/tooltip/route.ts`: Batches selected data points into one tooltip SQL execution and returns display and connection values.
- `modules/modulRegistry.ts`: Auto-generated registry of available modules and the union of chart config types.
- `scripts/modules/generateModuleRegistry.ts`: Regenerates `modules/modulRegistry.ts` from module folders.
- `scripts/modules/validateModules.ts`: Validates the required module file contract.
- `modules/instructions.md`: High-level overview of the available modules and when to use them. Keep it up to date whenever module capabilities, intended usage, or the set of available modules changes.
- `modules/<ModuleName>/instructions.md`: Module-specific instructions. Detailed module behavior belongs there, not in this root file.

## Dashboard authoring model

For normal dashboard creation and updates, the agent should modify only:

- `pagesConfig/pages.json` when adding a new dashboard entry
- `pagesConfig/*.json` for `reportName`, `filters` (dimensions), tabs, rows, module selection, chart metadata, `filterBindings`, `enhancedTooltip`, `actions`, and module configuration
- `pagesConfig/sql/*.sql` for chart data and target-side connection parameters
- `pagesConfig/sql/tooltipSql/*.tooltip.sql` for selected-row details and source-side connection aliases

Do not implement dashboard-specific behavior in `app/` page components.

Do not change module implementation files for normal dashboard requests.

The runtime flow is:

1. `pagesConfig/pages.json` lists dashboards.
2. `scripts/pages/generateNextPage.ts` embeds the referenced JSON config into a generated page under `app/Dashboards/`.
3. The generated page renders `TabsWrapper` with `tabsConfig`.
4. `TabsWrapper` renders `ChartWrapper` for each configured component.
5. `ChartWrapper` resolves the configured `moduleName` from `moduleRegistry`.
6. `ChartWrapper` fetches `/api/data/chart/<chartID>`.
7. The API route reads `pagesConfig/sql/<chartID>.sql` and executes the query.
8. `ChartWrapper` validates the returned array against the selected module's `chartDataSchema.ts`.
9. The module receives `ChartWrapperInjectedProps<...>` including `chartData`, loading/error state, configured metadata, and the optional `onSelectionChange` callback.

## Filtering framework

Dashboards share a filter framework driven entirely by config:

- **Dimensions** — `DashboardConfig.filters: FilterDimension[]`, each `{ id, label, type, control?, options?, defaultValue?, composition? }`.
  - `id` must be non-empty and unique across the complete dashboard. Do not reuse an ID between global and tab dimensions or between different tabs.
  - `type`: `"string" | "number" | "dateString" | "dateRange" | "select" | "multiselect" | "option"`. All are single-value except `multiselect`, which holds a `string[]`.
  - `select` and `multiselect` read their choices from `options`. `multiselect` renders a searchable combobox (Popover + Command) and binds to SQL as a comma-joined string.
  - `option` renders a segmented single-choice control where exactly one value is always selected (mandatory); it reads its choices from `options` and falls back to 2 default options when none are configured. It binds to SQL as a single string.
  - Options for `select` and `multiselect` may instead be loaded from the warehouse: set `optionsSource: "<id>"` on the dimension and add `pagesConfig/sql/filterOptions/<id>.sql` returning rows with a `value` column (and optional `label`; defaults to `value`). Options load eagerly on dashboard open via `GET /api/filters/options/<id>` and are **non-dependent** (the query runs with no filter parameters). Static `options` act as a fallback while loading or when no source is set.
  - `control`: `{ location: "dashboard" }` or `{ location: "tab", tab }`. Omit it for action-only dimensions.
  - `composition`: `{ sameSourceKind?, crossSourceKind? }`, each `"intersect" | "union"`.
    Several producers (control, tab jump, chart connections) may target the same dimension.
    `sameSourceKind` (default `"union"`) combines contributions sharing a `source.kind`;
    `crossSourceKind` (default `"intersect"`) combines the per-source-kind results, so a
    drilldown narrows what the control already allows. The rules apply to `select`,
    `multiselect`, and `option`; non-enumerable types accept multiple producers only
    when they agree on the value. `dateRange` cannot be expressed in a single SQL
    input field, so binding one is a config error.
    An empty composition result marks the chart's filters as impossible: it does not query and
    renders the conflict state instead.
- **Bindings** — each chart maps dimensions to fields in its SQL input object via `filterBindings: Record<dimensionId, inputFieldName>`. `ChartWrapper` resolves the active value (`global:<id>` or `tab:<activeTab>:<id>`) and posts it; the chart API serializes all fields together into `:input`. A `multiselect` value is posted as a comma-joined string (empty → `null`).
- **Layout** — Global filters render above the dashboard; `reportName` shows in the header.
- **Applied filters** — `ActiveFilters` renders removable chips and doubles as the print/export summary (interactive controls are `print:hidden`).

#### SQL for `multiselect`

A `multiselect` dimension binds as a comma-joined string. Charts must expand it
and treat an unset (`NULL`) value as "no filter":

```sql
WITH chart_input AS (
  SELECT from_json(CAST(:input AS STRING), 'STRUCT<region: STRING>') AS params
)
SELECT ...
FROM source
CROSS JOIN chart_input
WHERE (
  chart_input.params.region IS NULL
  OR array_contains(split(chart_input.params.region, ','), region_col)
)
```

Normal chart SQL must never reference dynamic markers such as `:region`,
`:from`, or connection column names directly. It must use only the fixed
`:input` marker. Missing JSON fields and explicit JSON `null` values both parse
as SQL `NULL`, so optional guards belong on `chart_input.params.<field>`. Charts
without runtime inputs may ignore the extra `:input` binding. Tooltip SQL is a
separate API contract and continues to use batched data-point markers such as
`:x` and `:id`.

### Deferred queries (Apply to run)

Charts never fetch on dashboard open. Filter edits go into a **draft** layer and
only hit the warehouse when **Apply** is pressed.

- The store (`stores/filterProvider.ts`) splits contributions into `draftContributions` (edited
  by controls via `setDraftFilter`) and `appliedContributions` (drives queries + chips),
  plus a `hasApplied` gate (`false` until the first `applyFilters()` or snapshot
  hydration). `resetDraft()` discards pending edits; `isDirty(state)` reports
  draft ≠ applied.
- `ChartWrapper` resolves applicable `appliedContributions`, sets `enabled: ... && hasApplied`, and
  renders an idle prompt until the first Apply.
- `components/FilterActions/index.tsx` renders **Apply**/**Reset** in the top filter bar.
- **Chip removal** (`removeContribution`) and **action application**
  (`applyPendingAction` / `applyActionContributions`) intentionally bypass the Apply
  gate: all write to draft _and_ applied layers and re-query immediately.
- **Alle zurücksetzen** (`clearAll`) returns to the seeded `defaultValue`
  contributions and back to the idle state instead of querying every chart
  unfiltered.
- Shared permalinks auto-apply on hydration (`useFilterUrlSync`) so recipients see
  data without pressing Apply; `useShareFilters` snapshots applied contributions.

### Selection, enhanced tooltips, and connections

Selection-capable modules report selected data through the optional
`onSelectionChange(rows)` callback injected by `ChartWrapper`. Selection processing is
framework behavior and does not add module-specific fields to dashboard configuration.
`ChartWrapper` stores the current original rows and injects them back into the module as
read-only `selectedRows`. Click and lasso selection use this same state. Data refetches and
relevant chart configuration changes invalidate the selection. Each module owns only the
chart-specific visual representation of those rows.

Lasso support is also framework behavior and is not configured per dashboard.
`ChartWrapper` injects a `lasso` controller and owns the toolbar, active mode, pointer
gesture, plot-clipped overlay, and dispatch. A module registers a runtime adapter:

- `select(shape)` enables lasso selection and returns the selected original data rows.
- `applyZoom(shape)` plus `resetZoom()` enable visual-only lasso zoom.
- `getPlotBounds()` reports the actual plot rectangle in pixels relative to the wrapper's
  interaction surface. Freehand selection polygons and rectangular zoom shapes use
  plot-normalized coordinates.

Selection calls the central `onSelectionChange(rows)` flow only when rows were found.
Zoom never calls that flow. Recharts-specific scales and hit detection stay inside the
module implementation. `LineChartModule` currently supports freehand polygon selection and
progressive rectangular X-axis zoom; other modules need not register an adapter.

Selection mode remains active after a completed gesture and supports repeated lasso draws.
Starting a new valid lasso gesture hides the previous tooltip; a successful selection may open
a new tooltip at the release position. The active toolbar button uses the primary color so the
mode remains visible.

When `enhancedTooltip: true`, `ChartWrapper` can open a compact, internally scrollable static
tooltip for the current selection. All selected rows are sent together to
`POST /api/data/chart/tooltip`. The endpoint keeps only named parameters referenced by the
tooltip SQL, deduplicates identical parameter tuples, and splits them into batches of 12,000
selected rows. Up to five tooltip SQL statements run concurrently across all tooltip requests
in one server process. `TOOLTIP_BATCH_SIZE` and `TOOLTIP_MAX_CONCURRENT_QUERIES` can override
these defaults. Successful results are streamed as NDJSON chunks of 250 rows so the frontend
can render them progressively; `TOOLTIP_STREAM_CHUNK_SIZE` overrides that delivery size. A failed
batch adds a partial-results warning but does not discard completed batches.

Tooltip SQL must be batch-union-safe: each selected parameter tuple must produce independent
result rows that can be appended to results from other batches. Do not use calculations across
the complete selection or global `LIMIT`/top-N semantics in batched tooltip SQL. Local grouping
by the selected value is supported. The API does not guarantee global ordering across batches.

Every referenced data-point property becomes a JSON array parameter, even for a single row.
SQL must parse the actual shape, for example scalar `x: number` as
`ARRAY<DOUBLE>`, `y: (number | null)[]` as `ARRAY<ARRAY<DOUBLE>>`, and a table
`values: Record<string, scalar>` object as an array of structs, maps, or variants matching its
known keys. Missing optional properties become `NULL` array entries; nested arrays and objects
are never flattened or coerced. Each request batches all selected rows; never issue one request
per row from a module. Tooltip state records its source `chartID`, and only that wrapper renders
the card.

### Selection, enhanced tooltips, and actions

Selection-capable modules report selected data through the optional
`onSelectionChange(rows)` callback injected by `ChartWrapper`. Selection processing is
framework behavior and does not add module-specific fields to dashboard configuration.
`ChartWrapper` stores the current original rows and injects them back into the module as
read-only `selectedRows`. Click and lasso selection use this same state. Data refetches and
relevant chart configuration changes invalidate the selection. Each module owns only the
chart-specific visual representation of those rows.

Lasso support is also framework behavior and is not configured per dashboard.
`ChartWrapper` injects a `lasso` controller and owns the toolbar, active mode, pointer
gesture, plot-clipped overlay, and dispatch. A module registers a runtime adapter:

- `select(shape)` enables lasso selection and returns the selected original data rows.
- `applyZoom(shape)` plus `resetZoom()` enable visual-only lasso zoom.
- `getPlotBounds()` reports the actual plot rectangle in pixels relative to the wrapper's
  interaction surface. Freehand selection polygons and rectangular zoom shapes use
  plot-normalized coordinates.

Selection calls the central `onSelectionChange(rows)` flow only when rows were found.
Zoom never calls that flow. Recharts-specific scales and hit detection stay inside the
module implementation. `LineChartModule` currently supports freehand polygon selection and
progressive rectangular X-axis zoom; other modules need not register an adapter.

Selection mode remains active after a completed gesture and supports repeated lasso draws.
Starting a new valid lasso gesture hides the previous tooltip; a successful selection may open
a new tooltip at the release position. The active toolbar button uses the primary color so the
mode remains visible.

When `enhancedTooltip: true`, `ChartWrapper` can open a compact, internally scrollable static
tooltip for the current selection. All selected rows are sent together to
`POST /api/data/chart/tooltip`. The endpoint keeps only named parameters referenced by the
tooltip SQL, deduplicates identical parameter tuples, and splits them into batches of 12,000
selected rows. Up to five tooltip SQL statements run concurrently across all tooltip requests
in one server process. `TOOLTIP_BATCH_SIZE` and `TOOLTIP_MAX_CONCURRENT_QUERIES` can override
these defaults. Successful results are streamed as NDJSON chunks of 250 rows so the frontend
can render them progressively; `TOOLTIP_STREAM_CHUNK_SIZE` overrides that delivery size. A failed
batch adds a partial-results warning but does not discard completed batches.

Tooltip SQL must be batch-union-safe: each selected parameter tuple must produce independent
result rows that can be appended to results from other batches. Do not use calculations across
the complete selection or global `LIMIT`/top-N semantics in batched tooltip SQL. Local grouping
by the selected value is supported. The API does not guarantee global ordering across batches.

Every referenced data-point property becomes a JSON array parameter, even for a single row.
SQL must parse the actual shape, for example scalar `x: number` as
`ARRAY<DOUBLE>`, `y: (number | null)[]` as `ARRAY<ARRAY<DOUBLE>>`, and a table
`values: Record<string, scalar>` object as an array of structs, maps, or variants matching its
known keys. Missing optional properties become `NULL` array entries; nested arrays and objects
are never flattened or coerced. Each request batches all selected rows; never issue one request
per row from a module. Tooltip state records its source `chartID`, and only that wrapper renders
the card.

Every rendered chart has a wrapper-owned right-click menu. **Tooltip anzeigen** is disabled
without selected rows or when `enhancedTooltip` is false. **Filtern** opens a unified submenu
categorized into **Auf diesem Tab** and **Auf anderen Tabs**:
- **Trigger**: `"manual"` (context menu / tooltip button) vs. `"auto"` (selection triggers immediately).
- **Source resolution**:
  - `"clientRow"`: in-memory lookup from `selectedRows` (supports top-level keys and `values.<col>`).
  - `"tooltipLookup"`: asynchronous warehouse query via `.tooltip.sql` (column aliases matching `sourceField`).
- **Target scope**: `{ kind: "chart", chartID }` vs. `{ kind: "tab", tab }`.
- **Navigation**: `navigate: { restoreOnReturn? }` (only valid on tab targets, requires `trigger: "manual"`). Navigating actions push breadcrumbs and switch tabs; non-navigating actions update filter contributions in-place.
- **Value cap**: default 500 distinct values per mapping (`maxDistinctValues`), guarding against oversized SQL inputs.

`DashboardConfig.actions` contains:
```ts
{
  id: string;
  fromChartID: string;
  target: { kind: "chart"; chartID: string } | { kind: "tab"; tab: string };
  sourceResolution: "clientRow" | "tooltipLookup";
  trigger?: "manual" | "auto"; // default "manual"
  navigate?: { restoreOnReturn?: boolean }; // tab targets only
  mappings: { sourceField: string; targetDimensionId: string }[];
  label?: string;
  maxDistinctValues?: number;
}
```

### Shareable state

Filter selections can be large, so they are never placed in the URL. `ShareButton` persists a snapshot via `POST /api/filters/snapshot` (Databricks table `filter_snapshots`) and shares a `?s=<id>&tab=<trigger>` permalink; only the small `activeTab` stays in the URL live.

## Module contract

- Every folder directly inside `modules/` may contain additional files and subfolders, but it must contain all of these required files without exception:
  - `index.tsx`
  - `chartDataSchema.ts`
  - `chartType.d.ts`
  - `instructions.md`
- `modules/<ModuleName>/index.tsx` must have a default export.
- The default-exported component in `modules/<ModuleName>/index.tsx` must use `ChartWrapperInjectedProps` as its props type. Example:

```ts
import type { ChartWrapperInjectedProps } from "@/types/baseChart";

type ExampleProps = ChartWrapperInjectedProps<ExampleChartData>;

const ExampleModule: React.FC<ExampleProps> = (props) => {
  // component implementation
};

export default ExampleModule;
```

- `modules/<ModuleName>/chartDataSchema.ts` must default-export a Zod schema and must also export the module data type.
- `modules/<ModuleName>/chartType.d.ts` must contain exactly one `type` declaration.
- Selection-capable charts receive the optional injected `onSelectionChange(rows)` prop and call it with the selected data rows.
- Modules receive read-only `selectedRows` from `ChartWrapper` and may render those rows
  using visualization-specific marks. Modules must not duplicate the selection state.
- Modules receive the injected `lasso` controller. Lasso-capable modules register only
  their chart-specific adapter; modules without lasso support do not register one.
- `modules/<ModuleName>/instructions.md` must follow `docs/instructions.template.md`.
- The `moduleName` used in dashboard JSON must match a key in `modules/modulRegistry.ts`.

## Agent workflow

For normal dashboard work:

1. Do not start from `app/` or from module implementation files.
2. Choose one or more existing modules that fit the requested visualization.
3. Read the selected module's `instructions.md`, `chartType.d.ts`, and `chartDataSchema.ts`.
4. Inspect the relevant source table schemas or existing schema exports.
5. Write SQL that transforms the source tables into exactly the shape required by the module schema.
6. For every enhanced tooltip or outgoing connection, write tooltip SQL and validate batched parameters plus the complete source-field to target-dimension contract.
7. Write or update dashboard JSON so the module config and connections are valid for that module's `chartType.d.ts` and the target table schemas.
8. Keep the work declarative: JSON and SQL first, generated page second.

For module-development or framework work:

1. Use the `Development`, "Implementation Agent", "Feature Planner", "Implementation Reviewer" or "Plan Reviewer" agent.
2. Change module implementation only when the task is explicitly about module capabilities, shared framework behavior, registry generation, validation, or infrastructure.
3. When changing a module, keep the module contract valid before and after the edit.

## Editing rules for agents

- Every file under `scripts/` must begin with an English comment of at most two lines that briefly states what the script does and why it exists.
- Shared client state and context-like state must be implemented exclusively
  with Zustand. Do not introduce React `createContext` or Context providers for
  application state.
- Prefer updating `pagesConfig/*.json` and `pagesConfig/sql/*.sql` over editing React files for dashboard requests.
- Treat generated `app/Dashboards/<DashboardName>/page.tsx` files as outputs, not as the primary authoring surface.
- `scripts/pages/generateNextPage.ts` does not overwrite an existing page directory; if a generated page already exists, the script skips it.
- Before changing any file inside a folder under `modules/`, verify that the folder already satisfies the required module contract.
- After changing any file inside a folder under `modules/`, verify again that the folder still satisfies the required module contract.
- Every commit that changes an implementation file below `modules/<ModuleName>/` must also stage updates to both `modules/<ModuleName>/instructions.md` and `modules/instructions.md`. The pre-commit hook enforces this rule against the staged files.
- This verification must confirm all of the following:
  - `index.tsx` exists and has a default export.
  - The default-exported component in `index.tsx` uses `ChartWrapperInjectedProps` as its props type.
  - `chartDataSchema.ts` exists and default-exports a Zod schema.
  - `chartDataSchema.ts` exports the module data type.
  - `chartType.d.ts` exists and contains exactly one `type` declaration.
  - `instructions.md` exists.
  - `instructions.md` follows `docs/instructions.template.md`.
- After changing module folders, run `npm run module:validate`.
- After adding, removing, renaming, or changing module exports, config types, or schema files, run `npm run module:generateRegistry`.
- Do not leave a module folder in a partially migrated or non-compliant state, even temporarily at the end of a task.
- If you add a new module, also add or update:
  - `modules/instructions.md`
  - `modules/<ModuleName>/instructions.md`
  - Any dashboard config that should reference the new module
- If an existing module changes in a way that affects its purpose, capabilities, or recommended usage, update `modules/instructions.md` as well.

## Known implementation details

- The component is named `TabsWrapper`, but it is the tab layout renderer for dashboards.
- `ChartWrapper` owns data fetching, empty/loading/error states, and schema validation.
- `ChartWrapper` also owns selection, enhanced tooltip state, lasso interaction, connection resolution, and the right-click context menu.
- `TabsWrapper` resolves user-facing connection labels from configured chart titles across all tabs.
- `ChartConfigs` is generated as a union of module chart config types in `modules/modulRegistry.ts`.

## Agent Permissions

The default Copilot agent is intentionally read-only in this repository.

It may search, read, analyze, and explain repository contents, but it must not
create, modify, rename, or delete files and must not execute shell commands.

Write and execution capability is unlocked by a per-session permission marker.
The following agents grant that marker automatically and may modify files and
run commands:

- `Development`
- `Dashboard` (restricted to `pagesConfig/` by its own `PreToolUse` hook)
- `Feature Planner`
- `Implementation Agent`
- `Implementation Reviewer`
- `Plan Reviewer`

`Feature Planner`, `Implementation Agent`, `Implementation Reviewer`, and
`Plan Reviewer` grant on both `SessionStart` and `UserPromptSubmit`, so their
capability becomes active on the first prompt after you select them — whether
you start a fresh session or switch to them inside a running session. The marker
persists for the rest of that session.

`Development` and `Dashboard` grant only on `SessionStart`. Selecting them inside
an existing session is not sufficient; a fresh session is required for their
permissions to become active.

For repository modifications or command execution:

1. Select a write-capable agent listed above.
2. For `Development` or `Dashboard`, start a new chat session after selecting it.
   For the four planner/implementation/reviewer agents, simply submit a prompt —
   the marker is granted before the first tool call, even mid-session.

If a write-capable agent is unexpectedly blocked by a repository permission
hook, do not attempt to work around the hook. For `Development` or `Dashboard`,
start a fresh chat session and retry. For the four planner/implementation/
reviewer agents, send one more prompt with that agent selected so its grant hook
runs, then retry the operation.
