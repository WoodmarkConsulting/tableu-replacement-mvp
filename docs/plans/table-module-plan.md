# TableModule plan

## Goal

Create a new module at `modules/TableModule/` that follows the same contract as
`LineChartModule`, `MapModule`, and the planned `HistogramModule`:

- `index.tsx`
- `chartDataSchema.ts`
- `chartType.d.ts`
- `instructions.md`

The module renders a **configurable data table** driven entirely by config + SQL. It must
support the three explicitly requested capabilities:

1. **Databars** — a horizontal bar rendered inside a numeric cell whose width encodes the
   cell value relative to a domain (config-defined or auto-derived). Supports positive-only
   and diverging (positive/negative) bars, optional value label, and per-column color.
2. **Hide and unfold columns** — two independent column mechanics:
   - **Hide/show**: individual columns can start hidden and be toggled by the user through a
     column-visibility menu (config sets the initial state; the user can override live).
   - **Fold/unfold (column groups)**: columns can be organized into groups that render
     collapsed by default (optionally showing a single summary column) and expand to reveal
     their member columns, like pivot-table column expansion.
3. **Hierarchical display** — parent/child rows rendered as an expandable tree with
   indentation and chevron toggles in a configured column, driven by a flat adjacency-list
   transport shape (`id` / `parentId`) assembled into a tree client-side.

It also supports the shared framework features every module participates in:

- **Selection**: clicking (or checkbox-selecting) a row calls the injected
  `onSelectionChange(rows, options?)`. Multi-select accumulates via `{ additive: true }`.
- Standard `ChartWrapperInjectedProps` wiring: `chartData`, `height`, loading/error/empty
  states handled by `ChartWrapper`, config injected as `chartConfig`.

---

## Decisions from the design pass

- **Rendering engine: add `@tanstack/react-table` (headless).** A table with column
  visibility, column groups (fold/unfold), expandable sub-rows, sorting, and selection is
  exactly what TanStack Table's headless model solves. The repo already uses the
  `@tanstack` ecosystem (`@tanstack/react-query`), so this is a natural, low-friction
  addition. All markup stays ours (shadcn table primitives), so styling and databar
  rendering remain fully custom.
  - _Alternative considered:_ hand-rolling row/column state. Rejected for v1 — reimplementing
    stable expansion, visibility, grouping, and selection state is substantial and
    error-prone versus the ~14 kB headless library. The plan notes the hand-rolled path as a
    fallback if adding a dependency is not acceptable.
- **Row markup: add the shadcn `table` UI primitive** at `components/ui/table.tsx` (via the
  shadcn registry) for `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`,
  `TableCell`. No table primitive exists in `components/ui/` today.
- **Transport shape: flat adjacency list.** Each row is a flat object with `id`,
  `parentId`, and a `values` map keyed by column id. This is the most SQL-friendly hierarchy
  encoding (a self-join / recursive CTE emits `id` + `parentId` naturally) and the module
  builds the tree in-memory. Flat rows also keep the schema uniform whether or not hierarchy
  is used (top-level rows simply have `parentId: null`).
- **Columns are config-authored, not data-inferred.** The set, order, headers, formatting,
  databar behavior, grouping, and initial visibility of columns all live in
  `chartType.d.ts` config. The SQL only has to emit the referenced value keys. This mirrors
  the repo model where SQL shapes data and config controls presentation.
- **Databar domain resolution: config-first, auto-fallback.** A databar column may set an
  explicit `{ min, max }`; if omitted, the module derives the domain from the visible values
  of that column (with an option to include/exclude child rows). Diverging bars anchor at
  zero when the domain spans negative and positive values.
- **Sorting/pagination: included, config-gated, default sensible.** Client-side sorting per
  column and optional client-side pagination. Hierarchy and pagination interact (see Open
  questions); v1 paginates top-level rows and keeps a node's descendants with it.

---

## Dependencies

- **New:** `@tanstack/react-table` (headless table state). Add to `dependencies` in
  `package.json`.
- **New (UI primitive):** shadcn `table` component generated into `components/ui/table.tsx`.
  Use the shadcn registry/MCP to add it; it is a thin styled wrapper with no runtime deps.
- **Reused:** `zod`, `lucide-react` (chevron/eye icons), `@/lib/utils` (`cn`), Tailwind.
- `tsconfig.json` requires no changes.

