# HistogramModule plan

## Goal

Create a new module at `modules/HistogramModule/` that follows the same contract as
`LineChartModule` and `MapModule`:

- `index.tsx`
- `chartDataSchema.ts`
- `chartType.d.ts`
- `instructions.md`

The module renders a **frequency histogram** with **pre-computed bins** using
`recharts` (`BarChart`/`ComposedChart`), consistent with `LineChartModule`. It supports:

- multiple **overlaid or grouped** distributions sharing one aligned bin grid
- per-series color, opacity, and legend/tooltip labels
- optional **density normalization** (counts → frequency density)
- optional **cumulative distribution overlay** (line on a secondary Y axis)
- optional **mean / median reference lines** (explicit value or bin-approximated)
- **drill / cross-filter**: clicking a bin calls `onSelectionChange` with the bin range
- configurable axes, grid, tooltip, legend, and margins mirroring `LineChartModule`

---

## Decisions from the Q&A

- **Binning location: pre-computed in SQL.** Aggregation runs in Databricks; only compact
  per-bin counts cross the wire. This matches the repo's "SQL shapes data to the module
  schema" model and scales to large tables. Bin edges are authored in SQL; all presentation
  (colors, density, cumulative, reference lines) stays in config.
- **Library: `recharts`.** No new charting dependency; reuse the existing
  `components/ui/chart` primitives (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`)
  as `LineChartModule` does.
- **Series: multiple.** Data uses a compact `counts: (number | null)[]` array per bin
  (mirroring `LineChartModule`'s `{ x, y: [...] }`). All series share the same bin grid so
  overlaid/grouped comparison is aligned by construction.
- **Drill: enabled.** The module is a drill source; clicking a bar calls
  `onSelectionChange(rows)` with the selected bin row(s) so a bin range can filter other charts.
- **Extras: included.** v1 ships density normalization, a cumulative overlay, and
  mean/median reference lines. All are config-gated and default off.

### Why the compact bin shape

Overlaid histograms only compare meaningfully when every series uses **identical bin
edges**. Encoding one row per bin with a `counts` array guarantees shared edges in the
transport format itself, keeps payloads tiny, and lets the module map `seriesIndex →
counts[seriesIndex]` exactly like `LineChartModule` maps `seriesIndex → y[seriesIndex]`.

---

## Dependencies

No new dependencies. `recharts`, `zod`, and `components/ui/chart` are already used by
`LineChartModule`. `tsconfig.json` requires no changes.

---

## Data contract

### Transport shape

Each row is one bin. `counts[seriesIndex]` is the frequency for that series in that bin.

```ts
{
  binStart: number;          // inclusive lower edge
  binEnd: number;            // exclusive upper edge (inclusive for the last bin)
  counts: (number | null)[]; // per-series frequency; null = no data for that series
  binLabel?: string;         // optional display label overriding the numeric range
}
```

### `chartDataSchema.ts`

```ts
import { z } from "zod";

export const histogramDataSchema = z.object({
  binStart: z.number().finite(),
  binEnd: z.number().finite(),
  counts: z.array(z.number().finite().nonnegative().nullable()),
  binLabel: z.string().optional(),
});

export type HistogramData = z.infer<typeof histogramDataSchema>;

export default histogramDataSchema;
```

### Data rules (documented in `instructions.md`)

- Rows must be **sorted ascending by `binStart`**.
- Bins must be **contiguous and non-overlapping**: `row[i].binEnd === row[i + 1].binStart`.
- `counts` length must be `>= max(series.seriesIndex) + 1` across all configured series.
- `binStart < binEnd` for every row.
- `counts` values are frequencies (non-negative); `null` means the series has no data in
  that bin and is rendered as a gap.
- Bin edges are shared across all series (all series read from the same `counts` array).
- Equal-width bins are recommended; density normalization assumes each bin's width is
  `binEnd - binStart` and works with variable widths too.

### Example API response

```json
[
  { "binStart": 0,  "binEnd": 10, "counts": [4, 1] },
  { "binStart": 10, "binEnd": 20, "counts": [9, 3] },
  { "binStart": 20, "binEnd": 30, "counts": [12, 7] },
  { "binStart": 30, "binEnd": 40, "counts": [6, 11] },
  { "binStart": 40, "binEnd": 50, "counts": [2, 5] }
]
```

---

## Configuration type (`chartType.d.ts`)

Exactly one `type` declaration named `HistogramChartConfig`.

```ts
type HistogramChartConfig = {
  xAxis: {
    show: boolean;
    tickLine: boolean;
    axisLine: boolean;
    tickMargin: number;
    /**
     * "range"     -> "0–10" using bin edges
     * "start"     -> lower edge only, e.g. "0"
     * "midpoint"  -> bin center, e.g. "5"
     * "label"     -> use row.binLabel when present, else falls back to "range"
     */
    format: "range" | "start" | "midpoint" | "label";
  };

  yAxis: {
    show: boolean;
    tickLine: boolean;
    axisLine: boolean;
    /** "count" raw frequency, "compact" e.g. 12.5K, "percent" share of total. */
    format: "count" | "compact" | "percent";
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
    /**
     * "overlay"  -> series share the same x slot, semi-transparent, drawn on top of each other
     * "group"    -> series sit side by side within each bin
     * "stack"    -> series stacked within each bin
     */
    layout: "overlay" | "group" | "stack";
    /** Gap between bins (recharts barCategoryGap), e.g. "10%" or 4. */
    categoryGap: string | number;
    /** Gap between bars within a bin for "group" layout. */
    barGap: string | number;
    /** Corner radius applied to each bar. */
    radius: number;
  };

  /** Convert counts to frequency density: count / (total * binWidth). Off by default. */
  density: { enabled: boolean };

  /** Cumulative distribution line drawn on a secondary Y axis. Off by default. */
  cumulative: {
    enabled: boolean;
    /** "count" running total, "percent" running share (0–100). */
    mode: "count" | "percent";
    stroke: string;
    strokeWidth: number;
    showAxis: boolean;
  };

  /** One entry per distribution; seriesIndex selects counts[seriesIndex]. */
  series: {
    seriesIndex: number;
    name: string;
    fill: string;
    fillOpacity: number;
    stroke?: string;
    strokeWidth?: number;
  }[];

  /** Optional vertical reference lines (mean, median, thresholds, targets). */
  referenceLines: {
    label: string;
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
    /**
     * "value"  -> use the explicit `value` (authored/known exact statistic)
     * "mean"   -> approximate from bin midpoints weighted by counts[seriesIndex]
     * "median" -> approximate from the cumulative distribution of counts[seriesIndex]
     */
    source: "value" | "mean" | "median";
    /** Required when source === "value". */
    value?: number;
    /** Which series to compute mean/median from; defaults to 0. */
    seriesIndex?: number;
  }[];
};
```

---

## Implementation plan

### Phase 1 — Data contract and config type

1. Create `modules/HistogramModule/chartDataSchema.ts` with the Zod schema above
   (default export `histogramDataSchema`, named type `HistogramData`).
2. Create `modules/HistogramModule/chartType.d.ts` with the single `HistogramChartConfig`
   type above.

### Phase 2 — Component implementation

Create `modules/HistogramModule/index.tsx` with a default export typed as:

```ts
ChartWrapperInjectedProps<HistogramData, HistogramChartConfig>
```

The component should:

1. Destructure `chartConfig`, `chartData`, `height`, and `onSelectionChange` from injected
   props (same pattern as `LineChartModule`).
2. Build recharts rows once with `useMemo`, mapping each bin to
   `{ binStart, binEnd, binMid, binLabel, series_<i>: counts[i], cumulative_<i>?: ... }`.
   Reuse the `series_${number}` key convention and index-bounds validation from
   `LineChartModule` (`getSeriesKey`, throw on missing/negative `seriesIndex`).
3. If `density.enabled`, transform each `counts[i]` to `count / (total_i * binWidth)` before
   plotting; label the Y axis accordingly.
4. If `cumulative.enabled`, compute a running total/percent per series and expose it as a
   `Line` on a secondary `YAxis` (`yAxisId="cumulative"`), gated by `cumulative.showAxis`.
5. Build the `ChartContainer` config from `series` (label + color) like
   `createChartContainerConfig` in `LineChartModule`.
6. Render a `ComposedChart` with:
   - `XAxis` using `binStart`/`binEnd`/`binMid`/`binLabel` per `xAxis.format`.
   - primary `YAxis` formatted by `yAxis.format` (count/compact/percent).
   - optional secondary `YAxis` for the cumulative overlay.
   - `CartesianGrid`, `ChartTooltip`, `Legend` gated by config, matching `LineChartModule`.
   - one `<Bar>` per series, with `stackId` set when `bars.layout === "stack"`,
     `fillOpacity` from config, and `radius` from `bars.radius`.
   - `<ReferenceLine>` per configured entry (value resolved from `source`).
7. Compute mean/median approximations from bins when a reference line uses
   `source: "mean" | "median"` (helper `computeStatFromBins`).
8. Drill: when `onSelectionChange` is a function, set `onClick` on the chart; on bar click,
   resolve the active bin and call `onSelectionChange([binRow])`. Mirror the guarded
   `handleChartClick` approach in `LineChartModule` (no-op when selection disabled).
9. Wrap in `ChartContainer` with the same `height`/`svh` handling used by `LineChartModule`.

Optional helper extraction (not required by the contract):

- `modules/HistogramModule/transform.ts` for pure row-building, density, and cumulative math.
- `modules/HistogramModule/stats.ts` for `computeStatFromBins` (mean/median).

### Phase 3 — Documentation and registry

1. Create `modules/HistogramModule/instructions.md` following `docs/instructions.template.md`
   exactly: purpose, module files, data contract (every field), configuration reference
   (every property), example API response, and data rules.
2. Update root `modules/instructions.md` to add a `HistogramModule` entry:
   - purpose: distribution of a numeric variable via pre-computed bins
   - best use: single or overlaid/grouped distributions, density, cumulative, reference lines
   - how it differs from `LineChartModule` (categorical bins over a value axis, not a
     continuous numeric/time series) and `MapModule` (non-geographic)
   - note that binning happens in SQL and edges must be shared across series
3. Run `npm run module:validate` and `npm run module:generateRegistry` so
   `modules/modulRegistry.ts` gains the `HistogramModule` dynamic import, its data schema,
   and `HistogramChartConfig` in the `ChartConfigs` union.

### Phase 4 — Example SQL and smoke test (optional but recommended)

1. Author an example `pagesConfig/sql/<chartID>.sql` that produces the bin shape. Sketch:

   ```sql
   WITH params AS (
     SELECT 0 AS bin_min, 50 AS bin_max, 5 AS bin_count
   ),
   edges AS (
     SELECT
       bin_min + (bin_max - bin_min) / bin_count * seq AS bin_start,
       bin_min + (bin_max - bin_min) / bin_count * (seq + 1) AS bin_end,
       seq AS bin_index
     FROM params
     LATERAL VIEW posexplode(sequence(0, bin_count - 1)) t AS seq, val
   ),
   assigned AS (
     SELECT
       LEAST(CAST((v.value - p.bin_min) / ((p.bin_max - p.bin_min) / p.bin_count) AS INT),
             p.bin_count - 1) AS bin_index,
       v.series_idx
     FROM source_values v CROSS JOIN params p
     WHERE v.value >= p.bin_min AND v.value < p.bin_max
   )
   SELECT
     e.bin_start AS binStart,
     e.bin_end   AS binEnd,
     ARRAY(
       COUNT_IF(a.series_idx = 0),
       COUNT_IF(a.series_idx = 1)
     ) AS counts
   FROM edges e
   LEFT JOIN assigned a ON a.bin_index = e.bin_index
   GROUP BY e.bin_start, e.bin_end
   ORDER BY e.bin_start;
   ```

   Adjust to the real source table and to the number of series. The key requirements: one
   row per bin, contiguous edges, and a `counts` array whose index order matches the
   configured `series[].seriesIndex`.

2. Add a temporary dashboard entry (or reuse `pagesConfig/drillTest.json`) referencing
   `moduleName: "HistogramModule"`, regenerate the page with
   `npx tsx scripts/pages/generateNextPage.ts`, and visually confirm:
   - bars render with correct bin ranges and counts
   - overlay/group/stack layouts behave as configured
   - density and cumulative toggles produce sensible output
   - mean/median reference lines appear at plausible positions
   - clicking a bar drives the configured drill/cross-filter

---

## Relevant files

- `modules/LineChartModule/*` — structural + implementation template (series indexing,
  axis formatting, drill click handling, `ChartContainer` usage).
- `modules/HistogramModule/index.tsx` — histogram rendering component.
- `modules/HistogramModule/chartDataSchema.ts` — Zod schema and `HistogramData` type.
- `modules/HistogramModule/chartType.d.ts` — single `HistogramChartConfig` type.
- `modules/HistogramModule/instructions.md` — module documentation.
- `modules/instructions.md` — module overview registry.
- `modules/modulRegistry.ts` — generated registry output.
- `types/baseChart.d.ts` — `ChartWrapperInjectedProps` contract.
- `components/ui/chart.tsx` — shared recharts primitives.
- `scripts/modules/validateModules.ts` — validation contract.
- `scripts/modules/generateModuleRegistry.ts` — registry generation.
- `docs/instructions.template.md` — instruction template to follow.

---

## Verification checklist

- Four required `HistogramModule` files exist and satisfy the module contract:
  - `index.tsx` has a default export using `ChartWrapperInjectedProps`.
  - `chartDataSchema.ts` default-exports a Zod schema and exports `HistogramData`.
  - `chartType.d.ts` contains exactly one `type` declaration.
  - `instructions.md` follows `docs/instructions.template.md`.
- `npm run module:validate` passes.
- `npm run module:generateRegistry` succeeds; `ChartConfigs` includes `HistogramChartConfig`.
- `npm run lint` passes and TypeScript compiles without errors.
- Browser smoke test renders correctly (bars, layouts, extras, drill).

---

## Out of scope for v1 (possible follow-ups)

- Client-side re-binning / interactive bin-width control (would require shipping raw values;
  intentionally deferred in favor of the SQL-binned model).
- Automatic bin-count heuristics (Freedman–Diaconis, Sturges) — can be added later in SQL.
- Kernel density estimate (smooth) curves as opposed to a stepped density overlay.
- Horizontal orientation and log-scaled axes.
