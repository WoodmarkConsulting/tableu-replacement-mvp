# Plan: Deferred Query Execution ("Apply" button)

Charts must not fetch on dashboard open. The user edits all filters, then clicks
an **Apply** button to fire the queries.

> Composes with the searchable multiselect work in
> [`searchable-multiselect-filter-plan.md`](./searchable-multiselect-filter-plan.md):
> multiselect edits go into the _draft_ layer and only hit the warehouse when
> **Apply** is pressed. The two plans are independent and can land in either
> order.

---

## Current behavior (baseline)

- `stores/filterProvider.ts` holds a single `values: Record<string, FilterValue>`
  map. Controls call `setFilter(key, value)` which mutates `values` immediately.
- `components/ChartWrapper/index.tsx` reads `values`, builds `params` in a
  `useMemo`, and puts `params` in the TanStack Query `queryKey`. Queries are
  `enabled: parsedMockData === undefined`, so **any** value change re-fetches, and
  the first fetch happens on mount.
- `FilterValue = string | number | null | DateRangeValue`.
- `select` renders a native `<select>` (single value, no search).
- No shadcn `command` / `cmdk` dependency is installed.
- Known latent bug: `components/AppSidebar.tsx/index.tsx` passes `value={0}` to
  `FilterControl` instead of reading the store — global controls never reflect
  state. Must be fixed as part of this wiring.

---

## Target behavior

- On dashboard open, **no chart queries run**. Charts show an idle prompt
  ("Adjust filters and press Apply").
- Editing any filter updates a **draft** state only (no fetching).
- Pressing **Apply** commits draft → applied; all charts then fetch with the
  applied values.
- **Reset** discards pending draft edits (draft ← applied).
- A dirty indicator shows when draft ≠ applied.
- A shared permalink (`?s=<id>`) auto-applies on hydration so the recipient sees
  data without pressing Apply.

## Store changes (`stores/filterProvider.ts`)

Split the single `values` into two layers plus an applied flag:

- `draftValues: Record<string, FilterValue>` — edited by controls.
- `appliedValues: Record<string, FilterValue>` — drives queries + chips.
- `hasApplied: boolean` — gate; `false` until the first Apply (or snapshot
  hydration). Blocks all fetching on open.

New / changed actions:

- `setDraftFilter(key, value)` — replaces `setFilter`; writes to `draftValues`
  only.
- `applyFilters()` — `appliedValues = { ...draftValues }`, `hasApplied = true`.
- `resetDraft()` — `draftValues = { ...appliedValues }` (discard pending edits).
- `clearDimension(key)` — deletes from **both** draft and applied (chip removal
  re-queries immediately; keeps layers in sync).
- `clearAll()` — clears both layers; optionally keep `hasApplied` so charts show
  "no filters" results rather than reverting to the idle prompt. Decision: keep
  `hasApplied = true` after an explicit clear.
- `applySelection(entries, navigateTo)` (selection) — merge `entries` into **both**
  draft and applied and set `hasApplied = true` (selection is an explicit,
  immediate cross-filter action; syncing both layers avoids clobbering pending
  edits).
- `initFilterStore` — seed both `draftValues` and `appliedValues` from
  `buildDefaultValues(...)`, but leave `hasApplied = false` so open ≠ fetch.
- `resetFilterStore` — reset all new fields.

Add a derived helper (selector or plain function) `isDirty(state)` = shallow
inequality of `draftValues` vs `appliedValues`.

## ChartWrapper gating (`components/ChartWrapper/index.tsx`)

- Read `appliedValues` (not `values`) for `params` resolution.
- Read `hasApplied`.
- `useQuery` → `enabled: parsedMockData === undefined && hasApplied`.
- When `!hasApplied && parsedMockData === undefined`, render a new idle
  `ChartState` prompt instead of the spinner/empty states.
- Selection still calls `applySelection` (immediate), unchanged from the caller's
  perspective.

## New component — `components/FilterActions/index.tsx`

- Renders **Apply** (primary) + **Reset** (ghost) buttons.
- Subscribes to `isDirty`; Apply is emphasized/enabled when dirty, Reset enabled
  when dirty.
- `print:hidden`.
- Optional: small "N pending changes" badge.

## Wiring

- `components/FilterControl/index.tsx` — no structural change; still calls the
  injected `onChange`. Callers now pass `draftValues[key]` and `setDraftFilter`.
