# `PieChartModule` Instructions

## 1. Purpose

`PieChartModule` renders a single non-negative measure as a full pie or donut.

Use this module for part-to-whole composition with a modest number of unique
categories. Prefer `BarChartModule` when precise category comparison, negative
values, or visible zero values matter. Prefer `CardModule` when only one total
or KPI is needed.

The module supports click selection, additive selection, configurable labels,
legend content, long-tail grouping, and a centered donut KPI. It does not
support lasso, zoom, nested rings, gauges, or negative values.

---

## 2. Module Files

The module consists of:

```text
modules/PieChartModule/
├── index.tsx
├── chartDataSchema.ts
├── chartType.d.ts
└── instructions.md
```

### `index.tsx`

Contains the Recharts implementation and default export.

### `chartDataSchema.ts`

Defines and exports the Zod data schema and `PieChartData` type.

### `chartType.d.ts`

Contains the single `PieChartConfig` type declaration.

### `instructions.md`

Documents the module contract and behavior.

---

## 3. Data Contract

### Data Type

```ts
type PieChartData = {
  name: string;
  value: number;
};
```

### Data Structure

#### `name`

Type:

```ts
string
```

Description:

Category name shown by slices, labels, legends, and the inline tooltip.

Rules:

- Must be non-null.
- Must be unique across the response.
- Duplicate names are not rejected by the row-level schema.

#### `value`

Type:

```ts
number
```

Description:

Finite, non-negative measure represented by the slice area.

Rules:

- Must be finite and at least zero.
- Negative or null values fail schema validation.
- Zero-valued rows pass validation but are removed before rendering.

### Example API Response

```json
[
  { "name": "Nord", "value": 42 },
  { "name": "Süd", "value": 31 },
  { "name": "West", "value": 18 }
]
```

### Data Rules

- Return one pre-aggregated row per slice.
- Aggregate in SQL with the appropriate `GROUP BY`; the module does not merge
  duplicate names.
- Preserve SQL order when `sort.by` is `"none"`.
- Use `BarChartModule` for signed deltas or categories whose zero values must
  remain visible.

---

## 4. Configuration

The module is controlled by `PieChartConfig` from `chartType.d.ts`.

### Configuration Type

```ts
type PieChartConfig = {
  pie: {
    innerRadius?: number | string;
    outerRadius?: number | string;
    paddingAngle?: number;
    cornerRadius?: number;
    cx?: number | string;
    cy?: number | string;
  };
  margin: { top: number; right: number; bottom: number; left: number };
  tooltip: { show: boolean; cursor: boolean };
  legend: {
    show: boolean;
    position: "top" | "bottom" | "left" | "right";
    content: "name" | "name-value" | "name-percent";
  };
  colors: {
    palette?: string[];
    byName?: Record<string, string>;
    stroke?: string;
    strokeWidth?: number;
  };
  labels: {
    show: boolean;
    position: "inside" | "outside";
    content: "name" | "value" | "percent" | "name-percent" | "name-value";
    leaderLines?: boolean;
    minPercent?: number;
    maxLabelChars?: number;
    numberFormat?: NumberFormat;
  };
  centerLabel?: CenterLabelConfig;
  groupOthers?: GroupOthersConfig;
  sort?: SortConfig;
  maxSlices?: number;
  selectionStyle?: SelectionStyle;
};
```

The readable excerpt above abbreviates nested types. `chartType.d.ts` is the
authoritative complete type.

---

## 5. Configuration Reference

### `pie`

Type: `{ innerRadius?, outerRadius?, paddingAngle?, cornerRadius?, cx?, cy? }`

Required: `yes`

Description: Controls pie or donut geometry.

Example: `{ innerRadius: "58%", outerRadius: "82%" }`

Behavior: A positive `innerRadius` produces a donut; zero or omission produces
a full pie.

#### `pie.innerRadius`

Type: `number | string`

Required: `no`

Description: Inner radius in pixels or as a percentage.

Example: `"58%"`

Allowed values: Non-negative numbers or percentage strings.

Behavior: `0`, `"0%"`, and omission render a full pie.

