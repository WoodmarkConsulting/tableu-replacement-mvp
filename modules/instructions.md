# Modules overview

This folder contains reusable dashboard modules that can be referenced from `pagesConfig/*.json` and rendered through generated pages in `app/`.

## How modules are used

1. A dashboard JSON file references a module by its exported component name, for example `"module": "LineChartModule"`.
2. `scripts/pages/generateNextPage.ts` scans that JSON file and generates the matching imports.
3. The generated page passes the resolved components into `TabsWrapper` as part of `tabsConfig`.
4. `TabsWrapper` renders the module and passes the configured row `height` as a prop.

## Module contract

- Each module should live in its own folder: `modules/<ModuleName>/`.
- Each module should export a named component from `index.tsx`.
- The export name must exactly match the string used in dashboard JSON.
- Modules should accept `BaseChartProps` so layout-controlled height works consistently.
- Each module should include its own `instructions.md` describing purpose, API, and usage.
- Modules that act as a drill source call the injected `onSelectionChange(rows)` when the user selects data. `LineChartModule` (point click) and `MapModule` (region/bubble click) support this.

## Modules currently available

### `LineChartModule`

- Purpose: Sample visualization module that renders a two-series line chart inside the shared card and chart UI primitives.
- Best use: Placeholder chart content, layout prototyping, and validating dashboard generation and tab rendering.
- Input: Accepts `height` through `BaseChartProps`; supports an additional optional prop internally but the generated dashboard flow only uses `height`.
- Notes: Uses static demo data and does not currently fetch or accept dynamic series data.

For module-specific details, read `modules/LineChartModule/instructions.md`.

### `MapModule`

- Purpose: Geographic visualization module for choropleth country maps and optional bubble overlays for latitude/longitude points.
- Best use: Showing regional values such as revenue, engagement, or coverage by country, plus geospatial points for facilities, cities, or customer locations.
- Input: Accepts a mixed `region` and `point` dataset, with value-driven fill logic and optional bubble sizing and color.
- Notes: Works without a basemap or API key by using the bundled world atlas countries TopoJSON. This differs from `LineChartModule`, which is designed for numeric time-series comparison rather than geographic grouping.

For module-specific details, read `modules/MapModule/instructions.md`.
