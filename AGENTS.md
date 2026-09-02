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
- `pagesConfig/*.json`: Declarative dashboard definition. Top level is a `DashboardConfig` object: `{ reportName, filterLayout, filters, tabs }` (see Filtering framework). Each component carries `chartID`, `chartConfig`, and optional `filterBindings`.
- `pagesConfig/sql/<chartID>.sql`: SQL source for a chart. `chartID` maps directly to the SQL filename. Named parameters (`:name`) are bound from resolved filter values.
- `app/Dashboards/<DashboardName>/page.tsx`: Generated App Router page files. These are generated outputs, not the authoring surface for dashboards.
- `scripts/pages/generateNextPage.ts`: Creates `app/Dashboards/<DashboardName>/page.tsx` from `pagesConfig/index.ts` and the referenced JSON.
- `components/TabsWrapper/index.tsx`: Renders tab and row layout from declarative config and passes each chart config into `ChartWrapper`.
- `components/ChartWrapper/index.tsx`: Resolves the module by `moduleName`, fetches chart data from `/api/data/<chartID>`, validates it with the module's Zod schema, and injects runtime props.
- `app/api/data/[...chartIDs]/route.ts`: Loads `pagesConfig/sql/<chartID>.sql`, executes it, and returns the query result.
- `modules/modulRegistry.ts`: Auto-generated registry of available modules and the union of chart config types.
- `scripts/modules/generateModuleRegistry.ts`: Regenerates `modules/modulRegistry.ts` from module folders.
- `scripts/modules/validateModules.ts`: Validates the required module file contract.
- `modules/instructions.md`: High-level overview of the available modules and when to use them. Keep it up to date whenever module capabilities, intended usage, or the set of available modules changes.
- `modules/<ModuleName>/instructions.md`: Module-specific instructions. Detailed module behavior belongs there, not in this root file.

## Dashboard authoring model

For normal dashboard creation and updates, the agent should modify only:

- `pagesConfig/pages.json` when adding a new dashboard entry
- `pagesConfig/*.json` for `reportName`, `filterLayout`, `filters` (dimensions), tabs, rows, module selection, chart metadata, `filterBindings`, and module configuration
- `pagesConfig/sql/*.sql` for the data transformation feeding each chart

Do not implement dashboard-specific behavior in `app/` page components.

Do not change module implementation files for normal dashboard requests.

The runtime flow is:

1. `pagesConfig/index.ts` lists dashboards.
2. `scripts/pages/generateNextPage.ts` embeds the referenced JSON config into a generated page under `app/Dashboards/`.
3. The generated page renders `TabsWrapper` with `tabsConfig`.
4. `TabsWrapper` renders `ChartWrapper` for each configured component.
5. `ChartWrapper` resolves the configured `moduleName` from `moduleRegistry`.
6. `ChartWrapper` fetches `/api/data/<chartID>`.
7. The API route reads `pagesConfig/sql/<chartID>.sql` and executes the query.
8. `ChartWrapper` validates the returned array against the selected module's `chartDataSchema.ts`.
9. The module receives `ChartWrapperInjectedProps<...>` including `chartData`, loading/error state, configured metadata, and the optional `onSelectionChange` callback.

## Filtering framework

Dashboards share a filter framework driven entirely by config:

- **Dimensions** — `DashboardConfig.filters: FilterDimension[]`, each `{ id, label, type, scope, tab?, options?, defaultValue? }`.
  - `type`: `"string" | "number" | "dateString" | "dateRange" | "select"` (all single-value today).
  - `scope`: `"global"` (every tab) or `"tab"` (requires `tab` = the tab `trigger`).
- **Bindings** — each chart maps dimensions to its SQL named parameters via `filterBindings: Record<dimensionId, sqlParamName>`. `ChartWrapper` resolves the active value (`global:<id>` or `tab:<activeTab>:<id>`) and posts it; unset → `null`.
- **Layout** — `filterLayout: "sidebar" | "top"` controls where global filters render; `reportName` shows in the header.
- **Applied filters** — `ActiveFilters` renders removable chips and doubles as the print/export summary (interactive controls are `print:hidden`).

### Deferred queries (Apply to run)

Charts never fetch on dashboard open. Filter edits go into a **draft** layer and
only hit the warehouse when **Apply** is pressed.

- The store (`stores/filterProvider.ts`) splits values into `draftValues` (edited
  by controls via `setDraftFilter`) and `appliedValues` (drives queries + chips),
  plus a `hasApplied` gate (`false` until the first `applyFilters()` or snapshot
  hydration). `resetDraft()` discards pending edits; `isDirty(state)` reports
  draft ≠ applied.
- `ChartWrapper` reads `appliedValues`, sets `enabled: ... && hasApplied`, and
  renders an idle prompt until the first Apply.
- `components/FilterActions/index.tsx` renders **Apply**/**Reset**. It sits in the
  sidebar footer (`filterLayout: "sidebar"`) and the top bar (`filterLayout: "top"`).
- **Chip removal** (`clearDimension`) and **selection application** (`applySelection`)
  intentionally bypass the Apply gate: both write to draft _and_ applied layers and
  re-query immediately.
- Shared permalinks auto-apply on hydration (`useFilterUrlSync`) so recipients see
  data without pressing Apply; `useShareFilters` snapshots `appliedValues`.

### Selection

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
6. Write or update dashboard JSON so the module config is valid for that module's `chartType.d.ts`.
7. Keep the work declarative: JSON and SQL first, generated page second.

For module-development or framework work:

1. Use the `Development` agent.
2. Change module implementation only when the task is explicitly about module capabilities, shared framework behavior, registry generation, validation, or infrastructure.
3. When changing a module, keep the module contract valid before and after the edit.

## Editing rules for agents

- Prefer updating `pagesConfig/*.json` and `pagesConfig/sql/*.sql` over editing React files for dashboard requests.
- Treat generated `app/Dashboards/<DashboardName>/page.tsx` files as outputs, not as the primary authoring surface.
- `scripts/pages/generateNextPage.ts` does not overwrite an existing page directory; if a generated page already exists, the script skips it.
- Before changing any file inside a folder under `modules/`, verify that the folder already satisfies the required module contract.
- After changing any file inside a folder under `modules/`, verify again that the folder still satisfies the required module contract.
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
- `ChartConfigs` is generated as a union of module chart config types in `modules/modulRegistry.ts`.

## Agent Permissions

The default Copilot agent is intentionally read-only in this repository.

It may search, read, analyze, and explain repository contents, but it must not
create, modify, rename, or delete files and must not execute shell commands.

For repository modifications or command execution:

1. Select the `Development` agent first.
2. Start a new chat session after selecting the `Development` agent.
3. Perform implementation work only in that new session.

Selecting the `Development` agent inside an existing session is not sufficient.
A fresh session is required for the Development permissions to become active.

If the `Development` agent is unexpectedly blocked by a repository permission
hook, do not attempt to work around the hook. Select the `Development` agent
and start a fresh chat session, then retry the operation.