#### `pie.outerRadius`

Type: `number | string`

Required: `no`

Description: Outer radius in pixels or as a percentage.

Example: `"82%"`

Behavior: Passed to Recharts. Recharts uses its default when omitted.

#### `pie.paddingAngle`

Type: `number`

Required: `no`

Description: Angular gap between slices in degrees.

Example: `2`

Behavior: Defaults to `0`.

#### `pie.cornerRadius`

Type: `number`

Required: `no`

Description: Slice corner radius in pixels.

Example: `4`

Behavior: Defaults to `0`.

#### `pie.cx`

Type: `number | string`

Required: `no`

Description: Horizontal center coordinate.

Example: `"50%"`

Behavior: Defaults to `"50%"`. Non-default values disable the center KPI.

#### `pie.cy`

Type: `number | string`

Required: `no`

Description: Vertical center coordinate.

Example: `"50%"`

Behavior: Defaults to `"50%"`. Non-default values disable the center KPI.

### `margin`

Type: `{ top: number; right: number; bottom: number; left: number }`

Required: `yes`

Description: Space around the Recharts plot.

Example: `{ top: 16, right: 24, bottom: 16, left: 24 }`

Behavior: Also affects the plot bounds used to center the donut KPI.

### `tooltip`

Type: `{ show: boolean; cursor: boolean }`

Required: `yes`

Description: Controls the inline Recharts tooltip.

Example: `{ show: true, cursor: false }`

Behavior: This tooltip is suppressed while a wrapper-owned enhanced tooltip is
visible. It is separate from tooltip SQL.

#### `tooltip.show`

Type: `boolean`

Required: `yes`

Description: Shows or hides the inline tooltip.

Example: `true`

Behavior: `false` removes the inline tooltip component.

#### `tooltip.cursor`

Type: `boolean`

Required: `yes`

Description: Passes the cursor option to the Recharts tooltip.

Example: `false`

Behavior: Does not affect click selection.

### `legend`

Type: `{ show: boolean; position: Position; content: Content }`

Required: `yes`

Description: Controls legend visibility, placement, and text.

Example: `{ show: true, position: "right", content: "name-percent" }`

Behavior: Side legends use a vertical layout; top and bottom legends are
horizontal. Below 480px, side legends move to the bottom. The measured legend
changes the available plot area.

#### `legend.show`

Type: `boolean`

Required: `yes`

Description: Shows or hides the legend.

Example: `true`

#### `legend.position`

Type: `"top" | "bottom" | "left" | "right"`

Required: `yes`

Description: Places the legend around the plot.

Example: `"bottom"`

Allowed values: `top`, `bottom`, `left`, `right`

#### `legend.content`

Type: `"name" | "name-value" | "name-percent"`

Required: `yes`

Description: Selects legend entry text.

Example: `"name-percent"`

Behavior: Value and percent variants use `labels.numberFormat`.

### `colors`

Type: `{ palette?, byName?, stroke?, strokeWidth? }`

Required: `yes`

Description: Controls slice fill and separator strokes.

Example: `{ palette: ["#2563eb", "#f59e0b"], strokeWidth: 1 }`

#### `colors.palette`

Type: `string[]`

Required: `no`

Description: Fill colors cycled in rendered slice order.

Example: `["#2563eb", "#f59e0b", "#16a34a"]`

Behavior: Empty or omitted palettes fall back to `--chart-1` through
`--chart-5`.

#### `colors.byName`

Type: `Record<string, string>`

Required: `no`

Description: Exact-match fill overrides keyed by data `name`.

Example: `{ "Nord": "#2563eb" }`

Behavior: Overrides the palette. Unknown keys silently fall back.

#### `colors.stroke`

Type: `string`

Required: `no`

Description: Separator stroke between slices.

Example: `"var(--background)"`

Behavior: Defaults to `var(--background)`.

#### `colors.strokeWidth`

Type: `number`

Required: `no`

Description: Separator stroke width in pixels.

Example: `1`

Behavior: Defaults to `1`.

### `labels`

