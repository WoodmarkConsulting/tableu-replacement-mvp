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
- Outgoing chart connections are resolved from source tooltip SQL. Each `expectedColumns` name
  must be an exact result alias, contain atomic values, exist in the target table schema, and be
  parsed by the target chart SQL under the same named parameter.
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
  Not suitable for categorical string X values or per-series heterogeneous data shapes.

For module-specific details, read `modules/LineChartModule/instructions.md`.

### `BarChartModule`

- Purpose: Renders a configurable multi-series categorical bar chart from compact API data.
- Best use: Comparing one or more numeric measures across discrete categories, with grouped,
  stacked, 100% stacked, or overlaid series.
- Input: Receives `chartData` (`BarChartData[]`, one row per category with a per-series
  `values` array) and a `BarChartConfig` through `ChartWrapperInjectedProps`.
- Notes: Supports vertical and horizontal orientation, per-category and threshold coloring,
  value labels, sorting, reference lines, and per-category target markers. Selection is by
  bar click plus a rectangular/polygon lasso adapter (no zoom); selected bars are highlighted
  and non-selected bars fade. This differs from `LineChartModule` (continuous numeric/time X
  axis) and `HistogramModule` (numeric bins of a single variable); use those instead when the
  X axis is not a set of discrete categories.

For module-specific details, read `modules/BarChartModule/instructions.md`.

### `MapModule`

- Purpose: Geographic visualization module for choropleth country maps and optional bubble overlays for latitude/longitude points.
- Best use: Showing regional values such as revenue, engagement, or coverage by country, plus geospatial points for facilities, cities, or customer locations.
- Input: Accepts a mixed `region` and `point` dataset, with value-driven fill logic and optional bubble sizing and color.
- Notes: Works without a basemap or API key by using the bundled world atlas countries TopoJSON. This differs from `LineChartModule`, which is designed for numeric time-series comparison rather than geographic grouping.

For module-specific details, read `modules/MapModule/instructions.md`.
