# TableModule — Test Plan

Status: Proposed
Scope: `modules/TableModule/` (planned — module and design not yet implemented)
Depends on: `docs/plans/testing-strategy-plan.md` (tooling, mocks, directory layout)
Tooling: Vitest (`node` for schema/helpers, `jsdom` + React Testing Library for render)

> No `TableModule` and no dedicated design doc exist yet. This plan assumes a data-table
> module that follows the same module contract as `LineChartModule` and `MapModule`
> (`index.tsx` default export typed with `ChartWrapperInjectedProps`, `chartDataSchema.ts`
> default Zod export + type, single-`type` `chartType.d.ts`, `instructions.md`). The
> **assumed data/config contract below is a proposal**; once the module is designed, align
> these assertions to the shipped `chartDataSchema.ts` and `chartType.d.ts`.

---

## 1. Assumed contract (to confirm at implementation time)

### Transport shape (`chartDataSchema.ts`)

One row = one table record; cell values are primitive and JSON-serializable.

```ts
// Proposed
const tableCellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const tableDataSchema = z.record(z.string(), tableCellSchema);
export type TableData = z.infer<typeof tableDataSchema>;
export default tableDataSchema;
```

### Config (`chartType.d.ts`, single `TableChartConfig` type)

Column definitions and presentation, e.g.:

```ts
// Proposed
type TableChartConfig = {
  columns: {
    key: string;                 // matches a key in each TableData row
    header: string;              // display label
    align?: "left" | "right" | "center";
    format?: "text" | "number" | "compact" | "percent" | "currency" | "date";
    width?: number;
    sortable?: boolean;
  }[];
  pagination?: { enabled: boolean; pageSize: number };
  sort?: { key: string; direction: "asc" | "desc" };
  emptyMessage?: string;
};
```

If the module is a **drill source**, clicking a row calls `onSelectionChange([row])`.

---

## 2. Test layers

| Layer | Environment | Focus |
| --- | --- | --- |
| Schema | `node` | Row/cell parse & reject rules |
| Pure helpers | `node` | Cell formatters, sort comparator, pagination slicing, column resolution |
| Component render | `jsdom` | Header/row rendering, sorting, pagination, alignment, empty state, drill |
| Contract | `node` | Module folder contract (shared guard test) |

> Expose formatters, the sort comparator, and pagination helpers as testable exports
> (`helpers.ts`) so the logic is unit-tested without mounting the DOM.

---

## 3. Schema tests (`chartDataSchema.test.ts`, `node`)

- Valid row `{ id: 1, name: "A", active: true, note: null }` parses.
- Cell types `string | number | boolean | null` accepted; mixed keys per row allowed.
- Rejects nested objects/arrays as cell values (cells must be primitive).
- Empty row `{}` parses (renders as a blank record; column resolution handles missing keys).
- `TableData` type matches `z.infer` (compile-time assert via `expectTypeOf`).

## 4. Pure-helper tests (`helpers.test.ts`, `node`)

### Cell formatters
- `"text"` → `String(value)`; `null` → configured empty placeholder (e.g. `""` or `"—"`).
- `"number"` → locale number; `"compact"` → `"12.5K"`; `"percent"` → `"45%"`;
  `"currency"` → currency formatting; `"date"` → date from timestamp/ISO.
- Non-numeric value passed to a numeric format degrades gracefully (renders raw, no throw).

### Column resolution
- For a column `key` missing from a row, resolves to the empty placeholder, not `undefined`.
- Columns render in config order regardless of key order in the row object.

### Sort comparator
- Ascending/descending numeric sort.
- String sort is locale-aware and case-insensitive (assert stable, predictable order).
- `null` values sort consistently (e.g. always last) in both directions.
- Mixed-type column sorts deterministically (define and assert the rule).

### Pagination
- `pageSize` slices rows into pages; last page may be partial.
- Page count computed correctly (`ceil(total / pageSize)`).
- Out-of-range page index clamps to the last valid page.
- `pagination.enabled: false` returns all rows.

## 5. Component render tests (`index.test.tsx`, `jsdom`)

- **Headers**: one `<th>` per configured column with the configured `header`; alignment class
  matches `align`.
- **Rows/cells**: renders one row per `chartData` entry; each cell shows the formatted value
  for its column `key`.
- **Missing key**: a row lacking a column key shows the empty placeholder.
- **Sorting**: clicking a `sortable` header sorts rows and toggles asc/desc; non-sortable
  headers do not react. Initial `sort` config is applied on first render.
- **Pagination**: with `pagination.enabled`, only `pageSize` rows show; next/prev controls
  change the visible page; controls carry `print:hidden` (consistent with `ActiveFilters`).
- **Empty data**: `chartData: []` renders `emptyMessage` (or the framework empty state) and
  does not throw.
- **Height**: `height` prop drives container sizing / scroll region.

### Drill / selection (if drill source)
- Clicking a row calls `onSelectionChange([row])`.
- When `onSelectionChange` is absent, rows are not interactive (drill disabled).

## 6. Fixtures

Add `tests/fixtures/table.ts`:

- `simpleRows` — homogeneous rows covering each cell type.
- `withNulls` — rows exercising missing keys and `null` cells.
- `manyRows` — enough rows to exercise pagination.
- `sortable` — values crafted to make asc/desc order unambiguous.

Meta-test: every fixture parses through `tableDataSchema`.

## 7. Contract test (shared)

Once `modules/TableModule/` exists, it must pass the shared module-contract guard and
`npm run module:validate`:

- `index.tsx` default export typed with `ChartWrapperInjectedProps<TableData, TableChartConfig>`.
- `chartDataSchema.ts` default-exports a Zod schema and exports `TableData`.
- `chartType.d.ts` contains exactly one `type` (`TableChartConfig`).
- `instructions.md` follows `docs/instructions.template.md`.
- Registry regenerated (`npm run module:generateRegistry`) so `TableModule` is a key in
  `modules/modulRegistry.ts`.

## 8. Out of scope

- Server-side sorting/pagination (this plan assumes client-side over the returned rows; if
  the module later pushes sort/pagination into SQL, add API/E2E coverage instead).
- Virtualized-rendering internals if a virtualization library is later adopted.
- Pixel/visual comparison.