Type: `{ show; position; content; leaderLines?; minPercent?; maxLabelChars?; numberFormat? }`

Required: `yes`

Description: Controls slice labels and shared value formatting.

Example: `{ show: true, position: "outside", content: "name-percent" }`

#### `labels.show`

Type: `boolean`

Required: `yes`

Description: Shows or hides slice labels.

Example: `true`

Behavior: Outside labels are hidden below 480px to prevent collisions with the
legend and neighboring labels. Inside labels remain visible.

#### `labels.position`

Type: `"inside" | "outside"`

Required: `yes`

Description: Places labels in slices or outside the ring.

Example: `"outside"`

#### `labels.content`

Type: `"name" | "value" | "percent" | "name-percent" | "name-value"`

Required: `yes`

Description: Selects label text.

Example: `"name-percent"`

#### `labels.leaderLines`

Type: `boolean`

Required: `no`

Description: Shows leader lines for outside labels.

Example: `true`

Behavior: Defaults to `true` outside and is ignored inside.

#### `labels.minPercent`

Type: `number`

Required: `no`

Description: Hides labels below this share without removing slices.

Example: `0.03`

Allowed values: `0` through `1`

Behavior: Defaults to `0`.

#### `labels.maxLabelChars`

Type: `number`

Required: `no`

Description: Maximum category-name length before ellipsis.

Example: `18`

Behavior: Applies only to the name portion.

#### `labels.numberFormat`

Type: `{ format; decimals?; currency?; locale?; prefix?; suffix?; useGrouping? }`

Required: `no`

Description: Shared formatting for labels, legend values, and inline tooltip
values.

Example: `{ format: "compact", decimals: 1, locale: "de-DE" }`

Behavior: Value content defaults to number formatting; percent content defaults
to percent formatting.

#### `labels.numberFormat.format`

Type: `"number" | "compact" | "percent" | "currency"`

Required: `yes when numberFormat is present`

Description: Selects `Intl.NumberFormat` style.

Example: `"percent"`

#### `labels.numberFormat.decimals`

Type: `number`

Required: `no`

Description: Fixed fraction digit count.

Example: `1`

#### `labels.numberFormat.currency`

Type: `string`

Required: `when format is "currency"`

Description: ISO 4217 currency code.

Example: `"EUR"`

#### `labels.numberFormat.locale`

Type: `string`

Required: `no`

Description: BCP 47 locale. Defaults to `en`.

Example: `"de-DE"`

#### `labels.numberFormat.prefix`

Type: `string`

Required: `no`

Description: Text prepended after numeric formatting.

Example: `"~"`

#### `labels.numberFormat.suffix`

Type: `string`

Required: `no`

Description: Text appended after numeric formatting.

Example: `" Einheiten"`

#### `labels.numberFormat.useGrouping`

Type: `boolean`

Required: `no`

Description: Enables locale digit grouping. Defaults to `false`.

Example: `true`

### `centerLabel`

Type: `{ show; mode; label?; value?; numberFormat? }`

Required: `no`

Description: Renders a KPI in a centered donut.

Example: `{ show: true, mode: "total", label: "Gesamt" }`

Behavior: Ignored for full pies and non-default `cx` or `cy`.

#### `centerLabel.show`

Type: `boolean`

Required: `yes when centerLabel is present`

Description: Enables the center KPI.

Example: `true`

#### `centerLabel.mode`

Type: `"total" | "selected" | "custom"`

Required: `yes when centerLabel is present`

Description: Chooses the total, selected sum, or custom text.

Example: `"selected"`

Behavior: Selected mode falls back to total when no slice is selected.

#### `centerLabel.label`

Type: `string`

Required: `no`

Description: Caption shown above the KPI.

Example: `"Auswahl"`

#### `centerLabel.value`

Type: `string`

Required: `when mode is "custom"`

Description: Verbatim custom KPI text.

Example: `"Plan"`

#### `centerLabel.numberFormat`

Type: `{ format; decimals?; currency?; locale?; prefix?; suffix? }`

Required: `no`

Description: Formats total and selected numeric modes using the same semantics
as `labels.numberFormat`.