- `components/AppSidebar.tsx/index.tsx` — read `draftValues`, pass real
  `draftValues[key]` (fixes the `value={0}` bug), call `setDraftFilter`. Add
  `<FilterActions />` in the sidebar footer/header.
- `components/TabFilters/index.tsx` — use `draftValues` + `setDraftFilter`.
- `components/DashboardShell/index.tsx` — render `<FilterActions />` in the top
  bar (below header / above tabs) so both `sidebar` and `top` layouts get an
  Apply control.
- `components/ActiveFilters/index.tsx` — read `appliedValues` (chips reflect what
  data actually shows). Chip removal → `clearDimension` (already re-queries).
- `hooks/useShareFilters.ts` — snapshot `appliedValues` (the committed state).
- `hooks/useFilterUrlSync.ts` — after hydrating a snapshot, write values into
  draft **and** call `applyFilters()` so shared links render data
  (`hasApplied = true`).

## Edge cases / decisions

- **Tab switching** is not a filter edit; `activeTab` stays separate and does not
  require Apply. Switching tabs fetches that tab's charts with current
  `appliedValues` (once `hasApplied`).
- **Defaults**: seeded into both layers but not auto-applied → still no fetch on
  open. (If product wants defaults auto-applied on open, flip `hasApplied` to
  `true` in `initFilterStore` — single-line toggle. Default choice: `false`.)
- **Chip removal** and **selection application** intentionally bypass the Apply gate (they are
  explicit, targeted actions). Documented above.

---

## File-by-file change list

