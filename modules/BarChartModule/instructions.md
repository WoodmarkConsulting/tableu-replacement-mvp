# `BarChartModule` Instructions

## 1. Purpose

`BarChartModule` renders a configurable multi-series categorical bar chart based on compact
API data.

Use this module when you need to compare one or more numeric measures across a set of
discrete categories, with grouped, stacked, 100% stacked, or overlaid series.

Do not use this module when your X values are continuous numbers or timestamps (use
`LineChartModule`), when you are showing the distribution of a single numeric variable via
bins (use `HistogramModule`), or when the data is geographic (use `MapModule`).

---

## 2. Module Files

The module consists of the following required files:

```text
modules/BarChartModule/
├── index.tsx
├── chartDataSchema.ts
├── chartType.d.ts
└── instructions.md
```

### `index.tsx`

Contains the module implementation.

The file has a default export and the default-exported component uses
`ChartWrapperInjectedProps<BarChartData>` as its props type.

### `chartDataSchema.ts`

Defines and validates the data format expected from the API.

The file default-exports the module Zod schema and exports the `BarChartData` type.

### `chartType.d.ts`

Contains the configuration type for this module.

The file contains exactly one type declaration: `BarChartConfig`.

### `instructions.md`

Contains the usage instructions for this module.

It must follow `docs/instructions.template.md`.

---

## 3. Data Contract

### Data Type

```ts
type BarChartData = {
  category: string;
  values: Array<number | null>;
  target?: number | null;
};
```

### Data Structure

#### `category`

Type:

```ts
string;
```

Description:

Discrete label rendered on the category axis.

Rules:

- Must be present.
- Must be unique across the API response.

#### `values`

Type:

```ts
Array<number | null>;
```

Description:

Ordered series values for the category.

Rules:

- Must be an array.
- Every entry must be either a finite number or `null`.
- Array indexes have a fixed meaning and are referenced through `series[].seriesIndex`.
- `null` renders as a gap (no bar) for that series and category.

#### `target`

Type:

```ts
number | null | undefined;
```

Description:

Optional per-category target value used to render target markers.

Rules:

- Only used when `targetBars.enabled` is `true`.
- Must be a finite number or `null` when present.

### Example API Response

```json
[
  { "category": "North", "values": [120, 80], "target": 130 },
  { "category": "South", "values": [90, 140], "target": 130 },
  { "category": "East", "values": [60, 110], "target": 130 },
  { "category": "West", "values": [150, 70], "target": 130 }
]
```

### Data Rules

- `category` must always be present and unique.
- `values` must always be present.
- `values` may contain `null` values.
- Array indexes in `values` have a fixed meaning and are referenced through
  `series[].seriesIndex`.
- For every configured series, each row must contain a value at the required
  `values[seriesIndex]` position.
- Row order in the response is the default draw order unless `sort` is configured.
- For the `stacked100` layout, each category's non-null values are normalized to sum to 100%.

---

## 4. Configuration

The module is controlled through its configuration object.

The complete configuration type is defined in:

```text
chartType.d.ts
```

### Configuration Type

