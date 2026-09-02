# HistogramModule — Test Plan

Status: Proposed
Scope: `modules/HistogramModule/` (planned — see `docs/plans/histogram-module-plan.md`)
Depends on: `docs/plans/testing-strategy-plan.md` (tooling, mocks, directory layout)
Tooling: Vitest (`node` for schema/helpers, `jsdom` + React Testing Library for render)

> The module does not exist yet. This plan is written against the contract defined in
> `docs/plans/histogram-module-plan.md`. Implement the tests alongside the module so each
> behavior lands with coverage. If the final schema/config differs from the plan, update the
> assertions below to match the shipped `chartDataSchema.ts` and `chartType.d.ts`.

---

## 1. What we are testing

`HistogramModule` renders a frequency histogram from **pre-computed bins**. Transport is one
row per bin: `{ binStart, binEnd, counts: (number | null)[], binLabel? }`, with all series
sharing the same bin grid. It supports overlay/group/stack layouts, optional density
normalization, an optional cumulative overlay on a secondary axis, and mean/median/value
reference lines. It supports **selection**: clicking a bin calls `onSelectionChange(rows)`
with the selected bin range.

Files under test:

- `modules/HistogramModule/chartDataSchema.ts` — `histogramDataSchema` / `HistogramData`
- `modules/HistogramModule/chartType.d.ts` — `HistogramChartConfig`
- `modules/HistogramModule/index.tsx` — component + pure helpers

---

## 2. Test layers

| Layer                 | Environment | Focus                                                                       |
| --------------------- | ----------- | --------------------------------------------------------------------------- |
| Schema                | `node`      | Bin/count parse & reject rules                                              |
| Data-shape validation | `node`      | Ordering, contiguity, series-index bounds (helper-level guards)             |
| Pure helpers          | `node`      | Recharts row builder, density, cumulative, mean/median, axis formatters     |
| Component render      | `jsdom`     | Layout modes, axes, cumulative axis, reference lines, selection, empty data |
| Contract              | `node`      | Module folder contract (shared guard test)                                  |

> Expose the transform helpers (bin→recharts row builder, density, cumulative, mean/median
> approximation, `getSeriesKey`, axis formatters) as testable exports (`helpers.ts`) so the
> statistical logic is unit-tested without mounting SVG.

---

## 3. Schema tests (`chartDataSchema.test.ts`, `node`)

- Valid `{ binStart: 0, binEnd: 10, counts: [4, 1] }` parses.
- `counts` may contain `null`: `{ binStart: 0, binEnd: 10, counts: [4, null] }` parses.
- Optional `binLabel` accepted.
- Rejects **negative** counts (`counts: [-1]`) — schema uses `nonnegative()`.
- Rejects non-finite `binStart`, `binEnd`, or any finite-required `counts` entry
  (`NaN`, `Infinity`).
- Rejects `counts` containing a string.
- `HistogramData` type matches `z.infer` (compile-time assert via `expectTypeOf`).

> Note: the Zod schema intentionally does not enforce ordering/contiguity/`binStart < binEnd`
> (those are cross-row rules). Cover them in §4.

## 4. Data-shape guard tests (`dataRules.test.ts`, `node`)

If the module validates row invariants before rendering (recommended per the plan), test the
guard helper directly:

- Accepts rows sorted ascending by `binStart` with contiguous edges
  (`row[i].binEnd === row[i+1].binStart`).
- Rejects/repairs unsorted rows (assert the module's chosen behavior — throw or sort).
- Rejects overlapping or gapped bins.
- Rejects `binStart >= binEnd` for any row.
- Rejects when `counts.length < max(series.seriesIndex) + 1` for the configured series.

## 5. Pure-helper tests (`helpers.test.ts`, `node`)

### Recharts row builder

- Maps each bin to `{ binStart, binEnd, binMid, binLabel, series_<i>: counts[i] }`.
- `binMid === (binStart + binEnd) / 2`.
- Selects correct `counts[seriesIndex]` for non-contiguous series indices.
- Throws on negative `seriesIndex` and on `seriesIndex >= counts.length` (mirrors
  `LineChartModule` bounds behavior, with descriptive message).
- Passes `null` counts through as gaps.

### Density normalization (`density.enabled`)

- Transforms `counts[i]` to `count / (total_i * binWidth)` where `binWidth = binEnd - binStart`.
- `total_i` is the sum of non-null counts for series `i`.
- Works with variable bin widths.
- Density values integrate to ~1 across bins for a single series (assert within tolerance).

### Cumulative overlay (`cumulative.enabled`)

- `mode: "count"` produces a monotonically non-decreasing running total per series; final
  value equals the series total.
- `mode: "percent"` runs 0→100; final value is 100 (within tolerance) for a non-empty series.
- Null counts treated as 0 contribution but do not break monotonicity.

### Reference lines

- `source: "value"` uses the explicit `value`.
- `source: "mean"` approximates from bin midpoints weighted by `counts[seriesIndex]`
  (assert against a hand-computed expected mean for a small fixture).
- `source: "median"` approximates from the cumulative distribution (50% crossing); assert
  against a hand-computed expected median.
- `seriesIndex` defaults to `0` when omitted.

### Axis formatters

- X `format`: `"range"` → `"0–10"`; `"start"` → `"0"`; `"midpoint"` → `"5"`; `"label"` uses
  `binLabel` when present, else falls back to `"range"`.
- Y `format`: `"count"` raw, `"compact"` → `"12.5K"`, `"percent"` → share of total.

## 6. Component render tests (`index.test.tsx`, `jsdom`)

- **Renders bars**: one bar group per bin; series count matches configured `series`.
- **Layout modes**: `overlay` (semi-transparent overlapping), `group` (side-by-side),
  `stack` (stacked) each render the expected recharts structure/props.
- **Axis gating**: `xAxis.show` / `yAxis.show` / `grid.show` / `tooltip.show` / `legend.show`
  toggle the corresponding elements.
- **Cumulative axis**: `cumulative.enabled` + `showAxis` renders a secondary Y axis and a
  line; disabling hides both.
- **Reference lines**: each configured reference line renders with its label/stroke.
- **Density label**: `density.enabled` updates the Y axis semantics/label.
- **Height**: `height` prop drives container sizing.
- **Empty data**: `chartData: []` renders without throwing.

### Selection

- Clicking a bin calls `onSelectionChange` with the bin row(s) covering the clicked range.
- `selectionMode: "multi"` selection returns multiple bin rows when applicable.
- When `onSelectionChange` is absent, selection clicks are inert.

## 7. Fixtures

Add `tests/fixtures/histogram.ts`:

- `singleSeries` — 5 contiguous equal-width bins.
- `twoSeriesOverlay` — two series sharing the grid, includes a `null` gap.
- `variableWidthBins` — for density tests.
- `knownStats` — a small distribution with hand-computed mean/median for reference-line tests.

Meta-test: every fixture parses through `histogramDataSchema` and passes the §4 data-shape
guard.

## 8. Out of scope

- Server-side/SQL binning correctness (bins are pre-computed upstream; validate the SQL in
  dashboard-level/E2E tests, not here).
- `recharts` internals and pixel-level rendering.
