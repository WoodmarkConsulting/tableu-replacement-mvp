# `ScatterPlotModule` Instructions

## 1. Purpose

`ScatterPlotModule` renders large numeric X/Y point sets with deck.gl and an
orthographic WebGL view. Use it for dense correlations and distributions where
individual points remain meaningful. Do not use it for geographic coordinates
or categorical axes.

## 2. Module Files

```text
modules/ScatterPlotModule/
├── index.tsx
├── chartDataSchema.ts
├── chartType.d.ts
└── instructions.md
```

`index.tsx` is the default-exported renderer. `chartDataSchema.ts` validates one
logical point. `chartType.d.ts` contains the single configuration type.

## 3. Data Contract

### Data Type

```ts
type ScatterPlotData = {
  id: number;
  x: number;
  y: number;
  color?: number;
};
```

### Data Structure

#### `id`

Type: `number`. Stable point identifier used for selection and tooltip lookup.

#### `x`

Type: `number`. Numeric horizontal position.

#### `y`

Type: `number`. Numeric vertical position.

#### `color`

Type: `number | undefined`. Optional category used only when `colorMapping` is
configured. Without a mapping, every point uses the same standard color.

### Example API Response

```json
[
  { "id": 101, "x": 125400, "y": 4, "color": -1 },
  { "id": 102, "x": 84000, "y": 2, "color": 0 }
]
```

### Data Rules

- SQL must alias the columns to `id`, `x`, `y`, and optional `color`.
- All values must be finite JSON numbers.
- IDs should be unique and must remain within JavaScript's safe integer range.

## 4. Configuration

```ts
type ScatterPlotChartConfig = {
  xAxis?: AxisOptions;
  yAxis?: AxisOptions;
  pointLimit?: { default?: number; max?: number };
  points?: {
    shape?: "point" | "circle";
    radiusPixels?: number;
    opacity?: number;
  };
  raster?: { dotRadiusPixels?: number; opacity?: number };
  grid?: "both" | "x" | "y" | "none";
  hoverTooltip?: boolean;
  legend?: boolean | { position?: LegendPosition };
  referenceLines?: ReferenceLine[];
  referenceAreas?: ReferenceArea[];
  colorMapping?: {
    values: { value: number; color?: string; label?: string }[];
    defaultColor?: string;
  };
};
```

## 5. Configuration Reference

### `xAxis` and `yAxis`

Both axes are optional. `label` adds an axis title. `format` accepts `number`,
`compact`, or `percent` and defaults to `compact`; `decimals` controls up to six
decimal places and `suffix` appends a unit. Five viewport-aware ticks are shown
by default. Use `tickCount` (`2`–`10`) or `showTicks: false` to customize them.
`domain.min` and `domain.max` optionally override the initial/reset range.

### `pointLimit`

`default` is the initial session-only threshold and defaults to `1,000,000`.
`max` limits the editable threshold and defaults to the API safety limit of
`5,000,000` points.

### `points`

`shape` accepts `point` or `circle` and defaults to `point`. Points are filled;
circles are unfilled outlines that retain their category color. Their outline
width scales with zoom in the same proportion as the marker radius, keeping
small circles open and large circles clearly outlined. `radiusPixels` controls
marker radius and defaults to `1.5`. `opacity` defaults to `1` and must be
between `0` and `1`.

### `raster`

`dotRadiusPixels` and `opacity` configure the server-rasterized mode. Raster
opacity defaults to `0.8`.

### Grid, hover tooltip, and legend

`grid` defaults to `both`; use `x`, `y`, or `none` to reduce it. The lightweight
point hover tooltip is enabled by default in interactive point mode. Set
`hoverTooltip: false` to disable it. A legend appears automatically when
`colorMapping` is configured. It renders below the plot, never over the data.
Set `legend: false` to hide it or align it `left`, `center`, or `right`.
Legend entries are buttons that toggle their category. Interactive point data
is hidden or shown entirely in the browser without a request. A raster image
cannot be separated by category after rendering, so toggling its legend
rerenders the same viewport with one request.

### Reference lines and areas

`referenceLines` draw labeled thresholds along either numeric axis.
`referenceAreas` highlight an interval on one axis. Both accept an optional CSS
color and remain aligned while zooming and panning.

### `colorMapping`

Each `values` item declares a numeric `color` category. Categories receive one
of eight high-contrast palette colors in declaration order. Set `color` on an
entry to override that category with an explicit hexadecimal CSS color.
`defaultColor` controls missing or unmapped categories and defaults to blue.
Without `colorMapping`, all points use the same blue standard color. Point and
raster modes always use the same assignment.

## 6. Configuration Rules

- `pointLimit.default` must be between `1` and `5,000,000`.
- `pointLimit.max`, when set, must be between `1` and `5,000,000`.
- Point and raster radii must be positive.
- Both opacity values must be between `0` and `1`.
- Use hexadecimal colors in `colorMapping`; reference overlays accept any CSS
  color value.

## 7. Complete Configuration Example

```ts
const chartConfig: ScatterPlotChartConfig = {
  xAxis: {
    label: "Odometer",
    format: "compact",
    tickCount: 6,
    domain: { min: 0, max: 500000 },
  },
  yAxis: { label: "Frequency", format: "number", tickCount: 6 },
  pointLimit: { default: 1000000, max: 5000000 },
  points: { shape: "circle", radiusPixels: 2, opacity: 0.65 },
  raster: { dotRadiusPixels: 2, opacity: 0.8 },
  grid: "both",
  hoverTooltip: true,
  legend: { position: "right" },
  referenceLines: [
    { axis: "x", value: 100000, label: "100k", color: "#0e7490" },
  ],
  referenceAreas: [
    { axis: "x", from: 0, to: 150000, color: "rgba(14, 116, 144, 0.08)" },
  ],
  colorMapping: {
    values: [
      { value: -1, color: "#dc2626", label: "Active" },
      { value: 0, color: "#2563eb", label: "Inactive" },
    ],
    defaultColor: "#64748b",
  },
};
```

