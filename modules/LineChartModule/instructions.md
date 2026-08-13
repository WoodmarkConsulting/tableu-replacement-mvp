# LineChartModule

## Purpose

`LineChartModule` is the project's current example dashboard module. It renders a multi-series line chart inside a card layout and demonstrates the module contract expected by the dashboard generator and `TapsWrapper`.

## File location

- Implementation: `modules/LineChartModule/index.tsx`
- Consumed by generated pages through: `@/modules/LineChartModule`

## What it renders

- A card with title, description, chart area, and footer text
- A Recharts `LineChart` with two data series: `desktop` and `mobile`
- Shared chart tooling from `components/ui/chart`

## Props and contract

The exported component is:

```tsx
export function LineChartModule({ height = 25 }: Props);
```

Relevant usage details:

- It is compatible with `BaseChartProps`.
- `height` controls the chart container height in `svh`.
- The module can be used multiple times in the same row or tab.
- The current dashboard generator only passes `height`, not custom data props.

## How to use it in a dashboard config

Reference it by export name inside a dashboard JSON file:

```json
{
  "trigger": "Overview",
  "rows": [
    {
      "height": 25,
      "components": [
        {
          "module": "LineChartModule",
          "space": 6
        }
      ]
    }
  ]
}
```

When `npm run generatePage` runs, the generator converts the string `LineChartModule` into a real component import and writes it into the generated page.

## Dependencies

- `recharts` for chart primitives
- `lucide-react` for the footer icon
- Shared UI helpers from `components/ui/card` and `components/ui/chart`

## Current behavior and limitations

- Data is hard-coded in the module.
- Labels and footer text are static.
- The component is marked with `"use client"`, so it runs on the client.
- The chart is currently intended as a scaffold/example module rather than a configurable production widget.

## When to edit this module

Edit `LineChartModule` when you need to change chart visuals, demo data, legends, labels, or card content.

Do not edit this module if you only need to change dashboard layout, tab order, row height, or placement. Those concerns belong in `pagesConfig/*.json`.