| File                                  | Change                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stores/filterProvider.ts`            | Draft/applied split, `hasApplied`, `setDraftFilter`, `applyFilters`, `resetDraft`, updated `clearDimension`/`clearAll`/`applySelection`/`init`/`reset`, `isDirty` helper. |
| `components/FilterActions/index.tsx`  | **New** Apply/Reset buttons + dirty state.                                                                                                                                |
| `components/ChartWrapper/index.tsx`   | Read `appliedValues` + `hasApplied`; gate `enabled`; idle prompt state.                                                                                                   |
| `components/AppSidebar.tsx/index.tsx` | Use `draftValues`/`setDraftFilter` (fix `value={0}`); render `<FilterActions />`.                                                                                         |
| `components/TabFilters/index.tsx`     | Use `draftValues`/`setDraftFilter`.                                                                                                                                       |
| `components/DashboardShell/index.tsx` | Render `<FilterActions />` in top bar.                                                                                                                                    |
| `components/ActiveFilters/index.tsx`  | Read `appliedValues`; chip removal → `clearDimension`.                                                                                                                    |
| `hooks/useShareFilters.ts`            | Snapshot `appliedValues`.                                                                                                                                                 |
| `hooks/useFilterUrlSync.ts`           | Auto-apply after snapshot hydration.                                                                                                                                      |
| `AGENTS.md`, `README.md`              | Document Apply-to-run behavior.                                                                                                                                           |

Note: `useChartState` / `ChartFilters` are legacy (commented out in
`ChartWrapper`) and out of scope. The searchable multiselect dimension is planned
separately in
[`searchable-multiselect-filter-plan.md`](./searchable-multiselect-filter-plan.md);
multiselect edits flow through `setDraftFilter` and are gated by **Apply** like
any other filter.

---

## Validation

1. `npm run lint`.
2. `npx tsc --noEmit`.
3. Regenerate + inspect a dashboard page:
   `rm -rf app/Dashboards/<name> && npx tsx scripts/pages/generateNextPage.ts`.
4. Manual (Playwright) on a dashboard:
   - Open → confirm no `/api/data/*` requests fire (Network) and charts show the
     idle prompt.
   - Edit filters → still no requests; dirty indicator shows.
   - Apply → requests fire once; charts render; chips reflect applied values.
   - Reset → pending edits discarded.
   - Share link → recipient sees data without pressing Apply.

---

## Test cases — Apply-gate bypass (chip removal + selection)

These are the highest-risk paths: `clearDimension` (chip removal) and
`applySelection` (selection) intentionally _bypasses_ the Apply gate and writes to both
the draft and applied layers. The following cases pin down that they stay in
sync, re-query immediately, and never clobber pending draft edits. Author them
as store-level unit tests against `useFiltersStore` (no React needed) plus the
two marked E2E checks.

Shared setup for unit cases: `initFilterStore({ dimensions, initialActiveTab })`,
then drive actions directly and assert on `getState()`. `isDirty(state)` =
shallow inequality of `draftValues` vs `appliedValues`.

### Chip removal (`clearDimension`)

- **C1 — removes from both layers.** Given `hasApplied = true` and a dimension
  present in both `draftValues` and `appliedValues`, `clearDimension(key)` deletes
  that key from **both** maps. Assert the key is absent in draft and applied.
- **C2 — re-queries immediately (no Apply needed).** After C1, `hasApplied`
  remains `true` and `appliedValues` no longer contains the key, so the derived
  `params` for a bound chart resolve that param to `null`. Assert the resolved
  param map omits/nulls the removed dimension without any `applyFilters()` call.
- **C3 — does not clobber unrelated pending draft edits.** Given a pending draft
  edit on dimension **A** (draft ≠ applied for A) and an applied value on
  dimension **B**, `clearDimension(B)` removes **B** from both layers but leaves
  A's pending draft edit intact. Assert `draftValues[A]` unchanged and
  `isDirty(state)` still `true` for A.
- **C4 — idempotent / missing key.** `clearDimension` on a key absent from both
  layers is a no-op: no throw, both maps unchanged, `hasApplied` unchanged.
- **C5 — chip reflects applied, not draft.** With a pending draft edit that has
  not been applied, `ActiveFilters` renders chips from `appliedValues`; removing a
  chip clears the _applied_ dimension (and its draft counterpart per C1). Assert
  the removed chip's dimension is gone from applied.
- **C6 (E2E) — network.** In the browser, remove a chip → exactly one
  `/api/data/*` refetch fires for affected charts; charts without that binding do
  not refetch.

### Selection (`applySelection`)

- **D1 — writes to both layers + sets `hasApplied`.** From a state with
  `hasApplied = false` (fresh open), `applySelection(entries)` merges `entries`
  into **both** `draftValues` and `appliedValues` and sets `hasApplied = true`.
  Assert every entry key/value is present in both maps.
- **D2 — same-page cross-filter (no `navigateTo`).** `applySelection(entries)`
  with `navigateTo` omitted leaves `activeTab` unchanged. Assert `activeTab`
  equals its prior value.
- **D3 — cross-tab selection (`navigateTo` set).** `applySelection(entries, "TabB")`
  sets `activeTab = "TabB"` and applies the entries. Assert both.
- **D4 — does not clobber unrelated pending draft edits.** Given a pending draft
  edit on dimension **A**, a selection that writes dimension **B** leaves
  `draftValues[A]` intact while adding **B** to both layers. Assert A's pending
  edit survives and B is in both maps.
- **D5 — selected dimension overwrites its own pending draft.** If a pending draft
  edit exists on the _same_ dimension the selection targets, the selection value wins in
  both layers (selection is explicit/immediate). Assert draft and applied both equal
  the selected value.
- **D6 — multi-select join.** With `selectionMode: "multi"` and multiple selected
  rows, the bound dimension value is the comma-joined string of selection keys.
  Assert `appliedValues[key] === selected.join(",")`.
- **D7 — scope resolution.** A selection binding to a `global` dimension writes
  `global:<id>`; a binding to a `tab` dimension writes `tab:<dim.tab>:<id>` (the
  dimension's own scope, not the active tab). Assert the correct key form for each.
- **D8 — empty selection is a no-op.** `applySelection` with no resolvable entries
  (all selection values null/undefined) does not mutate either layer and does not
  flip `hasApplied`.
- **D9 (E2E) — network + gating.** In the browser, a selection fires the
  target charts' `/api/data/*` requests immediately (no Apply press), and if
  `navigateTo` is set the target tab becomes active.

### Interaction with the Apply gate

- **G1 — bypass does not leak into normal edits.** After a selection or chip removal
  (which set/keep `hasApplied = true`), a subsequent plain filter edit via
  `setDraftFilter` must **not** auto-fetch: it updates `draftValues` only,
  `appliedValues` is unchanged, and `isDirty(state)` becomes `true` until the next
  `applyFilters()`.
- **G2 — layers converge after Apply.** Following any bypass, calling
  `applyFilters()` copies draft→applied so the two layers are equal and
  `isDirty(state)` is `false`.

---

## Open questions

1. Should dashboard **default** filter values auto-run on open, or always wait for
   Apply? (Plan assumes wait; one-line toggle if not.)
2. Apply scope: global **and** tab filters together via one button (plan), or a
   separate Apply per scope?
