# BarChartModule plan

## Goal

Create a new module at `modules/BarChartModule/` that follows the same contract as
`LineChartModule`, `MapModule`, and the planned `HistogramModule`:

- `index.tsx`
- `chartDataSchema.ts`
- `chartType.d.ts`
- `instructions.md`

The module renders a **categorical bar chart** with `recharts` (`ComposedChart`),
consistent with `LineChartModule`. Unlike `HistogramModule` (which bins a single numeric
variable into contiguous ranges), `BarChartModule` plots **one value per discrete category**
for one or more series — the classic "categories on one axis, measures on the other" chart.

This plan is fully decided and includes **every** optional feature discussed. Nothing is
deferred to a follow-up.

---

## Decisions (all locked)

- **A — Separate module.** `BarChartModule` is its own module, distinct from
  `HistogramModule`. Different data shape (discrete category vs. numeric bin) and mental
  model; merging would bloat one config type.
- **B — Data shape: compact `{ category, values: (number | null)[] }`.** Mirrors
  `LineChartModule`'s `{ x, y: [...] }`, giving identical index-based series handling and the
  smallest payload. Series read `values[seriesIndex]`.
- **C — Orientation: config-driven both.** `orientation: "vertical" | "horizontal"` via
  recharts `layout`. Horizontal is ideal for long labels / many categories.
- **D — Multi-series layout: grouped, stacked, stacked100, overlay.** All four ship.
- **E — Full axis options.** Tick styling, label rotation angle, label truncation, and a
  pinnable value-axis domain.
- **F — Value labels on bars.** `inside | outside | auto`, off by default.
- **G — Grid / tooltip / legend / margin.** Full parity with `LineChartModule`.
- **H — Series styling + geometry, per-category color, and threshold coloring.** Base
  per-series style, chart-level bar geometry, optional `colorByCategory` (single-series), and
  optional `thresholds` for conditional bar colors.
- **I — Sorting.** By category or by a chosen series value, asc/desc; omit to keep SQL order.
- **J — Reference / target lines.** Author-provided value lines on the value axis.
- **K — Target / bullet bars.** Optional thin target marker per category (bullet-chart style).
- **L — Selection: click + lasso + highlight.** Click-to-select, a rectangular lasso adapter,
  and highlighted rendering of `selectedRows`.
- **M — Enhanced tooltip + connections.** Example tooltip SQL and an outgoing-connection
  contract are included.

---

## How this differs from `HistogramModule`

| | `BarChartModule` | `HistogramModule` |
| --- | --- | --- |
| X axis | discrete categories (strings) | numeric bins (ranges) |
| Data row | one category + values | one bin + counts |
| Typical use | compare measures across groups | show distribution of one variable |
| Ordering | author-controlled / sortable | strictly ascending by bin edge |

---

## Dependencies

No new dependencies. `recharts`, `zod`, and `components/ui/chart` are already used by
`LineChartModule`. `tsconfig.json` requires no changes.

---

## Data contract

### Transport shape

Each row is one category. `values[seriesIndex]` is the measure for that series in that
category. An optional `target` supports bullet/target bars.

```ts
{
  category: string;            // discrete label on the category axis
  values: (number | null)[];   // one value per series; null = missing bar
  target?: number | null;      // optional per-category target/reference marker (Decision K)
}
```

### `chartDataSchema.ts`

```ts
import { z } from "zod";

export const barChartDataSchema = z.object({
  category: z.string(),
  values: z.array(z.number().finite().nullable()),
  target: z.number().finite().nullable().optional(),
});

export type BarChartData = z.infer<typeof barChartDataSchema>;

export default barChartDataSchema;
```

### Data rules (documented in `instructions.md`)

- Each row's `category` must be **unique** across the response.
- Row order in the API response is the **default draw order** (override with `sort`).
- `values` length must be `>= max(series.seriesIndex) + 1` across all configured series.
- `null` values render as a gap (no bar) for that series/category.
- `target` is only used when `targetBars.enabled` is true; omit it otherwise.
- For `stacked100`, each category's non-null values are normalized to sum to 100%.

### Example API response

```json
[
  { "category": "North", "values": [120, 80],  "target": 130 },
  { "category": "South", "values": [90, 140],  "target": 130 },
  { "category": "East",  "values": [60, 110],  "target": 130 },
  { "category": "West",  "values": [150, 70],  "target": 130 }
]
```

