# Plan: `PieChartModule`

Status: implemented.
Scope: new module under `modules/PieChartModule/`. No changes to `ChartWrapper`,
`TabsWrapper`, API routes, or the filter framework.

---

## 1. Decisions (locked)

| Topic | Decision |
| --- | --- |
| Variants | Pie **and** donut in one module, switched by `innerRadius`. No semi-circle/gauge, no nested rings. |
| Data shape | Flat `{ name: string, value: number }`, one row per slice. |
| Value semantics | `value` is required, finite, **non-negative**. No nulls, no pre-computed percent column. |
| Selection | Slice click → `onSelectionChange`. Ctrl/Meta/Shift-click is additive. **No lasso adapter.** |
| Selected visual | Stroke emphasis on selected slices + unselected slices faded. **No radial offset** (see §5.4). |
| Small slices | Config-driven `groupOthers` rollup into a single "Sonstige" slice. |
| Sorting | Configurable, default `"none"` (preserve SQL order). |
| Colors | Palette cycling + optional per-name override map. |
| Labels | Full label config (position, content, number formatting, leader lines, min-percent suppression). |
| Center content | Donut center KPI: total / selected / custom. |
| Slice count guard | Explicit error state above a configurable `maxSlices`. |
| Library | `recharts` v3 (`PieChart`, `Pie`, `Cell`, `Legend`) plus the repository's `ChartTooltip` wrapper, using the `^3.8.0` dependency declared in `package.json`, consistent with `BarChartModule`. |

---

## 2. Files to create

```
modules/PieChartModule/
├── index.tsx             default export, props type ChartWrapperInjectedProps<PieChartData, PieChartConfig>
├── chartDataSchema.ts    default-exports the Zod schema, also exports PieChartData
├── chartType.d.ts        exactly one type declaration: PieChartConfig
└── instructions.md       follows docs/instructions.template.md, all 17 sections
```

Files to update after creation:

- `modules/modulRegistry.ts` — via `npm run module:generateRegistry` (do not hand-edit).
- `modules/instructions.md` — add a `### PieChartModule` entry in the catalogue,
  stating when to prefer it over `BarChartModule` (part-to-whole of a single
  measure vs. comparison across categories) and over `CardModule`.

Not touched: `app/`, `components/ChartWrapper`, `components/TabsWrapper`,
`app/api/**`, `stores/**`.

---

## 3. `chartDataSchema.ts`

```ts
import { z } from "zod";

export const pieChartDataSchema = z.object({
  name: z.string(),
  value: z.number().finite().nonnegative(),
});

export type PieChartData = z.infer<typeof pieChartDataSchema>;

export default pieChartDataSchema;
```

Consequences for SQL authors, to be documented in `instructions.md` §3:

- One row per slice; the query must already be a `GROUP BY` aggregate.
- `name` must be non-null. Uniqueness is **required but not enforceable by the
  schema** — Zod validates each row independently, so duplicates pass validation
  and then mis-key color overrides and legend entries. The module does not
  merge or reject them; this is a documented limitation (§16), not an error
  state.
- `value = 0` passes schema validation (`nonnegative`) but the module **drops
  the row** before rendering (§5.1 step 1). A zero-valued category therefore
  disappears from the chart, the legend, and the labels. SQL authors who need
  zeros visible must use `BarChartModule`.
- Negative values fail schema validation in `ChartWrapper` and render the
  wrapper's error state. Net/delta measures belong in `BarChartModule`.

---

## 4. `chartType.d.ts` — `PieChartConfig`

Single type declaration. Naming deliberately mirrors `BarChartConfig`
(`tooltip`, `legend`, `margin`, `sort`, `selectionStyle`) so config authoring
transfers between modules. Note that `numberFormat` is **not** a top-level key
in `BarChartConfig` either — it is nested under the block that consumes it
(`valueAxis.numberFormat`, `valueLabels.numberFormat`); the same nesting applies
here (`labels.numberFormat`, `centerLabel.numberFormat`).

The shape block is named `pie`, mirroring `BarChartConfig.bars`. There is no
`geometry` key anywhere in this repo and none is introduced.

**Constraint from `scripts/modules/validateModules.ts`:** `chartType.d.ts` must
contain exactly one type alias **and exactly one statement total**. No `import`
statements are permitted in this file. `PieChartConfig` below is therefore fully
self-contained and must stay that way.