If adding `@tanstack/react-table` is rejected, the fallback is a self-contained
implementation using `useState`/`useMemo` for expansion, visibility, group-fold, sort, and
selection sets — same data contract and config, more module code.

---

## Data contract

### Transport shape

Each row is one node in the (optional) hierarchy. Top-level rows use `parentId: null`.

```ts
{
  id: string; // unique, stable row id
  parentId: string | null; // adjacency-list parent; null at top level
  values: Record<string, number | string | null>; // cell values keyed by column id
}
```

- The table's columns are defined in config by `id`; each column reads `row.values[column.valueKey]`.
- Hierarchy is derived from `id` / `parentId`. If no row has a non-null `parentId`, the table
  renders flat (hierarchy simply never engages).
- `values` may omit keys; a missing key renders as the configured empty placeholder.

### `chartDataSchema.ts`

```ts
import { z } from "zod";

export const tableRowSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  values: z.record(
    z.string(),
    z.union([z.number().finite(), z.string(), z.null()]),
  ),
});

export type TableRowData = z.infer<typeof tableRowSchema>;

export default tableRowSchema;
```

### Data rules (documented in `instructions.md`)

- `id` must be unique across all rows.
- `parentId` must be `null` or reference an existing row's `id`; unknown parents are treated
  as top-level (and should be avoided in SQL).
- No cycles: a row must not be its own ancestor.
- `values` keys should cover every `valueKey` referenced by a configured column; missing
  keys render as empty, they are not an error.
- Databar columns must contain numeric (or `null`) values; string values in a databar column
  render as text without a bar.
- Row order within a parent is preserved from the API response unless the user sorts; SQL
  should `ORDER BY` for a stable default.

### Example API response

```json
[
  {
    "id": "eu",
    "parentId": null,
    "values": {
      "region": "Europe",
      "revenue": 1200000,
      "growth": 12.4,
      "margin": 0.31
    }
  },
  {
    "id": "eu-de",
    "parentId": "eu",
    "values": {
      "region": "Germany",
      "revenue": 540000,
      "growth": 8.1,
      "margin": 0.28
    }
  },
  {
    "id": "eu-fr",
    "parentId": "eu",
    "values": {
      "region": "France",
      "revenue": 410000,
      "growth": -2.3,
      "margin": 0.22
    }
  },
  {
    "id": "na",
    "parentId": null,
    "values": {
      "region": "North America",
      "revenue": 2100000,
      "growth": 5.7,
      "margin": 0.35
    }
  },
  {
    "id": "na-us",
    "parentId": "na",
    "values": {
      "region": "USA",
      "revenue": 1800000,
      "growth": 6.2,
      "margin": 0.37
    }
  }
]
```

---

## Configuration type (`chartType.d.ts`)

Exactly one `type` declaration named `TableChartConfig`.

