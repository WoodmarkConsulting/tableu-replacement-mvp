# Plan: Searchable Multiselect Filter

A new filter dimension `type: "multiselect"` that renders a searchable,
multi-check dropdown (combobox) and binds to SQL as a list.

> Depends on / composes with the deferred-query work in
> [`deferred-queries-plan.md`](./deferred-queries-plan.md). Multiselect edits go
> through the same draft layer and only hit the warehouse when **Apply** is
> pressed. This plan can also land standalone against the current single-`values`
> store — the only difference is _when_ the query fires, not _how_ the value is
> serialized. Wherever this doc says `setDraftFilter` / `appliedValues`, read the
> pre-deferred equivalents (`setFilter` / `values`) if that work has not shipped
> yet.

---

## Current behavior (baseline)

- `FilterValue = string | number | null | DateRangeValue`.
- `select` renders a native `<select>` (single value, no search).
- No shadcn `command` / `cmdk` dependency is installed.
- `components/FilterControl/index.tsx` renders one control per `dimension.type`;
  `dimension.options` already exists and feeds the native `select`.
- `components/ChartWrapper/index.tsx::toQueryParam` serializes a single
  `FilterValue` to a SQL param (`string | number | null`).
- `components/ActiveFilters/index.tsx` renders removable chips via `isEmpty` /
  `formatValue`.

---

## Type changes (`types/filters.d.ts`)

- Add `"multiselect"` to `FilterType`.
- Extend `FilterValue` to include `string[]`:
  `type FilterValue = string | number | null | DateRangeValue | string[];`
- `options` already exists on `FilterDimension` and is reused for the choices.

Ripple review for the widened union (all must compile + behave):

- `stores/filterProvider.ts::buildDefaultValues` — `string[]` default flows
  through unchanged.
- `components/ChartWrapper/index.tsx::toQueryParam` — add array handling
  (see serialization below).
- `components/ActiveFilters/index.tsx::isEmpty` / `formatValue` — handle arrays.
- Snapshot persistence — `Record<string, FilterValue>` is JSON-serialized;
  arrays round-trip fine.

## Dependency — shadcn `command`

- Add the `command` component (pulls in `cmdk`) via the shadcn registry, plus
  `badge` if not present (for selected-count display). Use the project's shadcn
  workflow.
- Build the combobox from `Popover` + `Command` (`CommandInput`, `CommandList`,
  `CommandEmpty`, `CommandGroup`, `CommandItem` with a check icon).

## Control (`components/FilterControl/index.tsx`)

- Add `case "multiselect"`:
  - Current value = `Array.isArray(value) ? value : []`.
  - `Popover` trigger shows the label + selected count (or first N labels).
  - `CommandInput` provides search over `dimension.options`.
  - Each `CommandItem` toggles membership; checked state shows a check icon.
  - `onChange(nextArray.length ? nextArray : null)` (empty → `null` so the chart
    param resolves to "unset").
  - Include a "Clear" affordance inside the popover.
- Leave the single `select` case as-is (optionally, later, also give it search).

## Serialization to SQL (`components/ChartWrapper/index.tsx`)

- `toQueryParam`: if `Array.isArray(value)` → `value.length ? value.join(",")
: null`. Existing string/number/null handling unchanged. `dateRange` still
  resolved separately.
- Param resolution (`filterValues[globalKey] ?? filterValues[tabKey]`) is
  unchanged.

## SQL authoring convention

Charts bound to a multiselect dimension must expand the joined string:

```sql
(:region IS NULL OR array_contains(split(:region, ','), region_col))
```

Document this in `AGENTS.md` (Filtering framework) and `README.md` next to the
existing multi-select example, which already uses the same pattern.

## ActiveFilters (`components/ActiveFilters/index.tsx`)

- `isEmpty`: treat `[]` as empty.
- `formatValue`: for `multiselect`, map each selected value to its option label
  and join with `", "` (or show `"{n} selected"` beyond a threshold).

---

## Interaction with deferred queries

- Multiselect edits go through `setDraftFilter` → nothing fetches until **Apply**.
  This is exactly the intended "pick several values, then run" flow.
- Chips (applied multiselect) render the committed selection; removing a chip
  clears the whole dimension via `clearDimension`.

---

## File-by-file change list

| File                                        | Change                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `types/filters.d.ts`                        | Add `"multiselect"` to `FilterType`; widen `FilterValue` with `string[]`. |
| `components/FilterControl/index.tsx`        | Add `case "multiselect"` combobox.                                        |
| `components/ChartWrapper/index.tsx`         | `toQueryParam` array handling (join → comma string).                      |
| `components/ActiveFilters/index.tsx`        | `isEmpty` / `formatValue` array handling.                                 |
| `components/ui/command.tsx` (+ `badge.tsx`) | **New** shadcn components.                                                |
| `AGENTS.md`, `README.md`                    | Document `multiselect` type + SQL `split/array_contains` convention.      |

Note: `docs/plans/filter-framework-plan.md` mentions all filter types are
"single-value today" — update that note once multiselect lands.

---

## Validation

1. `npm run lint`.
2. `npx tsc --noEmit` (watch the widened `FilterValue` union across all consumers:
   `buildDefaultValues`, `toQueryParam`, `isEmpty` / `formatValue`, snapshots).
3. Regenerate + inspect a dashboard page:
   `rm -rf app/Dashboards/<name> && npx tsx scripts/pages/generateNextPage.ts`.
4. Manual (Playwright) on a dashboard with a `multiselect` dimension:
   - Search filters the option list.
   - Multiple checks persist; the trigger shows the selected count/labels.
   - Clearing all selections resolves the SQL param to `null`.
   - Param posts as a comma-joined string; a chart using the
     `split/array_contains` SQL returns the union.
   - Chip renders option labels (or `"{n} selected"`); removing it clears the
     whole dimension.

---

## Open questions

1. Multiselect chip display beyond ~3 selections: list labels vs. "N selected"?
2. Should the single `select` also become searchable, or keep native `<select>`?