```ts
type PieChartConfig = {
  /** Geometry of the ring. Percentages of the available radius, or pixels. */
  pie: {
    /** 0, "0%", or omitted = full pie. A positive number or percentage = donut. */
    innerRadius?: number | string;
    outerRadius?: number | string;
    /** Gap between slices in degrees. Default 0. */
    paddingAngle?: number;
    /** Corner rounding in pixels. Default 0. */
    cornerRadius?: number;
    /** Center offset. Defaults to "50%" / "50%". */
    cx?: number | string;
    cy?: number | string;
  };

  margin: { top: number; right: number; bottom: number; left: number };

  tooltip: { show: boolean; cursor: boolean };

  legend: {
    show: boolean;
    position: "top" | "bottom" | "left" | "right";
    /** Append the value or percent to each legend entry. */
    content: "name" | "name-value" | "name-percent";
  };

  colors: {
    /** Cycled in slice order. Defaults to var(--chart-1) ... var(--chart-5). */
    palette?: string[];
    /** Exact-match override keyed by the row's `name`. Wins over `palette`. */
    byName?: Record<string, string>;
    /** Stroke drawn between slices. */
    stroke?: string;
    strokeWidth?: number;
  };

  labels: {
    show: boolean;
    position: "inside" | "outside";
    content: "name" | "value" | "percent" | "name-percent" | "name-value";
    /** Leader lines for position "outside". Ignored when "inside". */
    leaderLines?: boolean;
    /** Hide labels for slices below this share, 0..1. Default 0. */
    minPercent?: number;
    /** Truncate long names to this many characters. */
    maxLabelChars?: number;
    numberFormat?: {
      /** Must be "percent" when labels.content includes a percent. */
      format: "number" | "compact" | "percent" | "currency";
      decimals?: number;
      /** Required when format is "currency". */
      currency?: string;
      locale?: string;
      prefix?: string;
      suffix?: string;
      useGrouping?: boolean;
    };
  };

  /** Donut center KPI. Requires a positive pie.innerRadius and default cx/cy. */
  centerLabel?: {
    show: boolean;
    /**
     * "total"    - sum of all slice values
     * "selected" - sum of currently selected slices, falls back to total
     * "custom"   - renders `value` verbatim
     */
    mode: "total" | "selected" | "custom";
    /** Caption above the number. */
    label?: string;
    /** Required and used verbatim when mode is "custom". */
    value?: string;
    numberFormat?: {
      format: "number" | "compact" | "percent" | "currency";
      decimals?: number;
      /** Required when format is "currency". */
      currency?: string;
      locale?: string;
      prefix?: string;
      suffix?: string;
    };
  };

  /** Rolls a long tail of small slices into one synthetic slice. */
  groupOthers?: {
    enabled: boolean;
    /**
     * "topN"      - keep the `value` largest slices
     * "threshold" - keep slices whose share is >= `value` (0..1)
     */
    mode: "topN" | "threshold";
    value: number;
    /** Defaults to "Sonstige". */
    label?: string;
    color?: string;
  };

  sort?: {
    by: "value" | "name" | "none";
    direction: "asc" | "desc";
  };

  /** Hard guard against unreadable charts. Defaults to 24. */
  maxSlices?: number;

  selectionStyle?: {
    /** Opacity applied to unselected slices while a selection is active. */
    fadeOthersOpacity: number;
    /** Stroke drawn around selected slices. Defaults to var(--foreground). */
    stroke?: string;
    /** Defaults to 2. */
    strokeWidth?: number;
  };
};
```

---

## 5. `index.tsx` — implementation outline

### 5.1 Render pipeline

Derived state uses an internal discriminated representation so rendered slices
can retain original-row identity without confusing a synthetic rollup with a
real row that has the same name:

```ts
type RenderSlice =
  | { kind: "source"; row: PieChartData }
  | {
      kind: "others";
      row: PieChartData;
      absorbedRows: readonly PieChartData[];
    };
```

For `kind: "source"`, `row` is the exact object from `chartData`. For
`kind: "others"`, `row` is the synthetic aggregate. Recharts receives
`RenderSlice[]` and reads the name/value through function `nameKey` and
`dataKey` accessors.

Build the derived state in one `useMemo` chain over `chartData`, in this fixed
order (documented in `instructions.md` §11):

1. **Drop zero-valued rows.** `value === 0` slices render nothing and pollute
   legend/labels; filter them out and count them for §12 messaging. Negative
   values never reach the module (schema rejects them). This drop is a visible
   behavior change for SQL authors and is documented in §3.
2. **`groupOthers`** — `topN` or `threshold`. Produces one `kind: "others"`
  slice containing `{ name: config.groupOthers.label ?? "Sonstige", value:
  <sum> }` and the original rows it absorbed (see 5.4). Do not create the
  synthetic slice when no rows were absorbed.