```ts
type TableChartConfig = {
  /**
   * Column-group definitions enabling fold/unfold. Optional.
   * A group renders collapsed by default: its member columns are hidden and, if
   * `summaryColumnId` is set, that single column is shown in their place. Expanding the
   * group reveals all member columns. Groups are independent of hierarchy (row expansion).
   */
  columnGroups?: {
    id: string;
    header: string;
    /** Column ids that belong to this group. */
    memberColumnIds: string[];
    /** Shown when folded; must be one of memberColumnIds. Omit to show nothing when folded. */
    summaryColumnId?: string;
    /** Initial state. Default "folded". */
    defaultState: "folded" | "unfolded";
  }[];

  /** Leaf columns, left-to-right in render order. */
  columns: {
    /** Stable column id; also the default value key. */
    id: string;
    /** Key read from row.values. Defaults to `id` when omitted. */
    valueKey?: string;
    header: string;
    /** Controls cell rendering + formatting + default alignment. */
    type: "string" | "number" | "percent" | "currency" | "date";
    align?: "left" | "center" | "right";
    /** Number/date formatting hints. */
    format?: {
      /** e.g. minimum/maximum fraction digits for numeric types. */
      minFractionDigits?: number;
      maxFractionDigits?: number;
      /** ISO currency code when type === "currency", e.g. "EUR". */
      currency?: string;
      /** "number" | "compact" for large numbers. */
      notation?: "number" | "compact";
      /** date-fns-style pattern when type === "date"; value is a ms timestamp. */
      datePattern?: string;
    };
    /** Sorting. */
    sortable?: boolean;
    /** Initial visibility. User can toggle later via the column menu unless locked. */
    hidden?: boolean;
    /** Prevent the user from hiding/showing this column. */
    lockVisibility?: boolean;
    /** Fixed/preferred width in px. */
    width?: number;
    /** Databar rendering for numeric columns. */
    dataBar?: {
      enabled: boolean;
      /** Explicit domain; when omitted the module derives it from the column's values. */
      min?: number;
      max?: number;
      /** Include descendant rows when auto-deriving the domain. Default true. */
      includeChildrenInDomain?: boolean;
      /** Bar fill for positive values. */
      positiveColor: string;
      /** Bar fill for negative values (diverging). Defaults to positiveColor. */
      negativeColor?: string;
      /** Also print the formatted value on top of the bar. Default true. */
      showValue: boolean;
      /** Bar corner radius in px. */
      radius?: number;
      /** Bar height as a fraction of the cell (0–1). Default fills the cell. */
      heightRatio?: number;
    };
  }[];

  /** Expandable row hierarchy. */
  hierarchy: {
    enabled: boolean;
    /** Column that hosts the expand chevron + indentation. Defaults to the first column. */
    expandColumnId?: string;
    /** Depth expanded on first render. 0 = only top level. Default 0. */
    defaultExpandedDepth: number;
    /** Indentation per depth level in px. Default 16. */
    indentSize: number;
    /** Show a running aggregate on parent rows for numeric columns. Off by default. */
    showParentAggregates?: boolean;
    /** Aggregation used when showParentAggregates is on. */
    aggregate?: "sum" | "avg" | "min" | "max" | "count";
  };

  /** Column-visibility menu (the "hide" UI). */
  columnMenu: {
    show: boolean;
    /** Menu button label. Default "Columns". */
    label?: string;
  };

  /** Sorting behavior. */
  sorting: {
    enabled: boolean;
    /** Initial sort. */
    defaultSort?: { columnId: string; direction: "asc" | "desc" };
  };

  /** Client-side pagination of top-level rows. */
  pagination: {
    enabled: boolean;
    pageSize: number;
  };

  /** Presentation. */
  appearance: {
    density: "comfortable" | "compact";
    stickyHeader: boolean;
    zebraStripes: boolean;
    /** Text shown for null/empty cells. Default "—". */
    emptyPlaceholder?: string;
  };
};
```

---

## Implementation plan

### Phase 0 — Dependency + UI primitive

1. Add `@tanstack/react-table` to `package.json` dependencies and install.
2. Add the shadcn `table` primitive to `components/ui/table.tsx` via the shadcn registry.
3. Confirm `npm run verify:typescript` and `npm run lint` still pass with the new primitive.

### Phase 1 — Data contract and config type

1. Create `modules/TableModule/chartDataSchema.ts` with the Zod schema above (default export
   `tableRowSchema`, named type `TableRowData`).
2. Create `modules/TableModule/chartType.d.ts` with the single `TableChartConfig` type above.

### Phase 2 — Component implementation

Create `modules/TableModule/index.tsx` with a default export typed as:

```ts
ChartWrapperInjectedProps<TableRowData, TableChartConfig>;
```

The component should:

1. Destructure `chartConfig`, `chartData`, `height`, `selectedRows`, and `onSelectionChange`
   from injected props (same pattern as `LineChartModule`/`MapModule`).
2. **Build the tree** (`useMemo`): convert the flat `id`/`parentId` list into nested rows
   (`{ ...row, subRows }`) for TanStack Table's `getSubRows`. Detect and guard against cycles
   and orphan parents (treat orphans as top-level).
3. **Build column defs** (`useMemo`) from `chartConfig.columns`, wiring:
   - cell renderer per `type` with the configured `format` helpers (numeric/compact/percent/
     currency/date), right-aligning numeric types by default.
   - the **expand column**: the configured `expandColumnId` (or first column) renders a
     chevron toggle + `paddingLeft = depth * indentSize` when `hierarchy.enabled`.
   - **databar** cells: a relative-positioned cell with an absolutely-positioned bar `div`
     whose `width%` = normalized value against the resolved domain; diverging bars anchor at
     the zero position; optional value label layered on top. Extract a `DataBarCell`
     subcomponent and a `resolveDomain(column, rows)` helper.
   - column `meta` carrying `groupId` so fold/unfold can map groups → member columns.