## 8. Data and Configuration Relationship

`x` and `y` determine the orthographic position. `color` selects a
`colorMapping.values` entry. In self-fetching mode, the point limit and current
viewport are sent to `/api/data/scatter/<chartID>`. The endpoint returns binary
points below the limit and a server-rendered PNG above it. Supplied `mockData`
is rendered directly and is not truncated. The configured point shape applies
equally to supplied object data and binary point responses; raster rendering is
unchanged.

## 9. Usage

### Import

```ts
import ScatterPlotModule from "@/modules/ScatterPlotModule";
```

### Minimal Example

Reference `"ScatterPlotModule"` as `moduleName` in a dashboard component and
provide the complete `chartConfig` plus SQL output matching the data contract.

### Complete Example

For a SQL-backed example, see `app/testPageScatter/page.tsx` and
`pagesConfig/sql/dtc-scatter.sql`.

## 10. Expected Props

`chartData` supplies logical points. `selectedRows` is the wrapper-owned current
selection. `onSelectionChange` receives clicked or lassoed original rows.
`lasso` receives an adapter for polygon/rectangle selection and rectangle zoom.
`height` controls the fixed chart height. Enhanced tooltip rendering and chart
connections remain owned by `ChartWrapper`.

## 11. Runtime Behavior

The module fits the first dataset into an orthographic view and reserves a
marker-aware inset so points at the outer data bounds remain fully visible.
The initial response is retained: raster bounds are positioned inside that
inset instead of triggering a second request. Resetting restores the same
inset. `Ctrl`+mouse-wheel zoom and middle-button drag panning are enabled, while
normal mouse-wheel input scrolls the page and left-button drag panning is
disabled. `Ctrl`+wheel zoom,
middle-button panning, and rectangle zoom activate the shared `Ansicht
zurücksetzen` action. The adjacent undo action restores one viewport step at a
time; consecutive wheel events within a short gesture count as one step, while
each pan or rectangle zoom is stored separately. Rectangle zoom is activated
explicitly from the shared toolbar and exits after one completed zoom. Point
markers grow with additional `Ctrl`+mouse-wheel zoom in point mode so isolated points
remain easy to target. Hover highlights a point; click opens a static enhanced
tooltip when the dashboard enables it. Modifier-click toggles a point in the
selection. Selected points receive an amber outline.
Polygon selection projects loaded data points to normalized plot pixels. It is
available only in interactive point mode; its toolbar action remains visible
but disabled in raster mode. Box zoom remains available in both modes. The
configured point limit is local state and resets on reload. In interactive
point mode, zooming or panning inside the bounds covered by the loaded points
is handled locally; the visible count is recalculated without an API request.
Zooming out or panning beyond that coverage fetches the new viewport and may
switch back to raster mode. During a remote viewport request, the plot is
dimmed and all chart pointer interactions plus shared toolbar actions are
temporarily disabled. `Ctrl`+wheel is consumed over the locked chart so it
cannot zoom the browser page, while wheel input without `Ctrl` continues to
scroll the page. A blue status at the left of the module toolbar remains visible
until the request finishes without changing the plot dimensions.
Successfully completed requests are reused while viewport, image size, filters,
point limit, and color configuration remain unchanged. Duplicate resize
measurements and internal renders after the initial fit do not start another
request; viewport fetching resumes only after a user navigation action, a point
limit change, or changed filters. Each completed local or remote viewport
update consumes that permission so response-driven renders cannot fetch twice.
Clicking a legend entry uses a pointer cursor and visibly dims disabled entries.
In interactive point mode it locally removes hidden categories from rendering,
picking, lasso selection, selection outlines, and the visible-point count. It
does not fetch because every interactive response contains all categories in
the viewport. Raster legend changes request a filtered image for the current
viewport. Mode selection always uses the unfiltered viewport count, so zooming
to at most the point limit returns all points and applies the current legend
visibility only in the browser.

## 12. Validation and Errors

Invalid rows are rejected by `chartDataSchema.ts` before rendering. Missing or
non-hex colors fall back to the module default. Invalid configuration numbers
must be corrected in dashboard JSON; the renderer only clamps opacity.

## 13. Agent Instructions

1. Read this file, `chartType.d.ts`, and `chartDataSchema.ts` before use.
2. Keep SQL aliases exactly `id`, `x`, `y`, and optional `color`.
3. Use `selfFetching: true` only with the scatter viewport API.
4. Keep selection, enhanced tooltips, and connections in `ChartWrapper`.
5. Do not add page-specific behavior to the module.

## 14. Agent Workflow

1. Confirm that both axes are numeric.
2. Create the complete configuration.
3. Shape SQL or mock data to the documented schema.
4. Add tooltip SQL when details or outgoing connections are required.
5. Run module validation, registry generation, and TypeScript verification.

## 15. Do Not

- Do not use geographic longitude/latitude semantics or a basemap.
- Do not send detail-only tooltip columns with every point.
- Do not persist the point-limit input.
- Do not duplicate selection state inside the module.

## 16. Known Limitations

An aggregated raster pixel does not identify one logical row, so direct point
hover and click details become available after zooming into point mode. Raster
lasso selection fetches the selected bounds and succeeds when that smaller
result fits below the point limit. Lasso selection in point mode is linear in
the number of currently loaded points.

## 17. Notes

The server-side SQL contract standardizes aliases so viewport count, point, and
raster queries can wrap a chart's base SQL without knowing source field names.