Behavior: Ignored in custom mode.

### `groupOthers`

Type: `{ enabled; mode; value; label?; color? }`

Required: `no`

Description: Rolls small slices into one synthetic slice.

Example: `{ enabled: true, mode: "topN", value: 8, label: "Sonstige" }`

#### `groupOthers.enabled`

Type: `boolean`

Required: `yes when groupOthers is present`

Description: Enables grouping.

Example: `true`

#### `groupOthers.mode`

Type: `"topN" | "threshold"`

Required: `yes when groupOthers is present`

Description: Keeps the largest N slices or slices at/above a share.

Example: `"topN"`

#### `groupOthers.value`

Type: `number`

Required: `yes when groupOthers is present`

Description: Positive integer for `topN`; share from 0 through 1 for
`threshold`.

Example: `8`

#### `groupOthers.label`

Type: `string`

Required: `no`

Description: Synthetic slice name. Defaults to `Sonstige`.

Example: `"Weitere"`

#### `groupOthers.color`

Type: `string`

Required: `no`

Description: Synthetic slice fill overriding all other color sources.

Example: `"#94a3b8"`

### `sort`

Type: `{ by: "value" | "name" | "none"; direction: "asc" | "desc" }`

Required: `no`

Description: Sorts rendered slices after grouping.

Example: `{ by: "value", direction: "desc" }`

Behavior: Omission or `none` preserves SQL order and appends a synthetic slice.

### `maxSlices`

Type: `number`

Required: `no`

Description: Maximum rendered slice count.

Example: `18`

Behavior: Defaults to `24`. Exceeding it renders a guard message.

### `selectionStyle`

Type: `{ fadeOthersOpacity: number; stroke?: string; strokeWidth?: number }`

Required: `no`

Description: Controls selection emphasis.

Example: `{ fadeOthersOpacity: 0.3, stroke: "var(--foreground)", strokeWidth: 2 }`

#### `selectionStyle.fadeOthersOpacity`

Type: `number`

Required: `yes when selectionStyle is present`

Description: Opacity for unselected slices while selection is active.

Example: `0.3`

Allowed values: `0` through `1`

Behavior: Defaults to `0.35` when `selectionStyle` is omitted.

#### `selectionStyle.stroke`

Type: `string`

Required: `no`

Description: Selected-slice outline. Defaults to `var(--foreground)`.

Example: `"#111827"`

#### `selectionStyle.strokeWidth`

Type: `number`

Required: `no`

Description: Selected-slice outline width. Defaults to `2`.

Example: `2`

---

## 6. Configuration Rules

- `labels.minPercent`, threshold grouping values, and
  `selectionStyle.fadeOthersOpacity` must be from 0 through 1.
- `groupOthers.value` must be a positive integer in `topN` mode.
- `maxSlices` and `labels.maxLabelChars` must be positive integers.
- Currency formatting requires a valid ISO 4217 `currency` value.
- Percent label content must use percent formatting when an explicit format is
  supplied. Ratios are passed directly to `Intl.NumberFormat`; do not multiply
  them by 100.
- `centerLabel.value` is required in custom mode; custom mode ignores numeric
  formatting.
- Center content requires a positive `innerRadius` and default `cx` and `cy`.
- Avoid a `groupOthers.label` that duplicates a source name. Internal selection
  remains correct, but the legend entries are indistinguishable.

---

## 7. Complete Configuration Example