---

## Configuration type (`chartType.d.ts`)

Exactly one `type` declaration named `BarChartConfig`.

```ts
type BarChartConfig = {
  /** "vertical" = categories on X; "horizontal" = categories on Y. */
  orientation: "vertical" | "horizontal";

  /**
   * How multiple series are arranged within each category.
   *
   * "grouped"    -> bars side by side
   * "stacked"    -> bars stacked
   * "stacked100" -> stacked and normalized so each category sums to 100%
   * "overlay"    -> overlapping, semi-transparent bars sharing the slot
   */
  layout: "grouped" | "stacked" | "stacked100" | "overlay";

  /**
   * Category (discrete) axis.
   * Rendered as X when orientation is "vertical", Y when "horizontal".
   */
  categoryAxis: {
    show: boolean;
    tickLine: boolean;
    axisLine: boolean;
    tickMargin: number;
    /** Rotate tick labels (degrees) for crowded axes, e.g. -45. */
    angle?: number;
    /** Truncate long labels to this many characters with an ellipsis. */
    maxLabelChars?: number;
  };

  /**
   * Value (measure) axis.
   * Rendered as Y when orientation is "vertical", X when "horizontal".
   */
  valueAxis: {
    show: boolean;
    tickLine: boolean;
    axisLine: boolean;
    /** "number" 12500 | "compact" 12.5K | "percent" 45%. */
    format: "number" | "compact" | "percent";
    /** Pin the value range, or "auto" to let recharts scale. */
    domain?: [number, number] | "auto";
  };

  grid: {
    show: boolean;
    horizontal: boolean;
    vertical: boolean;
    strokeDasharray?: string;
  };

  tooltip: { show: boolean; cursor: boolean };
  legend: { show: boolean };
  margin: { top: number; right: number; bottom: number; left: number };

  bars: {
    /** Corner radius per bar. */
    radius: number;
    /** Gap between categories (recharts barCategoryGap), e.g. "10%" or 4. */
    categoryGap: string | number;
    /** Gap between bars within a category for "grouped" layout. */
    barGap: string | number;
  };

  /** Numeric labels drawn on/near each bar. Off by default. */
  valueLabels: {
    show: boolean;
    format: "number" | "compact" | "percent";
    position: "inside" | "outside" | "auto";
  };

  /**
   * Single-series only: color each bar by its category.
   * Ignored when more than one series is configured.
   */
  colorByCategory?: {
    enabled: boolean;
    /** category -> color. Categories missing a mapping use the series fill. */
    colors: Record<string, string>;
  };

  /**
   * Conditional bar coloring by value threshold (evaluated per bar).
   * The first matching rule (value >= min && value < max) wins; falls back to series fill.
   */
  thresholds?: {
    enabled: boolean;
    /** Which series the thresholds apply to; defaults to all. */
    seriesIndex?: number;
    rules: {
      min?: number;
      max?: number;
      fill: string;
    }[];
  };

  /** Reorder bars. Omit to keep SQL row order. */
  sort?: {
    by: "category" | "value";
    direction: "asc" | "desc";
    /** Required when by === "value". */
    seriesIndex?: number;
  };

  /** One entry per series; seriesIndex selects values[seriesIndex]. */
  series: {
    seriesIndex: number;
    name: string;
    fill: string;
    fillOpacity: number;
    stroke?: string;
    strokeWidth?: number;
    /** Groups bars into a stack for "stacked"/"stacked100" layouts. */
    stackId?: string;
  }[];

  /** Optional target/threshold lines drawn across the value axis. */
  referenceLines?: {
    label: string;
    value: number;
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
  }[];

  /** Optional per-category target marker (bullet-chart style), reads row.target. */
  targetBars?: {
    enabled: boolean;
    /** "line" thin marker across the bar, "bar" thin overlaid bar. */
    style: "line" | "bar";
    fill: string;
    /** Thickness of the marker in pixels. */
    size: number;
  };

  /** Highlight style applied to selected bars (Decision L). */
  selectionStyle?: {
    stroke: string;
    strokeWidth: number;
    /** Dim non-selected bars to this opacity when a selection is active. */
    fadeOthersOpacity: number;
  };
};
```

---

## Selection, lasso, tooltip, connections

