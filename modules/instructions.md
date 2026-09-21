# Modules overview

This folder contains reusable dashboard modules that can be referenced from `pagesConfig/*.json` and rendered through generated pages in `app/`.

## How modules are used

1. A dashboard JSON file references a module through the `moduleName` field on a component, for example `"moduleName": "LineChartModule"`. The value must match a key in `modules/modulRegistry.ts`.
2. `scripts/pages/generateNextPage.ts` embeds the dashboard JSON into the generated page; it does not import modules directly.
3. At runtime, `TabsWrapper` renders a `ChartWrapper` for each configured component.
4. `ChartWrapper` resolves the module from `modules/modulRegistry.ts` via `moduleName` (a dynamic import), fetches `/api/data/chart/<chartID>`, validates the result against the module's Zod schema, and injects props including `height`, `chartData`, selection/lasso controls, and loading/error state.

## Module contract

- Each module lives in its own folder: `modules/<ModuleName>/` and must contain `index.tsx`, `chartDataSchema.ts`, `chartType.d.ts`, and `instructions.md`.
- `index.tsx` must have a **default export**, and that component must use `ChartWrapperInjectedProps` as its props type.
- Module resolution is by the registry key in `modules/modulRegistry.ts`, which must match the `moduleName` used in dashboard JSON.
- `chartDataSchema.ts` must default-export a Zod schema and also export the module data type.
- `chartType.d.ts` must contain exactly one `type` declaration.
- `instructions.md` must follow `docs/instructions.template.md` and describe purpose, data contract, config, and usage.
- Every implementation change below `modules/<ModuleName>/` must update and stage both `modules/<ModuleName>/instructions.md` and this file in the same commit. The repository pre-commit hook enforces this for staged files.
- Selection-capable modules call the injected `onSelectionChange(rows)` when the user selects data. `ChartWrapper` owns the resulting state and injects the current rows as read-only `selectedRows`; modules only render the appropriate visualization-specific highlight. `LineChartModule` (point click) and `MapModule` (region/bubble click) support selection.
- Lasso capabilities are discovered at runtime through the injected `lasso` controller.
  Registering `select` enables selection; registering `applyZoom` and `resetZoom` enables
  visual zoom. `LineChartModule` currently supports both. This is framework/module behavior,
  not dashboard configuration.
- Enhanced tooltip and chart-connection UI belongs to `ChartWrapper`, not to modules. With
  `enhancedTooltip: true`, selected rows can open a static detail tooltip and reopen it from
  the wrapper-owned right-click menu. The menu disables unavailable actions automatically.
- Tooltip and connection requests batch all selected rows. Every data-point property reaches
  tooltip SQL as a JSON array parameter; SQL must parse scalar and nested-array shapes with the
  correct Databricks type.
- Outgoing chart connections are resolved from source tooltip SQL. Each mapping's `sourceField`
  must be an exact result alias containing atomic values, and its `targetDimensionId` must name a
  `multiselect` dimension that the target chart binds in `filterBindings` and parses from its
  `:input` struct.
- `TabsWrapper` maps every configured `chartID` to its `chartTitle` across tabs so the context
  menu shows user-facing target names. Connected charts should always have useful titles;
  untitled targets display `Unbenanntes Diagramm` rather than an internal ID.

## Modules currently available

### `LineChartModule`

- Purpose: Renders a configurable multi-series line or area chart from compact numeric API data.
- Best use: Visualizing one or more related numeric series over a numeric or timestamp-based X axis.
- Input: Receives `chartData` (`LineChartData[]`) and a `LineChartConfig` through `ChartWrapperInjectedProps`.
- Notes: Supports freehand polygon lasso selection across visible series points and
  progressive rectangular X-axis lasso zoom with automatic Y-axis rescaling. Corresponding
  non-null curve segments switch from their configured series color to amber when selected.
  Legend clicks locally hide or show a series without selecting data, opening enhanced
  tooltips, or requesting data. Hidden series do not participate in lasso selection. Not
  suitable for categorical string X values or per-series heterogeneous data shapes.

For module-specific details, read `modules/LineChartModule/instructions.md`.

### `BarChartModule`

- Purpose: Renders a configurable multi-series categorical bar chart from compact API data.
- Best use: Comparing one or more numeric measures across discrete categories, with grouped,
  stacked, 100% stacked, or overlaid series.
- Input: Receives `chartData` (`BarChartData[]`, one row per category with a per-series
  `values` array) and a `BarChartConfig` through `ChartWrapperInjectedProps`.
- Notes: Supports vertical and horizontal orientation, per-category and threshold coloring,
  value labels with automatic outside-label spacing, sorting, reference lines, and
  per-category target markers. Selection is by bar click plus a rectangular/polygon lasso
  adapter (no zoom); selected bars are highlighted and non-selected bars fade. This differs
  from `LineChartModule` (continuous numeric/time X axis) and `HistogramModule` (numeric bins
  of a single variable); use those instead when the X axis is not a set of discrete categories.