3. **`sort`** — applied after grouping so "Sonstige" participates in the
   ordering. `by: "none"` short-circuits and preserves SQL order.
4. **`maxSlices` guard** — if the resulting slice count exceeds
   `maxSlices` (default 24), render an explicit in-module message instead of the
   chart (see 5.5). Checked after grouping so `groupOthers` can rescue wide data.
5. **Total** — `sum(value)`; used for percent labels and the center KPI.
   Guard `total === 0` to avoid `NaN` percentages.

### 5.2 Colors

`resolveSliceFill(slice, index)`:
`colors.byName?.[slice.row.name]` → `colors.palette[index % palette.length]` →
`DEFAULT_PALETTE[index % 5]` where the default is
`["var(--chart-1)", ..., "var(--chart-5)"]`.
`groupOthers.color` overrides everything for the synthetic slice.

### 5.3 Labels and center

- Number formatting is **module-local** via `Intl.NumberFormat`, matching
  `BarChartModule` (no shared `lib/` helper exists; do not introduce one for
  this module alone).
- `percent` content is computed as `value / total`, not read from data, and is
  formatted as an `Intl.NumberFormat` percent value (the ratio is not multiplied
  by 100 before formatting). When `labels.content` is `"percent"` or
  `"name-percent"`, an explicitly supplied `labels.numberFormat.format` must be
  `"percent"`. Value-based content uses the configured format and defaults to
  `"number"`.
- Legend `name-value` entries use the same value formatter as labels. Legend
  `name-percent` entries use the same percent formatter. This applies even when
  `labels.show` is `false`; `labels.numberFormat` is the shared formatting
  configuration for both surfaces.
- `minPercent` suppresses the label but keeps the slice.
- `position: "outside"` uses a custom label renderer with optional leader lines.
  Label collision is **not** solved — listed under §16 Known Limitations, with
  `groupOthers` + `minPercent` as the documented mitigation.
- Below a 480px module width, left/right legends move below the plot and outside
  labels are hidden to prevent collisions. Inside labels remain visible.
- Center label renders as an absolutely-positioned overlay div, not an SVG
  `<text>`, so it can wrap and reuse Tailwind typography. A small module-local
  child inside `<PieChart>` reads `usePlotArea()` and reports `{ x, y, width,
  height }` to the parent; the overlay is centered at
  `(x + width / 2, y + height / 2)`. This keeps it aligned when margins or the
  measured legend move the plot.
- Normalize `pie.innerRadius` before deciding whether the chart is a donut:
  positive numbers and positive percentage strings are donuts; `undefined`,
  `0`, and `"0%"` are full pies. The center label is skipped for a full pie.
- The overlay supports only the default `pie.cx`/`pie.cy` (`undefined` or
  `"50%"`). An off-center donut still renders, but its center label is skipped.
- `centerLabel.mode: "custom"` renders `centerLabel.value` verbatim and ignores
  `centerLabel.numberFormat`. Total and selected modes use the configured
  formatter and default to `"number"`.

### 5.4 Selection

Follows the wrapper selection contract, with Pie-specific event handling:

- Recharts calls `<Pie onClick>` with `(sector, index, event)`. Its `sector` and
  `sector.payload` are derived objects, not the original `chartData` object.
  Resolve the clicked item as `renderSlices[index]`; do not pass either Recharts
  object to selection or tooltip APIs.
- If the indexed item is `kind: "others"`, return before tooltip or selection
  work. Otherwise, use `renderSlice.row`, which is the original source object.
- `additive = event.ctrlKey || event.metaKey || event.shiftKey`.
- `onSelectionChange([row], additive ? { additive: true } : undefined)`.
  The signature is defined by `SelectionChangeOptions` in
  `types/baseChart.d.ts` (`{ additive?: boolean }`).
- When `enhancedTooltip` is true, also open the tooltip. The store is a
  **default export** `useTooltipStore` from `@/stores/tooltip`, selected with
  `useShallow` from `zustand/shallow` — there is no named `showTooltipOnClick`
  import. Mirror `modules/BarChartModule/index.tsx`:
  `showTooltipOnClick({ chartID, dataPoint: row, position: { x: event.clientX, y: event.clientY } })`.
- **No `lasso.mode === null` gate.** `BarChartModule` gates clicks on it because
  it registers a lasso adapter and must not fire selection mid-gesture.
  `PieChartModule` registers no adapter, so `ChartWrapper` never activates a
  lasso mode for this chart and the gate is omitted deliberately. If a lasso
  adapter is ever added, the gate must be added with it.