```ts
const chartConfig: PieChartConfig = {
  pie: {
    innerRadius: "58%",
    outerRadius: "82%",
    paddingAngle: 2,
    cornerRadius: 3,
  },
  margin: { top: 16, right: 24, bottom: 16, left: 24 },
  tooltip: { show: true, cursor: false },
  legend: {
    show: true,
    position: "bottom",
    content: "name-percent",
  },
  colors: {
    palette: ["#2563eb", "#f59e0b", "#16a34a", "#dc2626"],
    stroke: "var(--background)",
    strokeWidth: 1,
  },
  labels: {
    show: true,
    position: "outside",
    content: "name-percent",
    leaderLines: true,
    minPercent: 0.03,
    maxLabelChars: 18,
    numberFormat: {
      format: "percent",
      decimals: 1,
      locale: "de-DE",
    },
  },
  centerLabel: {
    show: true,
    mode: "selected",
    label: "Auswahl",
    numberFormat: {
      format: "number",
      decimals: 0,
      locale: "de-DE",
    },
  },
  groupOthers: {
    enabled: true,
    mode: "topN",
    value: 8,
    label: "Sonstige",
    color: "#94a3b8",
  },
  sort: { by: "value", direction: "desc" },
  maxSlices: 12,
  selectionStyle: {
    fadeOthersOpacity: 0.3,
    stroke: "var(--foreground)",
    strokeWidth: 2,
  },
};
```

---

## 8. Data and Configuration Relationship

Slices are data-driven and are not declared individually in configuration.
Each API row produces one slice after zero removal and optional grouping.

`colors.byName` is the only config field that references data by name:

```text
API row:            { "name": "Nord", "value": 42 }
colors.byName.Nord: "#2563eb"
rendered fill:      #2563eb
```

Unknown or stale keys fall back to the configured or default palette without
an error. Duplicate data names make overrides and legend entries ambiguous.

Tooltip SQL receives selected source fields as arrays: `name` is
`ARRAY<STRING>` and `value` is `ARRAY<DOUBLE>`. The synthetic grouped slice is
never sent to tooltip SQL.

---

## 9. Usage

### Import

```ts
import PieChartModule from "@/modules/PieChartModule";
```

### Minimal Example

```tsx
<PieChartModule
  chartID="salesShare"
  chartDescription="Umsatzanteil nach Region"
  chartConfig={chartConfig}
  chartData={[{ name: "Nord", value: 42 }]}
  height={36}
  isLoading={false}
  isFetching={false}
  isError={false}
  error={null}
  selfFetching={false}
  filterParams={{}}
  selectedRows={[]}
  lasso={lassoController}
/>
```

### Complete Example

Normal dashboard usage does not instantiate the module manually. Set
`moduleName` to `PieChartModule`, provide a complete `chartConfig`, and return
`name`/`value` rows from `pagesConfig/sql/<chartID>.sql`. `ChartWrapper` resolves
the registry entry and injects runtime props.

---

## 10. Expected Props

### `chartConfig`

Type: `PieChartConfig`

Description: Complete geometry, label, legend, formatting, and selection
configuration.

Source: `configuration`

### `chartData`

Type: `PieChartData[]`

Description: Schema-validated source rows.

Source: `API data`

### `selectedRows`

Type: `readonly PieChartData[]`

Description: Current wrapper-owned source selection.

Source: `wrapper`

### `onSelectionChange`

Type: `(rows: PieChartData[], options?: { additive?: boolean }) => void`

Description: Reports click selection and additive modifier state.

Source: `wrapper`

### `height`

Type: `number`

Description: Chart height in `svh` units.

Source: `configuration`

### `chartID`

Type: `TableSchemaKey`

Description: Identifies tooltip SQL and wrapper state.

Source: `configuration`

### `enhancedTooltip`

Type: `boolean | undefined`

Description: Enables wrapper-owned static tooltip loading on source-slice
click. The visible tooltip and connection context menu belong to
`ChartWrapper`.

Source: `configuration`

### `lasso`

Type: `LassoController<PieChartData>`

Description: Intentionally unused. The module does not register an adapter, so
the wrapper does not expose lasso controls for this chart.

Source: `wrapper`

Loading, fetching, raw empty responses, and errors are rendered by
`ChartWrapper`; the module is not mounted for those normal wrapper states.

---

## 11. Runtime Behavior

1. Remove zero-valued rows while preserving source object identity.
2. Apply `groupOthers` and append one tagged synthetic slice when rows were
   absorbed.
3. Sort after grouping. `none` preserves source order.
4. Check the rendered count against `maxSlices`.
5. Sum rendered values for percentage and center calculations.