4. **Column groups (fold/unfold)**: keep a `foldedGroups` state (init from
   `columnGroups[].defaultState`). Derive TanStack `columnVisibility` from the union of:
   - per-column `hidden` (initial) + user toggles from the column menu, and
   - folded groups (member columns hidden, `summaryColumnId` shown).
     Render group headers with a fold/unfold toggle. Keep group-fold and user hide/show as
     separate state layers, then merge into the single `columnVisibility` object each render.
5. **Column-visibility menu (hide UI)**: a `columnMenu` popover listing toggleable
   (non-`lockVisibility`) columns with eye icons; writes to the user-visibility state layer.
6. **Row expansion**: use TanStack `getExpandedRowModel`; initialize expanded state from
   `hierarchy.defaultExpandedDepth`. Chevron toggles a row's expansion.
7. **Sorting**: `getSortedRowModel`, gated by `sorting.enabled`, seeded from `defaultSort`;
   sortable headers show a direction indicator.
8. **Pagination**: `getPaginationRowModel` over top-level rows, gated by `pagination.enabled`,
   with simple prev/next + page indicator. Descendants stay grouped with their ancestor.
9. **Parent aggregates** (optional): when `hierarchy.showParentAggregates`, compute the
   configured aggregate of each numeric column over a node's descendants and render it on the
   collapsed parent (helper `aggregateSubtree`).
10. **Selection**: when `onSelectionChange` is a function, a row click selects that
    row. For multi-select, show checkboxes (or click-to-toggle) and call
    `onSelectionChange(rows, { additive: true })` with the original data rows so the
    wrapper accumulates the selection.
    Mirror the guarded, no-op-when-disabled approach from `LineChartModule`.
11. **Layout**: wrap in a scroll container sized by the injected `height` (reuse the
    `height`/svh handling used by `LineChartModule`), with an optional `stickyHeader`,
    `density`, and `zebraStripes` from `appearance`.

Helper extraction (keeps `index.tsx` readable; not required by the contract):

- `modules/TableModule/tree.ts` — flat→nested build, cycle/orphan handling, subtree walks.
- `modules/TableModule/format.ts` — value formatting per column `type`/`format`.
- `modules/TableModule/dataBar.ts` — domain resolution + width/anchor math.
- `modules/TableModule/columns.tsx` — column-def factory and `DataBarCell`.

> Contract note: helper files are allowed, but the four required files must each stay valid —
> `chartType.d.ts` must contain **exactly one** `type` declaration (`TableChartConfig`), so
> put any auxiliary types in `.ts`/`.tsx` helpers or inline in `index.tsx`, never a second
> `type` in `chartType.d.ts`.

### Phase 3 — Documentation and registry

1. Create `modules/TableModule/instructions.md` following `docs/instructions.template.md`
   exactly: purpose, module files, full data contract (every field + rules), configuration
   reference (every property, recursively, including `columns[]`, `columnGroups[]`,
   `hierarchy`, `dataBar`, and selection), an example API response, and usage/limitations.
2. Update root `modules/instructions.md` to add a `TableModule` entry:
   - purpose: tabular display of (optionally hierarchical) data with databars and
     hide/fold column controls.

- best use: detailed row-level reporting, expandable tables, KPI grids where in-cell
  databars aid scanning.
- how it differs from the chart modules (exact values + hierarchy vs. visual trend/shape;
  non-geographic vs. `MapModule`).
- note that hierarchy is transported as a flat `id`/`parentId` adjacency list and columns
  are config-authored.

3. Run `npm run module:validate` and `npm run module:generateRegistry` so
   `modules/modulRegistry.ts` gains the `TableModule` dynamic import, its data schema, and
   `TableChartConfig` in the `ChartConfigs` union.

### Phase 4 — Example SQL and smoke test (recommended)

1. Author an example `pagesConfig/sql/<chartID>.sql` producing the row shape. The key work is
   emitting `id`, `parentId`, and a `values` map. Databricks can build the map with
   `named_struct` → `to_json`, or the API layer can assemble `values` from selected columns;
   the plan's SQL sketch uses a struct the module reads as an object:

   ```sql
   -- Two-level region → country rollup as a flat adjacency list.
   WITH country AS (
     SELECT region, country, SUM(revenue) AS revenue, AVG(growth) AS growth
     FROM sales
     GROUP BY region, country
   ),
   region AS (
     SELECT region, SUM(revenue) AS revenue, AVG(growth) AS growth
     FROM country
     GROUP BY region
   )
   SELECT
     CONCAT('region:', region)               AS id,
     CAST(NULL AS STRING)                     AS parentId,
     named_struct('region', region, 'revenue', revenue, 'growth', growth) AS values
   FROM region
   UNION ALL
   SELECT
     CONCAT('region:', region, '|country:', country) AS id,
     CONCAT('region:', region)                        AS parentId,
     named_struct('region', country, 'revenue', revenue, 'growth', growth) AS values
   FROM country
   ORDER BY id;
   ```

   Adjust to the real source table. Requirements: unique `id`, valid `parentId` chain, and a
   `values` object whose keys match the configured column `valueKey`s (including any databar
   columns). Confirm the API route serializes `values` as an object matching the schema.