```ts
type BarChartConfig = {
  orientation: "vertical" | "horizontal";
  layout: "grouped" | "stacked" | "stacked100" | "overlay";
  categoryAxis: {
    show: boolean;
    tickLine: boolean;
    axisLine: boolean;
    tickMargin: number;
    angle?: number;
    maxLabelChars?: number;
  };
  valueAxis: {
    show: boolean;
    tickLine: boolean;
    axisLine: boolean;
    format: "number" | "compact" | "percent";
    domain?: [number, number] | "auto";
  };
  grid: {
    show: boolean;
    horizontal: boolean;
    vertical: boolean;
    strokeDasharray?: string;
  };
  tooltip: {
    show: boolean;
    cursor: boolean;
  };
  legend: {
    show: boolean;
  };
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  bars: {
    radius: number;
    categoryGap: string | number;
    barGap: string | number;
  };
  valueLabels: {
    show: boolean;
    format: "number" | "compact" | "percent";
    position: "inside" | "outside" | "auto";
  };
  colorByCategory?: {
    enabled: boolean;
    colors: Record<string, string>;
  };
  thresholds?: {
    enabled: boolean;
    seriesIndex?: number;
    rules: {
      min?: number;
      max?: number;
      fill: string;
    }[];
  };
  sort?: {
    by: "category" | "value";
    direction: "asc" | "desc";
    seriesIndex?: number;
  };
  series: {
    seriesIndex: number;
    name: string;
    fill: string;
    fillOpacity: number;
    stroke?: string;
    strokeWidth?: number;
    stackId?: string;
  }[];
  referenceLines?: {
    label: string;
    value: number;
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
  }[];
  targetBars?: {
    enabled: boolean;
    style: "line" | "bar";
    fill: string;
    size: number;
  };
  selectionStyle?: {
    stroke: string;
    strokeWidth: number;
    fadeOthersOpacity: number;
  };
};
```

---

## 5. Configuration Reference

### `orientation`

Type:

```ts
"vertical" | "horizontal";
```

Required:

`yes`

Description:

Controls bar direction. `vertical` puts categories on the X axis and values on the Y axis.
`horizontal` puts categories on the Y axis and values on the X axis.

Behavior:

- `horizontal` is recommended for long category labels or many categories.

### `layout`

Type:

```ts
"grouped" | "stacked" | "stacked100" | "overlay";
```

Required:

`yes`

Description:

Controls how multiple series are arranged within each category.

Behavior:

- `grouped`: bars sit side by side.
- `stacked`: bars stack; series share a `stackId`.
- `stacked100`: bars stack and each category is normalized to 100%; the value axis is forced
  to percent formatting with a `[0, 100]` domain.
- `overlay`: bars share the same slot and overlap using each series `fillOpacity`.

### `categoryAxis`

Type:

```ts
{
  show: boolean;
  tickLine: boolean;
  axisLine: boolean;
  tickMargin: number;
  angle?: number;
  maxLabelChars?: number;
}
```

Required:

`yes`

Description:

Controls visibility and formatting of the discrete category axis.

Behavior:

- Rendered as the X axis when `orientation` is `vertical`, otherwise the Y axis.
- `angle` rotates tick labels; when set, labels are right-anchored.
- `maxLabelChars` truncates long labels with an ellipsis.
- All category ticks are always shown (`interval={0}`).

### `valueAxis`

Type:

```ts
{
  show: boolean;
  tickLine: boolean;
  axisLine: boolean;
  format: "number" | "compact" | "percent";
  domain?: [number, number] | "auto";
}
```

Required:

`yes`

Description:

Controls visibility and formatting of the measure axis.

Behavior:

- Rendered as the Y axis when `orientation` is `vertical`, otherwise the X axis.
- `compact` uses `Intl.NumberFormat` compact notation.
- `percent` appends `%` without scaling.
- `domain` pins the value range; `"auto"` or omission lets recharts scale automatically.
- The `stacked100` layout overrides `format` to percent and `domain` to `[0, 100]`.

### `grid`

Type:

```ts
{
  show: boolean;
  horizontal: boolean;
  vertical: boolean;
  strokeDasharray?: string;
}
```

Required:

`yes`

Description:

Controls the background grid. Renders only when `grid.show` is `true`.

### `tooltip`

Type:

```ts
{
  show: boolean;
  cursor: boolean;
}
```

Required:

`yes`

Description:

Controls the inline recharts tooltip. This is separate from the wrapper-owned enhanced
tooltip backed by tooltip SQL. While an enhanced tooltip is present, the inline tooltip is
suppressed.

### `legend`

Type:

```ts
{
  show: boolean;
}
```

Required:

`yes`

Description:

Controls whether the legend is rendered.

### `margin`

Type:

```ts
{
  top: number;
  right: number;
  bottom: number;
  left: number;
}
```

Required:

`yes`

Description:

Space around the chart content in pixels.

### `bars`

Type:

```ts
{
  radius: number;
  categoryGap: string | number;
  barGap: string | number;
}
```

Required:

`yes`

Description:

Bar geometry.

Behavior:

- `radius` applies corner radius to each bar.
- `categoryGap` maps to recharts `barCategoryGap` (gap between categories).
- `barGap` sets the gap between bars within a category for the `grouped` layout.
- The `overlay` layout overrides `barGap` internally to force bars to overlap.

### `valueLabels`

Type:

```ts
{
  show: boolean;
  format: "number" | "compact" | "percent";
  position: "inside" | "outside" | "auto";
}
```

Required:

`yes`

Description:

Numeric labels drawn on or near each bar. Off by default (`show: false`).

Behavior:

- `inside` centers the label inside the bar.
- `outside` and `auto` place the label at the top (vertical) or right (horizontal) of the bar.

### `colorByCategory`

Type:

```ts
{
  enabled: boolean;
  colors: Record<string, string>;
}
```

Required:

`no`

Description:

Single-series only. Colors each bar by its category. Ignored when more than one series is
configured. Categories without a mapping fall back to the series fill.

### `thresholds`

Type:

```ts
{
  enabled: boolean;
  seriesIndex?: number;
  rules: { min?: number; max?: number; fill: string }[];
}
```

Required:

`no`

Description:

Conditional bar coloring by value threshold. The first rule where `value >= min` and
`value < max` wins; otherwise the bar falls back to the series fill. `seriesIndex` restricts
the rules to one series; omit to apply to all.

### `sort`

Type:

```ts
{
  by: "category" | "value";
  direction: "asc" | "desc";
  seriesIndex?: number;
}
```

Required:

`no`

Description:

Reorders bars. Omit to keep the API row order. When `by` is `value`, `seriesIndex` selects
the series to sort by (defaults to `0`).

### `series`

Type:

```ts
{
  seriesIndex: number;
  name: string;
  fill: string;
  fillOpacity: number;
  stroke?: string;
  strokeWidth?: number;
  stackId?: string;
}[]
```

Required:

`yes`

Description:

One entry per series. `seriesIndex` selects `values[seriesIndex]`. `name` is used for the
legend and tooltip. `stackId` groups bars into a stack for the `stacked` and `stacked100`
layouts.

### `referenceLines`

Type:

```ts
{
  label: string;
  value: number;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}[]
```

Required:

`no`

Description:

Target or threshold lines drawn across the value axis at the given `value`.

### `targetBars`

Type:

```ts
{
  enabled: boolean;
  style: "line" | "bar";
  fill: string;
  size: number;
}
```

Required:

`no`

Description:

Per-category target markers (bullet-chart style) that read the `target` field from each row.
`line` draws a thin marker line at the target value; `bar` draws a thin filled marker.
`size` is the marker thickness in pixels.

### `selectionStyle`

Type:

```ts
{
  stroke: string;
  strokeWidth: number;
  fadeOthersOpacity: number;
}
```

Required:

`no`

Description:

Highlight style for selected bars. Selected bars get `stroke` and `strokeWidth`;
non-selected bars are dimmed to `fadeOthersOpacity` while a selection is active. Defaults are
an amber stroke, `2px` width, and `0.35` fade opacity.

---

## 6. Selection and Interaction

- Clicking a bar calls the injected `onSelectionChange` with the clicked category row.
  Holding Ctrl, Cmd, or Shift toggles the row additively.
- The module registers a lasso adapter that returns rows whose bars intersect the lasso
  shape (rectangle or polygon). Lasso zoom is not registered because the category axis is
  discrete.
- Selected rows are injected back as read-only `selectedRows` and rendered with
  `selectionStyle`.
- With `enhancedTooltip: true`, clicking a bar opens the wrapper-owned static tooltip for the
  selected row. All selected rows are batched into a single tooltip request; every data-point
  property reaches tooltip SQL as a JSON array parameter.