Recharts invokes slice clicks with `(sector, index, event)`. Recharts' sector
payload is derived, so the module resolves the tagged render slice by `index`
and sends only its original source row to `onSelectionChange` and tooltip SQL.
The synthetic slice has a distinct internal kind and is not clickable, even
when a real source row has the same visible name.

Ctrl, Meta, and Shift clicks request additive selection. Selected source slices
receive the configured outline; all other slices fade. Data and relevant config
changes cause `ChartWrapper` to invalidate selection.

The donut center follows Recharts' measured plot area, including margin and
legend offsets. Selected mode shows the selected sum and falls back to total.

For containers narrower than 480px, left/right legends move below the plot and
outside labels are suppressed. The legend remains the category key.

---

## 12. Validation and Errors

### Negative or non-finite value

Cause: `value` is negative, infinite, or not numeric.

Example: `{ "name": "Delta", "value": -3 }`

How to fix: Use a non-negative aggregate or choose `BarChartModule`.

### Empty response

Cause: SQL returns no rows.

Example: `[]`

How to fix: Review filters or source data. `ChartWrapper` renders its empty
state.

### All values are zero

Cause: Every validated row is removed before rendering.

Example: `[{ "name": "Nord", "value": 0 }]`

How to fix: Return positive values or use `BarChartModule` when zeros matter.
The module renders `Keine darstellbaren Werte`.

### Slice limit exceeded

Cause: The post-grouping slice count exceeds `maxSlices`.

Example: 30 slices with `maxSlices: 24`.

How to fix: Configure `groupOthers`, tighten its threshold, or use a bar/table
view.

### Unsupported center label

Cause: Center content is enabled for a full pie or an off-center donut.

Example: `centerLabel.show: true` with `innerRadius: "0%"`.

How to fix: Use a positive inner radius and default `cx`/`cy`. The chart remains
visible while the center label is silently skipped.

---

## 13. Agent Instructions

1. Read this file before creating or changing a pie configuration.
2. Read `chartType.d.ts` before generating configuration.
3. Read `chartDataSchema.ts` before writing SQL.
4. Keep page-specific requirements in JSON and SQL.
5. Do not invent configuration fields.
6. Return only unique, pre-aggregated `name`/`value` rows.
7. Keep values finite and non-negative.
8. Use `groupOthers` and `maxSlices` intentionally for wide data.
9. Keep enhanced tooltip, connections, and context menus in `ChartWrapper`.
10. Parse tooltip `name` and `value` as arrays in tooltip SQL.
11. Do not make the synthetic slice selectable.
12. Use another module when the requested visualization exceeds these limits.

---

## 14. Agent Workflow

1. Confirm that part-to-whole comparison is appropriate.
2. Read this file, `chartType.d.ts`, and `chartDataSchema.ts`.
3. Aggregate source rows to unique names in SQL.
4. Choose pie or donut geometry.
5. Configure grouping, labels, legend, and slice guard.
6. Add tooltip SQL only when enhanced details or connections are required.
7. Verify every config key against `PieChartConfig`.
8. Verify SQL output against `PieChartData`.
9. Generate the dashboard page and run repository validation.

---

## 15. Do Not

Do not:

- Send negative, null, or precomputed percentage fields.
- Expect duplicate names to be merged or rejected.
- Select or connect from the synthetic grouped slice.
- Add lasso, zoom, nested rings, gauges, or radial selection offsets through
  page configuration.
- Modify the module for a page-specific palette or label preference.
- Put enhanced tooltip or connection behavior inside the module.

---

## 16. Known Limitations

- No lasso selection or zoom.
- No nested rings, sunburst, semi-circle, or gauge layout.
- Outside-label collision is not resolved automatically; use `groupOthers` and
  `labels.minPercent`.
- The synthetic grouped slice is not selectable.
- Selected slices use stroke and opacity, not radial offset.
- Duplicate names silently produce ambiguous colors and legend entries.
- Center content supports only a centered donut.
- Zero-valued categories are omitted.

---

## 17. Notes

The default grouped-slice label is German (`Sonstige`). Set
`groupOthers.label` explicitly when the dashboard uses another language.