# LineChartModule — Test Plan

Status: Proposed
Scope: `modules/LineChartModule/`
Depends on: `docs/plans/testing-strategy-plan.md` (tooling, mocks, directory layout)
Tooling: Vitest (`node` for schema, `jsdom` + React Testing Library for render)

---

## 1. What we are testing

`LineChartModule` renders a configurable multi-series line/area chart from the compact
transport shape `{ x: number, y: (number | null)[] }` using `recharts` (`ComposedChart`).
It supports **selection**: clicking a point calls `onSelectionChange(rows)` with the rows
that share the clicked `x`.

Files under test:

- `modules/LineChartModule/chartDataSchema.ts` — `lineChartDataSchema` / `LineChartData`
- `modules/LineChartModule/chartType.d.ts` — `LineChartConfig`
- `modules/LineChartModule/index.tsx` — default-exported component + pure helpers

---

## 2. Test layers

| Layer            | Environment | Focus                                                                                                      |
| ---------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| Schema           | `node`      | Zod parse/reject, type inference                                                                           |
| Pure helpers     | `node`      | `getSeriesKey`, `formatXAxisValue`, `formatYAxisValue`, `createRechartsData`, `createChartContainerConfig` |
| Component render | `jsdom`     | Series rendering, axis/grid/legend/tooltip gating, selection callback, empty data                          |
| Contract         | `node`      | Module folder contract (shared guard test)                                                                 |

> The helpers listed in §4 are currently module-private. Export them (or extract to a
> `helpers.ts` re-exported from `index.tsx`) so they can be unit-tested directly. This is
> the only production change this plan requires.

---

## 3. Schema tests (`chartDataSchema.test.ts`, `node`)

- Valid row `{ x: 1782864000000, y: [12, 9] }` parses.
- `y` may contain `null`: `{ x: 0, y: [1, null, 3] }` parses.
- `y: []` (empty array) parses — series bounds are validated at render, not in schema.
- Rejects non-finite `x` (`NaN`, `Infinity`).
- Rejects non-finite numbers inside `y` (`NaN`, `Infinity`).
- Rejects missing `x` or missing `y`.
- Rejects `y` containing a string.
- `LineChartData` type matches `z.infer<typeof lineChartDataSchema>` (compile-time assert
  via `expectTypeOf`).

## 4. Pure-helper tests (`helpers.test.ts`, `node`)

### `getSeriesKey`

- `getSeriesKey(0) === "series_0"`, `getSeriesKey(2) === "series_2"`.

### `formatXAxisValue`

- `format: "number"` → `String(value)`.
- `format: "date-month-day"` on a known UTC timestamp → `"MM-DD"` (assert UTC, not local).
- `format: "date-day-month"` → `"DD.MM"`.
- Padding: single-digit month/day zero-padded (e.g. `"08-05"`).

### `formatYAxisValue`

- `"number"` → raw string.
- `"compact"` → `12500` becomes `"12.5K"` (via `Intl.NumberFormat`, `en`).
- `"percent"` → `45` becomes `"45%"`.

### `createRechartsData`

- Maps `{ x, y }` rows to `{ x, series_<i> }` using each line's `seriesIndex`.
- Selects the correct `y[seriesIndex]` for multiple lines with non-contiguous indices
  (e.g. lines with `seriesIndex` 0 and 2).
- Passes through `null` values unchanged.
- **Throws** when `seriesIndex < 0` (message names the line).
- **Throws** when `seriesIndex >= y.length` (message names the line and data point index).

### `createChartContainerConfig`

- Produces `{ series_<i>: { label, color } }` keyed by `seriesIndex`, using `line.name`
  and `line.stroke`.

## 5. Component render tests (`index.test.tsx`, `jsdom`)

Use a `renderWithProviders` helper. Recharts needs a sized container — mock
`ResponsiveContainer`/`ChartContainer` sizing or set an explicit width/height on the wrapper
so SVG elements mount.

- **Renders series**: given 2 lines and valid `chartData`, two path/series elements render;
  legend text shows configured `name`s when `legend.show`.
- **Line vs Area**: `line.fill.enabled: true` renders an `Area`; `false` renders a `Line`
  (assert by role/class or by presence of a filled path).
- **Axis gating**: `xAxis.show: false` / `yAxis.show: false` hide the respective axis;
  `grid.show: false` removes the grid.
- **Tooltip/legend gating**: `tooltip.show: false` and `legend.show: false` remove them.
- **Height**: `height` prop drives the container `svh` style.
- **Empty data**: `chartData: []` renders without throwing (no series, no crash). (Empty-state
  copy is owned by `ChartWrapper`, not the module.)
- **Invalid config surfaces**: a line with `seriesIndex` out of range causes the render to
  throw the descriptive error from `createRechartsData` (assert via error boundary in test).

### Selection

- When `onSelectionChange` is provided, an `onClick` handler is wired on the chart.
- Simulating a chart click with a valid `activeLabel` calls `onSelectionChange` with **all
  rows** whose `x` equals the clicked value (test the `handleChartClick` logic directly by
  invoking it with a synthetic `{ activeLabel }` state).
- Non-finite `activeLabel` (e.g. `undefined`, `"abc"`) does **not** call `onSelectionChange`.
- When `onSelectionChange` is absent, no selection click handler is attached.

## 6. Fixtures

Add `tests/fixtures/lineChart.ts`:

- `validSingleSeries` — one line, ~5 points.
- `validMultiSeries` — two lines, includes a `null` gap.
- `nullGapSeries` — for `connectNulls` behavior.

Meta-test: every fixture parses through `lineChartDataSchema` (guards fixture drift).

## 7. Out of scope

- Pixel/visual correctness of the SVG (deferred to optional Playwright visual regression).
- `recharts` internal behavior.
- Data fetching and schema validation at the boundary — those live in `ChartWrapper` tests.