- **Click select (L):** when `onSelectionChange` is a function, set a guarded `onClick`; on
  bar click resolve the original row and call `onSelectionChange([row])`. Mirror
  `LineChartModule`'s guarded `handleChartClick` (no-op when selection is disabled).
- **Lasso (L):** register a lasso adapter with `select(shape)` returning the original rows
  whose bar rectangles intersect the rectangular lasso shape, plus `getPlotBounds()`
  reporting the plot rectangle in pixels. Bars map cleanly to rectangles, so rectangular
  selection is exact. Zoom is not registered (categorical axis).
- **Highlight (L):** render `selectedRows` using `selectionStyle` (stronger stroke, faded
  others). Selection is read-only in the module; `ChartWrapper` owns the state.
- **Enhanced tooltip (M):** when `enhancedTooltip: true`, all selected rows post together to
  `POST /api/data/chart/tooltip`. Each data-point property becomes a JSON array parameter
  (e.g. `category: ARRAY<STRING>`, each `values[i]: ARRAY<DOUBLE>`). SQL parses the batched
  shape; never one request per row. Only the owning wrapper renders the card.
- **Connections (M):** `DashboardConfig.connections` entries resolve `expectedColumns` from
  the source tooltip result. Every `expectedColumns` entry must be a real target column, an
  exact alias in the source tooltip SQL, an atomic scalar/array at runtime, and a named
  parameter parsed with the same type in the target SQL.

---

## Implementation plan

### Phase 1 — Data contract and config type

1. Create `modules/BarChartModule/chartDataSchema.ts` with the Zod schema above
   (default export `barChartDataSchema`, named type `BarChartData`).
2. Create `modules/BarChartModule/chartType.d.ts` with the single `BarChartConfig` type.

### Phase 2 — Component implementation

Create `modules/BarChartModule/index.tsx` with a default export typed as
`ChartWrapperInjectedProps<BarChartData, BarChartConfig>`. The component should:

1. Destructure `chartConfig`, `chartData`, `height`, `onSelectionChange`, `selectedRows`, and
   `lasso` from injected props (same pattern as `LineChartModule`).
2. Build recharts rows once with `useMemo`, mapping each `values[i]` to a `series_${i}` key.
   Reuse the `getSeriesKey` + index-bounds validation from `LineChartModule` (throw on
   missing/negative `seriesIndex`). Carry `target` through when `targetBars.enabled`.
3. Apply `sort` (by category or `values[seriesIndex]`) before rendering.
4. For `stacked100`, normalize each row's non-null series values to sum to 100 and switch the
   value-axis format to percent.
5. Resolve each bar's fill in priority order: `thresholds` (if enabled and matched) →
   `colorByCategory` (single series) → series `fill`. Selected bars additionally get
   `selectionStyle`.
6. Build the `ChartContainer` config from `series` (label + color) like
   `createChartContainerConfig` in `LineChartModule`.
7. Render a `ComposedChart` with `layout` derived from `orientation`, swapping `XAxis`/`YAxis`
   roles accordingly:
   - category axis: ticks, `angle`, and `maxLabelChars` truncation.
   - value axis: `format` (number/compact/percent) and optional pinned `domain`.
   - `CartesianGrid`, `ChartTooltip`, `Legend` gated by config, matching `LineChartModule`.
   - one `<Bar>` per series with `stackId` for stacked layouts, `fillOpacity`, `radius`,
     per-bar `<Cell>` fills for threshold/category coloring, and `barCategoryGap`/`barGap`.
   - `overlay` layout renders bars in the same category slot with reduced opacity.
   - optional `<LabelList>` for `valueLabels` (position inside/outside/auto).
   - optional `<ReferenceLine>` per `referenceLines` entry.
   - optional target markers per category from `targetBars` (thin `<Bar>` or custom shape).
8. Selection: guarded `onClick` → resolve clicked bar's original row → `onSelectionChange([row])`.
   Register the rectangular lasso adapter (`select`, `getPlotBounds`). Render `selectedRows`
   with `selectionStyle`.
9. Wrap in `ChartContainer` with the same `height`/`svh` handling used by `LineChartModule`.

Optional helper extraction (not required by the contract):

- `modules/BarChartModule/transform.ts` for pure row-building, sort, `stacked100`
  normalization, and fill resolution.
- `modules/BarChartModule/lasso.ts` for the rectangular hit-test against bar rects.

