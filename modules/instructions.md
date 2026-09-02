# Modules overview

This folder contains reusable dashboard modules that can be referenced from `pagesConfig/*.json` and rendered through generated pages in `app/`.

## How modules are used

1. A dashboard JSON file references a module through the `moduleName` field on a component, for example `"moduleName": "LineChartModule"`. The value must match a key in `modules/modulRegistry.ts`.
2. `scripts/pages/generateNextPage.ts` embeds the dashboard JSON into the generated page; it does not import modules directly.
3. At runtime, `TabsWrapper` renders a `ChartWrapper` for each configured component.
4. `ChartWrapper` resolves the module from `modules/modulRegistry.ts` via `moduleName` (a dynamic import), fetches `/api/data/<chartID>`, validates the result against the module's Zod schema, and injects props including `height`, `chartData`, and loading/error state.

## Module contract

- Each module lives in its own folder: `modules/<ModuleName>/` and must contain `index.tsx`, `chartDataSchema.ts`, `chartType.d.ts`, and `instructions.md`.
- `index.tsx` must have a **default export**, and that component must use `ChartWrapperInjectedProps` as its props type.
- Module resolution is by the registry key in `modules/modulRegistry.ts`, which must match the `moduleName` used in dashboard JSON.
- `chartDataSchema.ts` must default-export a Zod schema and also export the module data type.
- `chartType.d.ts` must contain exactly one `type` declaration.
- `instructions.md` must follow `docs/instructions.template.md` and describe purpose, data contract, config, and usage.
- Selection-capable modules call the injected `onSelectionChange(rows)` when the user selects data. `LineChartModule` (point click) and `MapModule` (region/bubble click) support this.

## Modules currently available

### `LineChartModule`

- Purpose: Renders a configurable multi-series line or area chart from compact numeric API data.
- Best use: Visualizing one or more related numeric series over a numeric or timestamp-based X axis.
- Input: Receives `chartData` (`LineChartData[]`) and a `LineChartConfig` through `ChartWrapperInjectedProps`.
- Notes: Not suitable for categorical string X values or per-series heterogeneous data shapes.

For module-specific details, read `modules/LineChartModule/instructions.md`.

### `MapModule`

- Purpose: Geographic visualization module for choropleth country maps and optional bubble overlays for latitude/longitude points.
- Best use: Showing regional values such as revenue, engagement, or coverage by country, plus geospatial points for facilities, cities, or customer locations.
- Input: Accepts a mixed `region` and `point` dataset, with value-driven fill logic and optional bubble sizing and color.
- Notes: Works without a basemap or API key by using the bundled world atlas countries TopoJSON. This differs from `LineChartModule`, which is designed for numeric time-series comparison rather than geographic grouping.

For module-specific details, read `modules/MapModule/instructions.md`.