- Highlighting compares by **object identity** against a
  `useMemo(() => new Set(selectedRows), [selectedRows])`, matching
  `ChartWrapper`. A source slice is selected when
  `selectedSet.has(renderSlice.row)`; a synthetic slice is never selected.
- `selectedRows` is injected as `readonly D[]`. Copy it (`[...selectedRows]`)
  before passing it anywhere expecting a mutable `D[]`.

**Selected-slice rendering — no radial offset.** Recharts' `activeShape` /
`activeIndex` targets the single hover-active slice; `<Cell>` accepts no
`outerRadius`. Because selection here is additive, N slices can be selected at
once, and there is no single-`<Pie>` mechanism to offset an arbitrary subset.
Decision: **selection is expressed with stroke and opacity only**, both of which
`<Cell>` supports per slice:

- selected slices get `stroke` / `strokeWidth` from `selectionStyle`;
- every unselected slice gets `fillOpacity = selectionStyle.fadeOthersOpacity`
  while any selection is active.

Alternatives considered and rejected: overlaying a second `<Pie>` for the
selected subset (duplicate geometry, breaks `paddingAngle` and label layout),
and relying on `activeIndex` accepting an array (removed/reworked in recharts
v3). Offset selection is listed in §16.

**Critical constraint — the "Sonstige" slice is synthetic.** It is not a row
from `chartData`, so it must not be passed to `onSelectionChange`. Sending it
would break the tooltip/connection contract, which requires every data-point
property to be an atomic value batched into tooltip SQL. Decision:

- The "Sonstige" slice is **not selectable**. Clicking it is a no-op, its
  cursor stays `default`, and it never opens the enhanced tooltip. This is
  enforced by the `RenderSlice.kind` discriminant, not by comparing names.
  A real source row named "Sonstige" therefore remains selectable.
- Alternative considered and rejected: emitting all absorbed rows on click.
  It silently produces a selection the user did not visibly make and makes
  connection filtering unpredictable.

### 5.5 Error and empty states

`ChartWrapper` owns loading / fetch error / schema-validation error. The module
renders only these additional in-module states:

- **All rows filtered out inside the module** (the non-empty response contains
  only zero values) → a neutral "Keine darstellbaren Werte" message. A raw
  empty response is handled by `ChartWrapper`, which does not mount the module.
- **`maxSlices` exceeded** → an explicit message naming the actual slice count
  and the configured limit, and pointing at `groupOthers`. This is a render
  guard, not a thrown error.
- **`centerLabel.show` with a full pie or a non-default `cx`/`cy`** → the center
  label is skipped silently; the chart still renders.

The module also receives `height`, `isLoading`, `isFetching`, and `isError`.
`height` sizes the `ResponsiveContainer`. `isLoading` / `isError` are handled by
`ChartWrapper` and are not re-rendered here. `ChartWrapper` also replaces the
module with its loading state while `isFetching`, so this module does not dim or
otherwise handle background refetches.

### 5.6 Lasso

```ts
// Not registered. PieChartModule never calls lasso.registerAdapter.
```

The `lasso` prop is accepted (it is part of `ChartWrapperInjectedProps`, typed
`LassoController<D>` in `types/lasso.d.ts`) and deliberately unused.
`ChartWrapper` discovers lasso capability at runtime from adapter registration,
so not registering is sufficient — no wrapper change and no config flag is
needed. Confirm during implementation that the wrapper's lasso toolbar is hidden
for a chart with no registered adapter; if it is not, that is a wrapper bug to
report, not something to work around in this module.
Document this explicitly in §10 and §16.

---

## 6. `instructions.md`

Must follow `docs/instructions.template.md` in full — all 17 sections, `---`
separators, `### <property>` / `#### <nested.property>` reference hierarchy with
Type / Required / Description / Example / Allowed values / Behavior per entry.
`CardModule/instructions.md` stops at §6 and is **not** a valid reference;
use `LineChartModule/instructions.md` as the structural model.

Sections needing particular care:

- **§3 Data Contract** — non-negative, non-null `name`, pre-aggregated, one row
  per slice; unique `name` is required but unenforceable; `value = 0` rows are
  dropped by the module.
- **§6 Configuration Rules** — `centerLabel` requires `pie.innerRadius > 0` and
  default `cx`/`cy`; normalize `0`, `"0%"`, and omitted `innerRadius` as a full
  pie. `labels.minPercent`, `groupOthers` `threshold`, and
  `selectionStyle.fadeOthersOpacity` are 0..1. `groupOthers` `topN`,
  `maxSlices`, and `labels.maxLabelChars` are positive integers. Currency
  formatting requires a valid `currency` code. Percent label content requires
  percent formatting. `centerLabel.value` is required in `"custom"` mode and
  its `numberFormat` is ignored. A configured `groupOthers.label` should not
  duplicate a source `name`, because the legend would contain indistinguishable
  entries even though internal selection remains correct.
