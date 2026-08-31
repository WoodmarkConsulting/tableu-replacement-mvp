# `LineChartModule` Instructions

## 1. Purpose

`LineChartModule` renders a configurable multi-series line or area chart based on compact numeric API data.

Use this module when you need to visualize one or more related numeric series over a numeric or timestamp-based X axis.

Do not use this module when your X values are categorical strings, when each series requires a different data shape, or when you need chart behavior that cannot be expressed through the existing `LineChartConfig`.

---

## 2. Module Files

The module consists of the following required files:

```text
modules/LineChartModule/
├── index.tsx
├── chartDataSchema.ts
├── chartType.d.ts
└── instructions.md
```

### `index.tsx`

Contains the module implementation.

The file has a default export and the default-exported component uses `ChartWrapperInjectedProps<LineChartData>` as its props type.

### `chartDataSchema.ts`

Defines and validates the data format expected from the API.

The file default-exports the module Zod schema and exports the `LineChartData` type.

### `chartType.d.ts`

Contains the configuration type for this module.

The file contains exactly one type declaration: `LineChartConfig`.

### `instructions.md`

Contains the usage instructions for this module.

It must follow `docs/instructions.template.md`.

---

## 3. Data Contract

Describe the exact data format expected by this module.

### Data Type

```ts
type LineChartData = {
  x: number;
  y: Array<number | null>;
};
```

### Data Structure

Describe every field.

#### `x`

Type:

```ts
number;
```

Description:

Numeric X-axis value for the data point.

Rules:

- Must be a finite number.
- When `xAxis.format` uses a date mode, `x` must be a Unix timestamp in milliseconds.

#### `y`

Type:

```ts
Array<number | null>;
```

Description:

Ordered series values for the data point.

Rules:

- Must be an array.
- Every entry must be either a finite number or `null`.

### Example API Response

```json
[
  {
    "x": 1782864000000,
    "y": [12, 9]
  },
  {
    "x": 1782950400000,
    "y": [15, null]
  }
]
```

### Data Rules

Document all rules that the API response must follow.

- `x` must always be present.
- `y` must always be present.
- `y` may contain `null` values.
- Array indexes in `y` have a fixed meaning and are referenced through `lines[].seriesIndex`.
- Dates must use Unix timestamps in milliseconds when a date-based X-axis format is configured.
- For every configured line, each data point must contain a value at the required `y[seriesIndex]` position.

---

## 4. Configuration

The module is controlled through its configuration object.

The complete configuration type is defined in:

```text
chartType.d.ts
```

### Configuration Type

```ts
type LineChartConfig = {
  xAxis: {
    show: boolean;
    tickLine: boolean;
    axisLine: boolean;
    tickMargin: number;
    format: "number" | "date-month-day" | "date-day-month";
  };
  yAxis: {
    show: boolean;
    tickLine: boolean;
    axisLine: boolean;
    format: "number" | "compact" | "percent";
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
  lines: {
    seriesIndex: number;
    name: string;
    curve: "linear" | "monotone" | "step" | "stepBefore" | "stepAfter";
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
    connectNulls: boolean;
    dots: {
      show: boolean;
      radius: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
    };
    activeDot: {
      show: boolean;
      radius: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
    };
    fill: {
      enabled: boolean;
      color: string;
      opacity: number;
    };
  }[];
};
```

---

## 5. Configuration Reference

Document every configurable property.

The structure in this section follows the actual configuration object hierarchy.

### `xAxis`

Type:

```ts
{
  show: boolean;
  tickLine: boolean;
  axisLine: boolean;
  tickMargin: number;
  format: "number" | "date-month-day" | "date-day-month";
}
```

Required:

`yes`

Description:

Controls visibility and formatting of the X axis.

Example:

```ts
{
  show: true,
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  format: "date-day-month",
}
```

Allowed values:

```text
format: number | date-month-day | date-day-month
```

Behavior:

- `format` changes how the numeric `x` value is rendered.
- Date formats expect Unix timestamps in milliseconds.

### `yAxis`

Type:

```ts
{
  show: boolean;
  tickLine: boolean;
  axisLine: boolean;
  format: "number" | "compact" | "percent";
}
```

Required:

`yes`

Description:

Controls visibility and formatting of the Y axis.

Example:

```ts
{
  show: true,
  tickLine: false,
  axisLine: false,
  format: "compact",
}
```