For module-specific details, read `modules/BarChartModule/instructions.md`.

### `PieChartModule`

- Purpose: Renders a single non-negative measure as a full pie or donut with
  configurable labels, legend content, long-tail grouping, and optional center
  KPI.
- Best use: Showing part-to-whole composition across a modest number of unique
  categories.
- Input: Receives `chartData` (`PieChartData[]`, one pre-aggregated
  `{ name, value }` row per slice) and a `PieChartConfig` through
  `ChartWrapperInjectedProps`.
- Notes: Supports click and modifier-assisted additive selection. Selected
  slices receive a stroke while other slices fade. A synthetic `groupOthers`
  slice is deliberately not selectable. Prefer `BarChartModule` for precise
  category comparison, signed values, or visible zeroes; prefer `CardModule`
  for one standalone aggregate.

For module-specific details, read `modules/PieChartModule/instructions.md`.

### `ScatterPlotModule`

- Purpose: Renders dense numeric X/Y point clouds with deck.gl and an orthographic WebGL view.
- Best use: Exploring correlations and distributions with hundreds of thousands of individually selectable points.
- Input: Receives `chartData` (`ScatterPlotData[]`, one row per point with `id`, `x`, `y`, and optional numeric `color`) and a `ScatterPlotChartConfig` through `ChartWrapperInjectedProps`.
- Notes: Supports filled points (the default) or unfilled category-colored circles through `points.shape`; circle outlines scale proportionally with marker radius while zooming. Also supports click selection, modifier-assisted additive selection, polygon lasso selection in interactive point mode, rectangular lasso zoom in both point and raster modes, `Ctrl`+wheel zoom while normal wheel input scrolls the page, viewport-aware ticks and grids, hover values, toggleable automatic legends, custom domains, and reference lines/areas. Legend toggles are always local and request-free in interactive mode because point responses include every category in the viewport; raster toggles request a filtered image. Mode selection uses the unfiltered viewport count and switches to interactive points at or below the point limit. The lasso-selection action remains visible but disabled in raster mode. Initial rendering and each completed navigation action use at most one data request; marker-aware viewport padding and internal render or resize cycles do not trigger refetching. Markers use one standard color unless `colorMapping` declares groups; group colors come from a contrast-safe palette and may be overridden explicitly. The point-limit input is local to the current page session. Large production datasets should use `selfFetching: true` with the viewport-aware binary/raster API instead of the standard JSON chart endpoint.

For module-specific details, read `modules/ScatterPlotModule/instructions.md`.

### `MapModule`

- Purpose: Geographic visualization module for choropleth country maps and optional bubble overlays for latitude/longitude points.
- Best use: Showing regional values such as revenue, engagement, or coverage by country, plus geospatial points for facilities, cities, or customer locations.
- Input: Accepts a mixed `region` and `point` dataset, with value-driven fill logic and optional bubble sizing and color.
- Notes: Works without a basemap or API key by using the bundled world atlas countries TopoJSON. This differs from `LineChartModule`, which is designed for numeric time-series comparison rather than geographic grouping.

For module-specific details, read `modules/MapModule/instructions.md`.

### `TableModule`

- Purpose: Tabular display of (optionally hierarchical) data with in-cell databars and hide/fold column controls.
- Best use: Detailed row-level reporting, expandable rollup tables, and KPI grids where exact values and in-cell databars aid scanning.
- Input: Receives `chartData` (`TableRowData[]`, a flat `id`/`parentId` adjacency list with a per-row `values` map) and a `TableChartConfig` through `ChartWrapperInjectedProps`.
- Notes: Columns are config-authored (not data-inferred); hierarchy is transported as a flat `id`/`parentId` list and assembled into a tree client-side. Supports databars (positive and diverging), column hide/show and fold/unfold groups, client-side sorting, global + per-column filtering, top-level pagination, a grand-total footer, sticky header/first column, and row-click selection with a primary-tinted row highlight plus enhanced tooltip / connections. `values` is emitted from SQL as `to_json(named_struct(...))`. This differs from the chart modules (exact values + hierarchy vs. visual trend/shape) and from `MapModule` (non-geographic).

For module-specific details, read `modules/TableModule/instructions.md`.

### `CardModule`

- Purpose: Renders a single key figure as a text label and one formatted number.
- Best use: Highlighting one aggregate figure (total, average, count, ratio) with a short caption.
- Input: Receives `chartData` (`CardData[]`, uses only the first row `{ label, value }`) and a `CardChartConfig` through `ChartWrapperInjectedProps`.
- Notes: Supports number/compact/percent/currency formatting, configurable decimals, locale, currency, prefix/suffix, label override, and alignment. Does not support selection, lasso, enhanced tooltips, or connections. Use a chart or `TableModule` when comparing multiple values.

For module-specific details, read `modules/CardModule/instructions.md`.