2. Add a temporary dashboard entry referencing
   `moduleName: "TableModule"`, regenerate the page with
   `npm run pageConfig:generatePage`, and visually confirm:
   - rows render with correct formatting and alignment per column type
   - databars scale correctly (including diverging negatives) and honor the domain
   - the column menu hides/shows columns; locked columns cannot be toggled
   - column groups fold/unfold, swapping member columns for the summary column
   - hierarchy expands/collapses with correct indentation and default depth
   - sorting and pagination behave and keep descendants with their ancestors

- selecting a row emits the selected data rows

---

## Relevant files

- `modules/LineChartModule/*` — structural template (injected props usage, `height`/svh
  handling, guarded selection click, `useMemo` data shaping).
- `modules/TableModule/index.tsx` — table rendering component.
- `modules/TableModule/chartDataSchema.ts` — Zod schema and `TableRowData` type.
- `modules/TableModule/chartType.d.ts` — single `TableChartConfig` type.
- `modules/TableModule/instructions.md` — module documentation.
- `modules/TableModule/{tree,format,dataBar,columns}.*` — optional helpers.
- `components/ui/table.tsx` — new shadcn table primitive.
- `modules/instructions.md` — module overview registry.
- `modules/modulRegistry.ts` — generated registry output.
- `types/baseChart.d.ts` — `ChartWrapperInjectedProps` contract.
- `types/baseChart.d.ts` — `SelectionChangeOptions` for selection wiring.
- `scripts/modules/validateModules.ts` — validation contract.
- `scripts/modules/generateModuleRegistry.ts` — registry generation.
- `docs/instructions.template.md` — instruction template to follow.
- `package.json` — add `@tanstack/react-table`.

---

## Verification checklist

- Four required `TableModule` files exist and satisfy the module contract:
  - `index.tsx` has a default export using `ChartWrapperInjectedProps`.
  - `chartDataSchema.ts` default-exports a Zod schema and exports `TableRowData`.
  - `chartType.d.ts` contains exactly one `type` declaration.
  - `instructions.md` follows `docs/instructions.template.md`.
- `@tanstack/react-table` is installed and `components/ui/table.tsx` exists.
- `npm run module:validate` passes.
- `npm run module:generateRegistry` succeeds; `ChartConfigs` includes `TableChartConfig`.
- `npm run lint` and `npm run verify:typescript` pass.
- Browser smoke test confirms databars, hide/fold columns, hierarchy expansion, sorting,
  pagination, and selection.

---

## Open questions / decisions to confirm before building

1. **New dependency approval.** OK to add `@tanstack/react-table`, or must the table be
   hand-rolled with no new dependency?
2. **`values` serialization.** Should SQL emit `values` as a struct the API returns as a JSON
   object (preferred), or should the API route assemble `values` from flat columns? This
   affects the example SQL and the `/api/data` handling.
3. **Pagination vs. hierarchy.** Confirm v1 paginates **top-level** rows only (descendants
   travel with their ancestor). Alternative: paginate the flattened visible rows.
4. **Fold/unfold semantics.** Confirm a folded group hides members and optionally shows a
   single `summaryColumnId` (chosen here), versus collapsing members into one computed
   aggregate column.
5. **Column grouping vs. hierarchy naming.** "Unfold columns" is implemented as column
   **groups** (horizontal fold/unfold), separate from row **hierarchy** (vertical
   expand/collapse). Confirm this matches intent.

---

## Out of scope for v1 (possible follow-ups)

- Server-side sorting/pagination/filtering for very large tables (v1 is client-side).
- Column resizing/reordering by drag, and pinning/frozen columns.
- CSV/Excel export of the current view (the dashboard print/export summary still applies).
- Editable cells or inline actions.
- Virtualized rows for very tall tables (add `@tanstack/react-virtual` later if needed).
- Cross-column conditional formatting / heatmap cell backgrounds beyond databars.