Allowed values:

```text
format: number | compact | percent
```

Behavior:

- `compact` uses `Intl.NumberFormat` compact notation.
- `percent` appends `%` without scaling the value.

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

Controls the background grid.

Example:

```ts
{
  show: true,
  horizontal: true,
  vertical: false,
  strokeDasharray: "3 3",
}
```

Allowed values:

```text
strokeDasharray: any valid SVG dash pattern string
```

Behavior:

- The grid renders only when `grid.show` is `true`.
- Horizontal and vertical grid lines can be controlled independently.

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

Controls whether the shared chart tooltip is rendered and whether the hover cursor is shown.

Example:

```ts
{
  show: true,
  cursor: true,
}
```

Allowed values:

```text
show: true | false
cursor: true | false
```

Behavior:

- If `show` is `false`, no tooltip component is rendered.
- `cursor` is passed through to `ChartTooltip`.

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

Controls whether the chart legend is shown.

Example:

```ts
{
  show: true,
}
```

Allowed values:

```text
show: true | false
```

Behavior:

- When `show` is `true`, Recharts `Legend` is rendered.
- Legend labels come from `lines[].name`.

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

Controls outer chart spacing in pixels.

Example:

```ts
{
  top: 16,
  right: 16,
  bottom: 8,
  left: 8,
}
```

Allowed values:

```text
Any numeric pixel values
```

Behavior:

- Values are passed directly to `ComposedChart`.
- Large margins reduce available drawing area.

### `lines`

Type:

```ts
Array<{
  seriesIndex: number;
  name: string;
  curve: "linear" | "monotone" | "step" | "stepBefore" | "stepAfter";
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  connectNulls: boolean;
  dots: {
    show: boolean;
    radius: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
  };
  activeDot: {
    show: boolean;
    radius: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
  };
  fill: {
    enabled: boolean;
    color: string;
    opacity: number;
  };
}>;
```

Required:

`yes`

Description:

Defines the rendered series and how each series is mapped and styled.

Example:

```ts
[
  {
    seriesIndex: 0,
    name: "Revenue",
    curve: "monotone",
    stroke: "var(--chart-1)",
    strokeWidth: 2,
    connectNulls: false,
    dots: {
      show: true,
      radius: 3,
      fill: "var(--chart-1)",
      stroke: "white",
      strokeWidth: 1,
    },
    activeDot: {
      show: true,
      radius: 4,
      fill: "var(--chart-1)",
      stroke: "white",
      strokeWidth: 1,
    },
    fill: {
      enabled: false,
      color: "var(--chart-1)",
      opacity: 0.2,
    },
  },
];
```

Allowed values:

```text
curve: linear | monotone | step | stepBefore | stepAfter
seriesIndex: 0 or greater
opacity: intended range 0 to 1
```

Behavior:

- Each line maps to one position in the `y` array.
- When `fill.enabled` is `true`, the module renders an `Area`; otherwise it renders a `Line`.

---

## 6. Configuration Rules

Document relationships and restrictions that cannot be understood from the TypeScript type alone.

- `seriesIndex` is zero-based.
- `seriesIndex` must be `0` or greater.
- Every configured series must have a corresponding value in the API response for every data point.
- `fill.opacity` should be between `0` and `1`.
- `xAxis.format` controls the expected meaning of `x` values.
- `yAxis.format: "percent"` only changes label formatting; it does not multiply values by `100`.

---

## 7. Complete Configuration Example

Provide at least one complete and valid configuration.