- **§8 Data and Configuration Relationship** — unlike `BarChartConfig.series`,
  slices are **not** declared in config. Config references data only by the
  `name` string (`colors.byName`). Wrong or stale `byName` keys fail silently
  by falling back to the palette — call this out.
- **§10 Expected Props** — document `chartConfig` (that is the prop name, not
  `config`), `chartData`, `selectedRows` (`readonly`), `onSelectionChange`,
  `height`, `chartID`, `enhancedTooltip`, and that `lasso` is intentionally
  unused. Note that loading, fetching, errors, the visible enhanced tooltip,
  and the connection context menu belong to `ChartWrapper`.
- **§11 Runtime Behavior** — the fixed derive order from §5.1, and that
  "Sonstige" is not clickable. Document the three-argument Recharts click
  callback and the index lookup that recovers the original source row.
- **§12 Validation and Errors** — negative value (wrapper schema error),
  raw empty data (wrapper empty state), `maxSlices` exceeded (module render
  guard), all-zero data (module empty state), `centerLabel` on a full pie or
  off-center donut (silently skipped).
  Duplicate `name` is **not** listed here — it is not detectable by the schema
  and belongs in §16.
- **§16 Known Limitations** — no lasso, no zoom, no nested rings, no
  semi-circle, outside-label collision not resolved, "Sonstige" not selectable,
  no radial offset for selected slices, duplicate `name` values silently
  mis-key color overrides and legend entries, `centerLabel` only supports a
  centered donut.

---

## 7. Verification steps

1. `npm run module:validate` — note that this checks **less** than AGENTS.md
   claims. Per `scripts/modules/validateModules.ts` it verifies only:
   - the four required files exist;
   - `index.tsx` has a default export;
   - `chartDataSchema.ts` has a default export (it does **not** check that the
     export is a Zod schema, nor that the data type is exported);
   - `chartType.d.ts` contains exactly one type alias **and exactly one
     statement total**, so the file must have no imports.

   It does **not** verify that the props type is `ChartWrapperInjectedProps`,
   and it does **not** check `instructions.md` against the template. Those two
   must be confirmed by review, not by the script.
2. `npm run module:generateRegistry` — adds `PieChartModule` to
   `modules/modulRegistry.ts` and unions `PieChartConfig` into `ChartConfigs`.
3. Typecheck / build.
4. Manual check with a scratch dashboard entry covering: full pie, donut with
  center total/selected/custom, a positioned legend with a centered KPI,
  `groupOthers` in both modes, outside labels with leader lines,
  `colors.byName`, all sort modes, and all number formats. Exercise additive
  click selection and verify stroke + fade on multiple slices at once. Verify
  that clicking the synthetic slice is a complete no-op while a real source
  row with the same label remains selectable. Exercise an `enhancedTooltip`
  chart with a connection to a second chart.
5. Exercise state ownership and guards separately: verify that raw empty input
  uses the wrapper empty state, while all-zero input uses the module empty
  state. Exceed `maxSlices` once with grouping disabled and once with grouping
  enabled but insufficient. Also cover `innerRadius: "0%"`, a full pie with
  `centerLabel.show`, and an off-center donut with `centerLabel.show`. The
  scratch dashboard is temporary and is removed after verification; no demo
  dashboard is committed.

The module folder must satisfy the contract both before and after every commit —
no partially migrated intermediate state.

---

## 8. Out of scope

- Semi-circle / gauge arcs, nested rings / sunburst, drilldown on slice click.
- Lasso selection or zoom.
- Radial offset ("exploded slice") for the selected state — see §5.4.
- Deduplicating or merging duplicate `name` rows.
- Any `ChartWrapper`, `TabsWrapper`, or API-route change.
- A demo dashboard in `pagesConfig/` (can follow as separate work).

---

## 9. Note for the implementer

`modules/instructions.md` line 63 references a `HistogramModule` that does not
exist in `modules/` (which contains only `BarChartModule`, `CardModule`,
`LineChartModule`, `MapModule`, `TableModule`). It is a stale reference,
unrelated to this plan, and is left untouched here.

Separately, `AGENTS.md` claims `npm run module:validate` verifies the
`ChartWrapperInjectedProps` props type and `instructions.md` template
conformance. It does not (see §7.1). That inaccuracy is also out of scope for
this plan but should be corrected eventually.
