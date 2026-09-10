# `TableModule` Instructions

## 1. Purpose

`TableModule` renders a configurable data table driven entirely by config + SQL. It
supports in-cell databars, hide/show and fold/unfold column controls, an expandable
parent/child row hierarchy (from a flat `id`/`parentId` adjacency list), client-side
sorting, filtering (global search + per-column), pagination, a grand-total footer, and
row selection with enhanced tooltip / chart connections.

Use this module when:

- You need detailed, row-level reporting or KPI grids with exact values.
- You want expandable hierarchical rollups (e.g. region → country).
- In-cell databars help scanning magnitude across rows.

Do not use this module when:

- You need a visual trend/shape over a numeric or time axis (use `LineChartModule`).
- You compare measures across discrete categories visually (use `BarChartModule`).
- You need geographic display (use `MapModule`).

---

## 2. Module Files

The module consists of the following required files:

```text
modules/TableModule/
├── index.tsx
├── chartDataSchema.ts
├── chartType.d.ts
└── instructions.md
```

Optional helper files (not part of the module contract):

```text
modules/TableModule/
├── tree.ts        # flat → nested tree, cycle/orphan handling, subtree aggregation
├── format.ts      # de-DE value formatting per column type/format
├── dataBar.ts     # databar domain resolution + bar geometry
└── columns.tsx    # TanStack column-def factory + DataBarCell
```

### `index.tsx`

Contains the module implementation. The file has a default export.

### `chartDataSchema.ts`

Defines and validates the API data format. Default-exports the Zod schema and exports the
`TableRowData` type.

### `chartType.d.ts`

Contains the single `TableChartConfig` configuration type.

### `instructions.md`

This document.

---

## 3. Data Contract

### Data Type

```ts
type TableRowData = {
  id: string;
  parentId: string | null;
  values: Record<string, number | string | boolean | null>;
};
```

### Data Structure

#### `id`

Type:

```ts
string;
```

Description:

Unique, stable identifier for the row. Used as the tree node key and for selection.

Rules:

- Must be unique across all rows.
- Must be a non-empty string.

#### `parentId`

Type:

```ts
string | null;
```

Description:

Adjacency-list parent reference. Top-level rows use `null`.

Rules:

- Must be `null` or reference an existing row's `id`.
- Unknown parents are treated as top-level rows.
- A row must not be its own ancestor (cycles are dropped: the row becomes top-level).

#### `values`

Type:

```ts
Record<string, number | string | boolean | null>;
```

Description:

Cell values keyed by column id (or the column's `valueKey`).

Rules:

- Should cover every `valueKey` referenced by a configured column; missing keys render as
  the configured empty placeholder (not an error).
- Databar columns must contain numeric (or `null`) values; strings render as text with no
  bar.
- `boolean`-typed columns expect `true`/`false`/`null`.
- `date`-typed columns expect a Unix timestamp in milliseconds.
- `percent` columns respect `format.percentScale` (`"fraction"` default multiplies by 100).

### Transport / serialization

SQL emits `values` via `to_json(named_struct(...))`, so the value arrives as a JSON string.
The schema uses `z.preprocess` to accept either a JSON string or an already-decoded object.
The shared data route (`/api/data/chart/[...chartIDs]`) is not modified.

### Example API Response

```json
[
  {
    "id": "eu",
    "parentId": null,
    "values": {
      "region": "Europe",
      "revenue": 1200000,
      "growth": 0.124,
      "active": true
    }
  },
  {
    "id": "eu-de",
    "parentId": "eu",
    "values": {
      "region": "Germany",
      "revenue": 540000,
      "growth": 0.081,
      "active": true
    }
  },
  {
    "id": "eu-fr",
    "parentId": "eu",
    "values": {
      "region": "France",
      "revenue": 410000,
      "growth": -0.023,
      "active": false
    }
  }
]
```

### Data Rules

- `id` must always be present and unique.
- `parentId` may be `null`.
- `values` keys map to configured column `valueKey`s.
- Dates use Unix timestamps in milliseconds.
- All numeric/currency/date formatting uses the fixed `de-DE` locale.
- Row order within a parent is preserved from the API response until the user sorts; SQL
  should `ORDER BY` for a stable default.

---

## 4. Configuration

The complete configuration type is defined in `chartType.d.ts`.

### Configuration Type

```ts
type TableChartConfig = {
  columnGroups?: {
    id: string;
    header: string;
    memberColumnIds: string[];
    summaryColumnId?: string;
    defaultState: "folded" | "unfolded";
  }[];
  columns: {
    id: string;
    valueKey?: string;
    header: string;
    type: "string" | "number" | "percent" | "currency" | "date" | "boolean";
    align?: "left" | "center" | "right";
    format?: {
      minFractionDigits?: number;
      maxFractionDigits?: number;
      currency?: string;
      notation?: "number" | "compact";
      datePattern?: string;
      percentScale?: "fraction" | "value";
    };
    boolean?: {
      display?: "icon" | "text";
      trueLabel?: string;
      falseLabel?: string;
    };
    sortable?: boolean;
    filterable?: boolean;
    wrap?: boolean;
    hidden?: boolean;
    lockVisibility?: boolean;
    width?: number;
    footerAggregate?: "sum" | "avg" | "min" | "max" | "count" | "none";
    dataBar?: {
      enabled: boolean;
      min?: number;
      max?: number;
      includeChildrenInDomain?: boolean;
      positiveColor: string;
      negativeColor?: string;
      showValue: boolean;
      radius?: number;
      heightRatio?: number;
    };
  }[];
  hierarchy: {
    enabled: boolean;
    expandColumnId?: string;
    defaultExpandedDepth: number;
    indentSize: number;
    showParentAggregates?: boolean;
    aggregate?: "sum" | "avg" | "min" | "max" | "count";
  };
  columnMenu: { show: boolean; label?: string };
  sorting: {
    enabled: boolean;
    defaultSort?: { columnId: string; direction: "asc" | "desc" };
  };
  filtering: {
    globalSearch: boolean;
    perColumn: boolean;
    searchPlaceholder?: string;
  };
  footer: { show: boolean; label?: string };
  pagination: { enabled: boolean; pageSize: number };
  appearance: {
    density: "comfortable" | "compact";
    stickyHeader: boolean;
    stickyFirstColumn: boolean;
    zebraStripes: boolean;
    emptyPlaceholder?: string;
  };
};
```

---

## 5. Configuration Reference

### `columnGroups`

Optional array of column groups enabling horizontal fold/unfold. A folded group hides its
member columns and, if `summaryColumnId` is set, shows that single column in their place.
Groups are independent of row hierarchy.

- `id` — unique group id.
- `header` — label shown on the group's toolbar toggle.
- `memberColumnIds` — column ids belonging to the group.
- `summaryColumnId` — optional member id shown while folded.
- `defaultState` — `"folded"` (default behavior) or `"unfolded"`.

### `columns`

Ordered array of leaf columns (left to right).

- `id` — stable column id; also the default value key.
- `valueKey` — key read from `row.values`; defaults to `id`.
- `header` — column header text.
- `type` — `"string" | "number" | "percent" | "currency" | "date" | "boolean"`; controls
  formatting and default alignment (numeric types default to right-aligned).
- `align` — override alignment.
- `format` — numeric/date hints (all in `de-DE`):
  - `minFractionDigits`, `maxFractionDigits`
  - `currency` — ISO code for `type: "currency"` (default `"EUR"`).
  - `notation` — `"number"` (default) or `"compact"`.
  - `datePattern` — date-fns pattern for `type: "date"` (default `"dd.MM.yyyy"`).
  - `percentScale` — `"fraction"` (default; `0.31 → 31 %`) or `"value"` (`31 → 31 %`).
- `boolean` — rendering for `type: "boolean"`:
  - `display` — `"icon"` (default check/cross) or `"text"`.
  - `trueLabel` / `falseLabel` — text when `display: "text"` (defaults `"Ja"`/`"Nein"`).
- `sortable` — enable header click sorting (requires `sorting.enabled`).
- `filterable` — show a per-column filter input (requires `filtering.perColumn`).
- `wrap` — wrap long content; default truncates with a hover `title`.
- `hidden` — initial visibility; the user can toggle via the column menu unless locked.
- `lockVisibility` — prevent the user from toggling the column.
- `width` — preferred width in px.
- `footerAggregate` — aggregate shown in the footer when `footer.show`; `"none"` default.
- `dataBar` — in-cell bar for numeric columns:
  - `enabled` — turn the bar on.
  - `min` / `max` — explicit domain; when both omitted the domain is derived from values.
  - `includeChildrenInDomain` — include descendant rows when auto-deriving (default `true`).
  - `positiveColor` / `negativeColor` — bar fills (negative defaults to positive).
  - `showValue` — overlay the formatted value (default `true`).
  - `radius` — bar corner radius px.
  - `heightRatio` — bar height as a fraction of the cell (0–1).

### `hierarchy`

- `enabled` — turn on the expandable tree.
- `expandColumnId` — column hosting the chevron + indentation (defaults to first column).
- `defaultExpandedDepth` — depth expanded on first render (`0` = only top level).
- `indentSize` — px indentation per depth level.
- `showParentAggregates` / `aggregate` — reserved for parent-row aggregates.

### `columnMenu`

- `show` — render the column-visibility popover.
- `label` — trigger label (default `"Spalten"`).

### `sorting`

- `enabled` — enable sorting globally (each column still needs `sortable`).
- `defaultSort` — initial `{ columnId, direction }`. With hierarchy enabled, sorting reorders
  siblings within each parent and preserves the tree.

### `filtering`

- `globalSearch` — render a global quick-search box across visible columns.
- `perColumn` — enable per-column filter inputs (each column opts in via `filterable`).
- `searchPlaceholder` — global search placeholder (default `"Suchen..."`).

### `footer`

- `show` — render a grand-total footer over the filtered rows (leaf rows only).
- `label` — text shown in the first column (default `"Gesamt"`).

### `pagination`

- `enabled` — paginate top-level rows (descendants travel with their parent).
- `pageSize` — rows per page.

### `appearance`

- `density` — `"comfortable"` or `"compact"` cell padding.
- `stickyHeader` — keep the header (and footer) pinned while scrolling.
- `stickyFirstColumn` — freeze the first column during horizontal scroll.
- `zebraStripes` — alternate row background.
- `emptyPlaceholder` — text for null/empty cells (default `"-"`).

---

## 6. Configuration Rules

- Every `columns[].id` should have a matching key (`id` or `valueKey`) in `values`.
- `dataBar` only renders for numeric cell values; configure it on `number`/`currency`
  columns.
- Diverging databars (domain spanning negatives) anchor at zero automatically.
- `columnGroups[].summaryColumnId` must be one of that group's `memberColumnIds`.
- `filterable` has no effect unless `filtering.perColumn` is `true`.
- `sortable` has no effect unless `sorting.enabled` is `true`.
- `footerAggregate` has no effect unless `footer.show` is `true`.
- `percentScale` only applies to `type: "percent"`.

---

## 7. Complete Configuration Example

```ts
const chartConfig: TableChartConfig = {
  columns: [
    { id: "region", header: "Region", type: "string" },
    {
      id: "revenue",
      header: "Umsatz",
      type: "currency",
      format: { currency: "EUR", notation: "compact" },
      sortable: true,
      footerAggregate: "sum",
      dataBar: { enabled: true, positiveColor: "#2563eb", showValue: true },
    },
    {
      id: "growth",
      header: "Wachstum",
      type: "percent",
      format: { percentScale: "fraction", maxFractionDigits: 1 },
      sortable: true,
      dataBar: {
        enabled: true,
        positiveColor: "#16a34a",
        negativeColor: "#dc2626",
        showValue: true,
      },
    },
    { id: "active", header: "Aktiv", type: "boolean" },
  ],
  hierarchy: {
    enabled: true,
    expandColumnId: "region",
    defaultExpandedDepth: 1,
    indentSize: 16,
  },
  columnMenu: { show: true, label: "Spalten" },
  sorting: { enabled: true, defaultSort: { columnId: "revenue", direction: "desc" } },
  filtering: { globalSearch: true, perColumn: false },
  footer: { show: true, label: "Gesamt" },
  pagination: { enabled: false, pageSize: 25 },
  appearance: {
    density: "comfortable",
    stickyHeader: true,
    stickyFirstColumn: true,
    zebraStripes: true,
    emptyPlaceholder: "-",
  },
};
```

---

## 8. Data and Configuration Relationship

```text
API row:

{ "id": "eu", "parentId": null, "values": { "region": "Europe", "revenue": 1200000, "growth": 0.124, "active": true } }

Configuration:

columns[0].id = "region" -> values["region"] -> "Europe"
columns[1].id = "revenue" (valueKey defaults to id) -> values["revenue"] -> 1200000
columns[2].id = "growth", type "percent", percentScale "fraction" -> 0.124 -> "12,4 %"
columns[3].id = "active", type "boolean" -> true -> check icon

hierarchy.expandColumnId = "region" -> chevron + indentation rendered in the region column
parentId "eu" on child rows nests them under the "eu" row
```

---

## 9. Usage

### Import

```ts
import TableModule from "@/modules/TableModule";
```

### Minimal Example

```tsx
<TableModule
  {...injectedProps}
  chartConfig={{
    columns: [
      { id: "region", header: "Region", type: "string" },
      { id: "revenue", header: "Umsatz", type: "currency" },
    ],
    hierarchy: { enabled: false, defaultExpandedDepth: 0, indentSize: 16 },
    columnMenu: { show: false },
    sorting: { enabled: false },
    filtering: { globalSearch: false, perColumn: false },
    footer: { show: false },
    pagination: { enabled: false, pageSize: 25 },
    appearance: {
      density: "comfortable",
      stickyHeader: false,
      stickyFirstColumn: false,
      zebraStripes: false,
    },
  }}
/>
```

### Complete Example

Use the object from **Complete Configuration Example** as `chartConfig`. In practice the
dashboard config references the module by `moduleName: "TableModule"` and the runtime injects
the props; you do not instantiate the component directly.

---

## 10. Expected Props

The module is rendered through `ChartWrapper`, which injects `ChartWrapperInjectedProps`.

### `chartConfig`

Type:

```ts
TableChartConfig;
```

Description:

The table configuration. Source: `configuration`.

### `chartData`

Type:

```ts
TableRowData[];
```

Description:

Validated flat rows from the API. Source: `API data`.

### `selectedRows`

Type:

```ts
readonly TableRowData[];
```

Description:

The current selection, owned by `ChartWrapper`. The module highlights matching rows by `id`.
Source: `wrapper`.

### `onSelectionChange`

Type:

```ts
(rows: TableRowData[], options?: { additive?: boolean }) => void;
```

Description:

Called on row click with the clicked row (parent rows emit only their own row). A plain click
replaces the selection; Ctrl/Cmd-click accumulates (`additive`). Source: `wrapper`.

### `lasso`

Type:

```ts
LassoController<TableRowData>;
```

Description:

Injected but unused; `TableModule` registers no lasso adapter.

### Enhanced tooltip / connections

The visible tooltip and the connection context menu are owned by `ChartWrapper`, not the
module. When `enhancedTooltip: true` and rows are selected, the wrapper batches the selected
rows to `POST /api/data/chart/tooltip`. Because a row's top-level keys are `id`, `parentId`,
and `values`, the tooltip/connection SQL must parse `:values` (a JSON array of structs, one
element per selected row) and emit atomic aliases for any `expectedColumns`.

---

## 11. Runtime Behavior

- Builds a nested tree from the flat `id`/`parentId` list (`useMemo`); orphan parents become
  top-level and cyclic edges are dropped.
- Formats cells with the fixed `de-DE` locale; `percent` respects `percentScale`; `date`
  expects ms timestamps; `boolean` renders an icon or text.
- Resolves databar domains config-first, else from column values (optionally including
  descendants); diverging domains anchor at zero.
- Merges two independent visibility layers (user hide/show + group fold/unfold) into a single
  visibility map each render.
- Sorting reorders siblings within their parent; filtering keeps ancestors of matching leaf
  rows; pagination applies to top-level rows and keeps descendants attached.
- Selection highlights rows whose `id` is in `selectedRows`; parent rows emit only their own
  row; `subRows` are stripped before calling `onSelectionChange`.

---

## 12. Validation and Errors

### Schema validation failure

Cause:

An API row is missing `id`, has an invalid `parentId` type, or `values` contains a value that
is not `number | string | boolean | null`. `ChartWrapper` validates against
`chartDataSchema.ts` and renders an error state.

How to fix:

Ensure SQL emits `id`, `parentId`, and a JSON `values` object with only allowed value types.

### Empty databar / missing values

Cause:

A databar column contains non-numeric values, or a configured `valueKey` is absent from
`values`.

How to fix:

Emit numeric values for databar columns; the empty placeholder renders for missing keys.

---

## 13. Agent Instructions

1. Read this `instructions.md` before creating or changing a `TableModule` configuration.
2. Read `chartType.d.ts` before generating a configuration.
3. Read `chartDataSchema.ts` before generating or modifying API data.
4. Do not modify the module implementation to satisfy a page-specific requirement.
5. Prefer solving page-specific requirements through configuration and SQL.
6. Do not invent configuration properties not defined by `chartType.d.ts`.
7. Do not invent API fields not accepted by `chartDataSchema.ts`.
8. Respect all relationships in **Data and Configuration Relationship**.
9. Use only valid values documented in **Configuration Reference**.
10. Generate complete configuration objects.
11. Do not change `index.tsx`, `chartDataSchema.ts`, or `chartType.d.ts` unless the user
    explicitly requests a module change.
12. If the requested visualization cannot be represented, report the limitation.
13. Keep enhanced tooltip, context-menu, and connection behavior in `ChartWrapper`.

---

## 14. Agent Workflow

1. Determine whether `TableModule` suits the requested visualization.
2. Read this `instructions.md`.
3. Read `chartType.d.ts`.
4. Read `chartDataSchema.ts`.
5. Determine the required API data structure (`id`, `parentId`, `values`).
6. Write SQL emitting `id`, `parentId`, and `to_json(named_struct(...)) AS values`.
7. Create the module configuration.
8. Verify every configuration property exists in `chartType.d.ts`.
9. Verify the expected API data matches `chartDataSchema.ts`.
10. Verify all configuration-to-data relationships.
11. Integrate the module into the dashboard config (`moduleName: "TableModule"`).
12. Run `npm run module:validate` and `npm run module:generateRegistry`.

---

## 15. Do Not

- Add undocumented configuration properties.
- Assume behavior not documented here or implemented by the module.
- Change the module implementation for a page-specific styling preference.
- Change the API data format without changing the schema intentionally.
- Emit `values` keys that no column references and expect them to render.
- Ignore required configuration properties (`columns`, `hierarchy`, `columnMenu`, `sorting`,
  `filtering`, `footer`, `pagination`, `appearance`).