```ts
const chartConfig: LineChartConfig = {
  xAxis: {
    show: true,
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    format: "date-day-month",
  },
  yAxis: {
    show: true,
    tickLine: false,
    axisLine: false,
    format: "compact",
  },
  grid: {
    show: true,
    horizontal: true,
    vertical: false,
    strokeDasharray: "3 3",
  },
  tooltip: {
    show: true,
    cursor: true,
  },
  legend: {
    show: true,
  },
  margin: {
    top: 16,
    right: 16,
    bottom: 8,
    left: 8,
  },
  lines: [
    {
      seriesIndex: 0,
      name: "Revenue",
      curve: "monotone",
      stroke: "var(--chart-1)",
      strokeWidth: 2,
      connectNulls: false,
      dots: {
        show: true,
        radius: 3,
        fill: "var(--chart-1)",
        stroke: "white",
        strokeWidth: 1,
      },
      activeDot: {
        show: true,
        radius: 4,
        fill: "var(--chart-1)",
        stroke: "white",
        strokeWidth: 1,
      },
      fill: {
        enabled: false,
        color: "var(--chart-1)",
        opacity: 0.2,
      },
    },
    {
      seriesIndex: 1,
      name: "Forecast",
      curve: "monotone",
      stroke: "var(--chart-2)",
      strokeWidth: 2,
      strokeDasharray: "5 5",
      connectNulls: true,
      dots: {
        show: false,
        radius: 3,
        fill: "var(--chart-2)",
        stroke: "white",
        strokeWidth: 1,
      },
      activeDot: {
        show: true,
        radius: 4,
        fill: "var(--chart-2)",
        stroke: "white",
        strokeWidth: 1,
      },
      fill: {
        enabled: true,
        color: "var(--chart-2)",
        opacity: 0.15,
      },
    },
  ],
};
```

---

## 8. Data and Configuration Relationship

Explain how the configuration maps to the API data.

```text
API response:

{
  "x": 1782864000000,
  "y": [12, 9]
}

Configuration:

lines[0].seriesIndex: 0 -> y[0] -> 12
lines[1].seriesIndex: 1 -> y[1] -> 9
xAxis.format: "date-day-month" -> x is interpreted as a Unix timestamp in milliseconds
```

The module converts each configured `seriesIndex` into an internal Recharts key named `series_<index>`.

---

## 9. Usage

Describe how this module is used by the application.

### Import

```ts
import LineChartModule from "@/modules/LineChartModule";
```

### Minimal Example

```tsx
<LineChartModule
  chartTitle="Revenue"
  chartDescription="Daily revenue"
  chartID="revenue-daily"
  chartConfig={chartConfig}
  chartData={[
    { x: 1782864000000, y: [12] },
    { x: 1782950400000, y: [15] },
  ]}
  isLoading={false}
  isFetching={false}
  isError={false}
  error={null}
  height={25}
/>
```

### Complete Example

```tsx
<LineChartModule
  chartTitle="Revenue vs Forecast"
  chartDescription="Daily comparison of actuals and forecast"
  chartID="revenue-vs-forecast"
  chartConfig={chartConfig}
  chartData={[
    { x: 1782864000000, y: [12, 9] },
    { x: 1782950400000, y: [15, 10] },
    { x: 1783036800000, y: [11, null] },
  ]}
  isLoading={false}
  isFetching={false}
  isError={false}
  error={null}
  height={30}
/>
```

---

## 10. Expected Props

Document the props that are relevant when this module is instantiated.

### `chartTitle`

Type:

```ts
string | undefined;
```

Description:

Optional chart title passed through the wrapper prop contract.

Source:

`application`

### `chartDescription`

Type:

```ts
string;
```

Description:

Human-readable chart description.

Source:

`application`

### `chartID`

Type:

```ts
string;
```

Description:

Unique chart identifier.

Source:

`application`

### `selectionMode`

Type:

```ts
"single" | "multi" | undefined;
```

Description:

Present only when this chart is configured as a drill source (`drill` in the dashboard config). Indicates whether one or many points may be selected.

Source:

`application`

### `onSelectionChange`

Type:

```ts
((rows: LineChartData[]) => void) | undefined;
```

Description:

Present only for drill/cross-filter sources. Call it with the clicked data point(s); the framework maps the configured `selectionBindings` to the bound filter dimensions and applies them (cross-filtering in place, or navigating to `drill.targetTab` when set).

Source:

`application`

### `chartConfig`

Type:

```ts
LineChartConfig;
```

Description:

Defines axes, formatting, grid, legend, tooltip, margins, and series rendering.

Source:

`configuration`

### `chartData`

Type:

```ts
LineChartData[]
```

Description:

Chart data array consumed by the module.

Source:

`API data`

### `isLoading`

Type:

```ts
boolean;
```

Description:

Loading state supplied by the wrapper contract.

Source:

`wrapper`

### `isFetching`

Type:

```ts
boolean;
```

Description:

Fetching state supplied by the wrapper contract.

Source:

`wrapper`

### `isError`

Type:

```ts
boolean;
```

Description:

Error flag supplied by the wrapper contract.

Source:

`wrapper`

### `error`

Type:

```ts
Error | null;
```

Description:

Runtime error object supplied by the wrapper contract.

Source:

`wrapper`

### `height`

Type:

```ts
number | undefined;
```

Description:

Optional height in `svh` used for the outer chart container.

Source:

`wrapper`

---

## 11. Runtime Behavior

Describe important behavior that happens inside the module.

- The component uses `ChartWrapperInjectedProps<LineChartData>` as its props contract.
- The chart container height is rendered as `${height}svh`.
- The module transforms compact API data into Recharts-compatible objects with keys like `series_0` and `series_1`.
- X-axis values are formatted either as raw numbers or as UTC month/day strings.
- Y-axis values are formatted as plain numbers, compact notation, or percentages.
- `useMemo` is used for derived chart config and transformed chart data.
- A configured series renders as `Area` when `fill.enabled` is `true`; otherwise it renders as `Line`.
- Null values can either break the line or be connected depending on `connectNulls`.

---

## 12. Validation and Errors

Document conditions that cause validation errors or runtime errors.

### `seriesIndex` is negative

Cause:

The module throws when a configured line uses a negative `seriesIndex`.

Example:

```text
lines[0].seriesIndex = -1
```

How to fix:

Use a zero-based array index that exists in the API response.

### Missing Y value for configured series

Cause:

The module throws when a line references `y[seriesIndex]` but the current data point does not contain that index.

Example:

```text
chartData point: { x: 1, y: [10] }
configured line: { seriesIndex: 1, ... }
```

How to fix:

Ensure every data point provides enough `y` entries for all configured series.

### Invalid schema shape

Cause:

Input data that does not satisfy `lineChartDataSchema` is invalid for this module.

Example:

```text
{ x: "2026-01-01", y: [10] }
```

How to fix:

Provide a finite numeric `x` value and a `y` array containing only finite numbers or `null`.

---

## 13. Agent Instructions

When an AI agent uses this module, it must follow these rules.

1. Read this `instructions.md` before creating or changing a configuration for this module.
2. Read `chartType.d.ts` before generating a configuration.
3. Read `chartDataSchema.ts` before generating or modifying API data.
4. Do not modify the module implementation only to satisfy a page-specific requirement.
5. Prefer solving page-specific requirements through the module configuration.
6. Do not invent configuration properties that are not defined by `chartType.d.ts`.
7. Do not invent API fields that are not accepted by `chartDataSchema.ts`.
8. Respect all relationships documented in **Data and Configuration Relationship**.
9. Use only valid values documented in **Configuration Reference**.
10. Generate complete configuration objects unless the surrounding API explicitly supports partial configuration.
11. Do not change `index.tsx`, `chartDataSchema.ts`, or `chartType.d.ts` unless the user explicitly requests a change to the module itself.
12. If the requested visualization cannot be represented by this module's existing configuration, report the limitation instead of silently modifying the module.

---

## 14. Agent Workflow

When using this module to build a page or visualization, follow this order:

1. Determine whether this module is suitable for the requested visualization.
2. Read this `instructions.md`.
3. Read `chartType.d.ts`.
4. Read `chartDataSchema.ts`.
5. Determine the required API data structure.
6. Create the module configuration.
7. Verify that every configuration property exists in `chartType.d.ts`.
8. Verify that the expected API data matches `chartDataSchema.ts`.
9. Verify all configuration-to-data relationships.
10. Integrate the module into the requested page or configuration.
11. Run the repository's relevant validation commands.

---

## 15. Do Not

Do not:

- Add undocumented configuration properties.
- Assume behavior that is not documented here or implemented by the module.
- Change the module implementation for a page-specific styling preference when the configuration already supports it.
- Change the API data format without also changing the schema intentionally.
- Use array indexes without checking their documented meaning.
- Ignore required configuration properties.
- Copy configuration from another module without checking that module's type.
- Modify module files unless the task explicitly requires changing the module itself.

---

## 16. Known Limitations

Document limitations that users and agents should know.

- The X axis only supports numeric values and timestamp-based date formatting.
- The module does not support categorical string X-axis values.
- The module expects all series data to be packed into a single `y` array per data point.
- Percentage formatting only changes labels and does not transform raw values.
- There is no built-in aggregation or sorting.

---

## 17. Notes

The module currently uses Recharts `ComposedChart` so a configuration can mix pure lines and filled series within the same chart.