### Phase 3 — Documentation and registry

1. Create `modules/BarChartModule/instructions.md` following `docs/instructions.template.md`
   exactly: purpose, module files, data contract (every field), configuration reference
   (every property), example API response, and data rules.
2. Update root `modules/instructions.md` to add a `BarChartModule` entry:
   - purpose: compare measures across discrete categories with one or more series
   - best use: grouped/stacked/overlay comparisons, horizontal bars for long labels,
     target/threshold coloring, per-category selection
   - how it differs from `LineChartModule` (discrete categories, not a continuous
     numeric/time series), `HistogramModule` (categories, not numeric bins), and
     `MapModule` (non-geographic)
3. Run `npm run module:validate` and `npm run module:generateRegistry` so
   `modules/modulRegistry.ts` gains the `BarChartModule` dynamic import, its data schema, and
   `BarChartConfig` in the `ChartConfigs` union.

### Phase 4 — Example SQL, tooltip SQL, and smoke test

1. Author an example `pagesConfig/sql/<chartID>.sql` that produces the category shape:

   ```sql
   SELECT
     region AS category,
     ARRAY(
       SUM(CASE WHEN metric = 'a' THEN value END),
       SUM(CASE WHEN metric = 'b' THEN value END)
     ) AS values,
     MAX(target_value) AS target
   FROM source_table
   GROUP BY region
   ORDER BY region;
   ```

2. Author `pagesConfig/sql/tooltipSql/<chartID>.tooltip.sql` that accepts the batched
   selection arrays and returns display columns plus any `expectedColumns` aliases used by
   outgoing connections. Parse `category` as `ARRAY<STRING>` and each series value as
   `ARRAY<DOUBLE>`.

3. Add a temporary dashboard entry referencing `moduleName: "BarChartModule"`, regenerate the
   page with `npx tsx scripts/pages/generateNextPage.ts`, and visually confirm:
   - vertical and horizontal orientation both render correctly
   - grouped / stacked / stacked100 / overlay layouts behave as configured
   - value labels, sorting, threshold + per-category coloring apply correctly
   - reference lines and target/bullet bars appear at plausible positions
   - clicking a bar emits the selected row; lasso selects intersecting bars
   - selected bars highlight and non-selected bars fade
   - enhanced tooltip batches all selected rows in a single request
   - configured connections resolve and apply to linked targets

---

## Relevant files

- `modules/LineChartModule/*` — structural + implementation template (series indexing,
  axis formatting, selection click handling, lasso adapter, `ChartContainer` usage).
- `modules/BarChartModule/index.tsx` — bar chart rendering component.
- `modules/BarChartModule/chartDataSchema.ts` — Zod schema and `BarChartData` type.
- `modules/BarChartModule/chartType.d.ts` — single `BarChartConfig` type.
- `modules/BarChartModule/instructions.md` — module documentation.
- `modules/instructions.md` — module overview registry.
- `modules/modulRegistry.ts` — generated registry output.
- `types/baseChart.d.ts` — `ChartWrapperInjectedProps` contract.
- `types/lasso.d.ts` — lasso adapter contract.
- `components/ui/chart.tsx` — shared recharts primitives.
- `scripts/modules/validateModules.ts` — validation contract.
- `scripts/modules/generateModuleRegistry.ts` — registry generation.
- `docs/instructions.template.md` — instruction template to follow.

---

## Verification checklist

- Four required `BarChartModule` files exist and satisfy the module contract:
  - `index.tsx` has a default export using `ChartWrapperInjectedProps`.
  - `chartDataSchema.ts` default-exports a Zod schema and exports `BarChartData`.
  - `chartType.d.ts` contains exactly one `type` declaration.
  - `instructions.md` follows `docs/instructions.template.md`.
- `npm run module:validate` passes.
- `npm run module:generateRegistry` succeeds; `ChartConfigs` includes `BarChartConfig`.
- `npm run lint` passes and TypeScript compiles without errors.
- Browser smoke test renders correctly (orientation, layouts, labels, sorting, coloring,
  reference/target bars, selection, lasso, enhanced tooltip, connections).

---

## Out of scope for v1 (possible follow-ups)

- Diverging bar charts (positive/negative around a baseline).
- Waterfall and Pareto variants.
- Animated transitions between sort orders or layouts.
- Small-multiples / faceting across a second dimension.
