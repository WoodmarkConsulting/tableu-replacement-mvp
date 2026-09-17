# TableModule view-state persistence plan

## Goal

Make `TableModule` configurable so that a user's own table layout — column **order**,
**visibility**, **widths**, **sorting**, and **column-group fold state** — is remembered
across sessions and devices, per user, per dashboard, per chart.

Two capabilities are missing today and are part of this work:

1. **Column reordering** — there is no reorder interaction at all. Added as drag & drop on
   the column headers.
2. **Column resizing** — `columns[].width` is a static config value; there is no resize
   handle. Added as a drag handle on the header's right edge.

Everything else (`visibility`, `sorting`, `groupFold`) already exists as local
`useState` in [modules/TableModule/index.tsx](modules/TableModule/index.tsx) and only needs
to be lifted into the persisted view-state layer.

---

## Decisions (confirmed with the requester)

| Question | Decision |
| --- | --- |
| Reorder UI | Drag & drop on column headers |
| Persistence target | Server-side Databricks table, keyed by the forwarded Databricks Apps user identity |
| Identity fallback | Anonymous client id in `localStorage` when no forwarded identity exists |
| Config shape | New `TableChartConfig.viewState` object |
| Persisted scope | order, visibility, width, sorting, group fold |
| Column groups | Members stay contiguous; a group moves as one block |
| Config drift | Merge — keep saved order for known ids, insert new columns at their configured position, drop unknown ids |
| Reset control | "Standardansicht wiederherstellen" action in the existing column menu |
| Storage key | `dashboardName` + `chartID` |
| Save timing | Auto-save, debounced ~500 ms |
| Sorting conflict | Saved sorting wins over `sorting.defaultSort` |
| Column resizing | In scope |

---

## User identity

This app is deployed as a Databricks App
([scripts/databricks/ensureDatabricksApp.ts](scripts/databricks/ensureDatabricksApp.ts)).
Databricks Apps' reverse proxy forwards user-identity headers to the app:
`X-Forwarded-Email`, `X-Forwarded-User`, `X-Forwarded-Preferred-Username`
(plus `X-Forwarded-Access-Token` for on-behalf-of auth, which this feature does not need).

**Security rule:** the identity is resolved **server-side only**, inside the route handler,
from the request headers. The client never sends a user id in the request body and the API
never accepts one. This prevents a user from reading or overwriting another user's
preferences by forging a body field.

Resolution order in `resolveViewStateOwner(headers)`:

1. `X-Forwarded-Email` → `user:<lowercased email>`
2. `X-Forwarded-Preferred-Username` → `user:<value>`
3. `X-Forwarded-User` → `user:<value>`
4. Fallback: `anon:<clientId>` where `clientId` is a `crypto.randomUUID()` generated once in
   the browser and stored in `localStorage` under `tableViewState.clientId`, sent as the
   `X-View-State-Client-Id` request header.

The fallback is only trusted as an opaque bucket key — it is never treated as an
authenticated principal. Owner keys are prefixed (`user:` / `anon:`) so a forged
`X-View-State-Client-Id` can never collide with a real user's row. The fallback covers
local `next dev` (no proxy headers) and any non-Apps deployment.

---

## Config surface

New optional block in [modules/TableModule/chartType.d.ts](modules/TableModule/chartType.d.ts).
Defaults keep every existing dashboard byte-for-byte unchanged.

```ts
/**
 * User-adjustable view state: which interactions are allowed and whether the
 * result is remembered for the current user.
 */
viewState?: {
  /** Allow drag & drop reordering of column headers. Default false. */
  reorderable?: boolean;
  /** Allow drag-to-resize column widths. Default false. */
  resizable?: boolean;
  /**
   * Remember the user's adjustments across sessions. Default false.
   * Requires a resolvable user identity; falls back to a per-browser id.
   */
  persist?: boolean;
  /**
   * Which parts of the view state are persisted.
   * Default: ["order", "visibility", "width", "sorting", "groupFold"].
   */
  persistKeys?: ("order" | "visibility" | "width" | "sorting" | "groupFold")[];
  /** Show the "reset to default view" action in the column menu. Default true when persist is on. */
  showResetAction?: boolean;
};
```

Interactions and persistence are deliberately decoupled: a dashboard can enable reordering
without persisting it, or persist visibility/sorting without enabling reorder or resize.
`showResetAction` is also independent of `columnMenu.show`: when reset is enabled, the view
options popover renders even if there are no visibility toggles.

The default `persistKeys` lists all five slices even though `reorderable` and `resizable`
default to `false`. A slice whose interaction is disabled is an inert no-op: nothing can
change it, so nothing is ever written for it. Authors do not need to trim `persistKeys` to
match the enabled interactions.

Rationale for putting this on `TableChartConfig` rather than `columnMenu` or a
dashboard-level key: every persisted key (`order`, `width`, `groupFold`, …) is a
`TableModule` concept, and `columnMenu` is specifically the visibility popover. A
dashboard-level option would require plumbing unrelated state through `TabsWrapper`.

---

## Persisted payload

```ts
type TableViewState = {
  /** Bump when the shape changes; mismatched versions are ignored, not migrated. */
  version: 1;
  /** Leaf column ids, left-to-right. */
  order?: string[];
  /** columnId -> visible. */
  visibility?: Record<string, boolean>;
  /** columnId -> width in px. */
  width?: Record<string, number>;
  /** TanStack SortingState. */
  sorting?: { id: string; desc: boolean }[];
  /** groupId -> folded. */
  groupFold?: Record<string, boolean>;
};
```

Stored as a JSON string, exactly like `FilterSnapshot` in
[app/api/filters/snapshotStore.ts](app/api/filters/snapshotStore.ts).

### Reconciliation with config (drift handling)

`reconcileViewState(config, saved)` runs on every load, before the state reaches TanStack:

- **order** — start from the saved order, filtered to ids that still exist in
  `config.columns`. Then walk `config.columns` in configured order and insert any id missing
  from the saved order at its configured index relative to its already-placed neighbours.
  New columns therefore appear where the author put them, not appended at the end.
- **Group contiguity** — after the merge, re-run the group-block normalisation (below) so a
  saved order predating a `columnGroups` change can never leave a group split.
- **visibility / width** — drop keys for unknown column ids; missing keys fall back to
  `!column.hidden` / `column.width`.
- **width** — clamp to `[MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH]` (e.g. 48–800 px) so a corrupt
  or hostile stored value cannot render the table unusable.
- **sorting** — keep only entries whose `id` is an existing **and** `sortable` column. If
  nothing survives, fall back to `sorting.defaultSort`. A surviving saved sort wins over
  `defaultSort`.
- **groupFold** — drop unknown group ids; missing ids fall back to `defaultState`.
- **version mismatch or parse failure** — ignore the record entirely and use config defaults.
  Never throw; a broken preference must never break the dashboard.
- Keys not listed in `persistKeys` are ignored on read and not written.

---

## Column ordering and column groups

Group members must stay contiguous and a group moves as a single block. The order state
remains a flat `string[]` (what TanStack's `columnOrder` expects); contiguity is enforced by
a normalisation function rather than a nested model:

`normalizeOrder(order, columnGroups)`:

1. Walk the flat order left to right.
2. The first time a member of group *G* is encountered, emit **all** of *G*'s members in
   their configured relative order at that position.
3. Skip further members of *G* later in the list.
4. Ungrouped columns keep their position.

Because within-group reordering is out of scope (below), the intra-group sequence is always
the configured one; only the position of the block as a whole is user-controlled.

Drag behaviour driven by this:

- Dragging a **grouped** header grabs the whole block. The drop indicator snaps to group
  boundaries; a drop inside another group is rejected.
- Dragging an **ungrouped** header cannot land between two members of a group — the drop
  target resolves to the nearest group boundary.
- Reordering **within** a group is not supported in v1. Group members retain their current
  relative order while the block moves.
- `normalizeOrder` runs after every drop and after `reconcileViewState`, so the invariant
  holds even if stored data violates it.

### DnD implementation

Recommendation: **native HTML5 drag-and-drop on the `<th>` elements** (`draggable`,
`onDragStart`/`onDragOver`/`onDrop`), with `columnOrder` held in module state and fed to
`useReactTable` via `state.columnOrder` + `onColumnOrderChange`.

- No new dependency. The repo has no DnD library today.
- The interaction is a single-axis header reorder, which is the simplest possible DnD case.
- The resize handle must call `stopPropagation` on `dragstart`/`pointerdown` so the two
  header gestures do not conflict.
- _Alternative:_ `@dnd-kit/core` + `@dnd-kit/sortable` (what TanStack's own example uses).
  Better keyboard/a11y story and smoother animation, at the cost of two dependencies.
  Worth revisiting if keyboard reordering becomes a requirement — native HTML5 DnD has no
  keyboard equivalent, so a keyboard path would otherwise need the column menu's up/down
  buttons as a fallback.

### Resizing

Use TanStack's built-in `columnResizeMode: "onEnd"` with `state.columnSizing` /
`onColumnSizingChange`, seeded from `columns[].width`. `"onEnd"` (rather than `"onChange"`)
avoids a re-render per pointer move on wide tables and yields exactly one persist write per
gesture.

State wiring alone does not resize a native table. `buildColumnDefs` must set each column's
`size`, `minSize`, and `maxSize`, and the rendered headers and cells must consume TanStack's
computed sizes (for example through shared CSS variables or `column.getSize()`). The table
must retain horizontal overflow instead of shrinking sized columns back into `w-full`.
Interaction with `appearance.stickyFirstColumn` must be verified — the sticky column's
position and width must be recalculated after resize and reorder.

---

## Storage

New table, same pattern as `filter_snapshots` (`CREATE TABLE IF NOT EXISTS` on first use via
a memoised `ensureTable()` promise, `runQuery` with named parameters only — no string
interpolation of user input):

```sql
CREATE TABLE IF NOT EXISTS `<catalog>`.`<schema>`.`table_view_prefs` (
  owner_key   STRING,
  dashboard   STRING,
  chart_id    STRING,
  state       STRING,
  updated_at  TIMESTAMP
) USING DELTA
```

Identifiers are backtick-quoted exactly as in `snapshotStore.ts` — the target schema name
starts with a digit, so an unquoted three-part name does not parse.

Writes upsert so each (user, dashboard, chart) keeps exactly one row. `MERGE` needs an
explicit source relation; the parameters are the source:

```sql
MERGE INTO <FQTN> AS target
USING (
  SELECT :owner AS owner_key, :dashboard AS dashboard, :chartId AS chart_id, :state AS state
) AS source
  ON target.owner_key = source.owner_key
 AND target.dashboard = source.dashboard
 AND target.chart_id  = source.chart_id
WHEN MATCHED THEN UPDATE SET target.state = source.state, target.updated_at = current_timestamp()
WHEN NOT MATCHED THEN INSERT (owner_key, dashboard, chart_id, state, updated_at)
  VALUES (source.owner_key, source.dashboard, source.chart_id, source.state, current_timestamp())
```

`updated_at` is written for observability only. Concurrency across tabs, windows, or devices
is **last write wins**: the row is not version-checked and `updated_at` is never compared on
write. Two tabs on the same dashboard will overwrite each other, which is accepted for v1.

New module `app/api/tableViewState/viewStateStore.ts` mirroring `snapshotStore.ts`, plus:

- `GET /api/tableViewState/[dashboard]/[chartId]` → `TableViewState | null`
- `PUT /api/tableViewState/[dashboard]/[chartId]` → body is the `TableViewState`, validated
  with a Zod schema before it is stringified and stored. The schema **strips** unknown keys
  rather than rejecting them (so a forged `owner` field is silently discarded, not turned
  into a 400) and rejects non-string column ids, non-finite widths, and payloads above
  `MAX_VIEW_STATE_BYTES` = 32 KB. The cap is deliberately below the ~64 KB body limit that
  `fetch(..., { keepalive: true })` enforces, so the unload flush can never be rejected for a
  payload the normal path accepted.
- `DELETE /api/tableViewState/[dashboard]/[chartId]` → used by the reset action.

Both handlers resolve the owner from headers; neither reads an owner from the body or the
query string.

### Client access

New hook `hooks/useTableViewState.ts`:

- `useQuery` for the GET (React Query is already the data layer), `staleTime: Infinity`.
- Do **not** cache the layout payload in `localStorage`. The server-side owner is intentionally
  unavailable to the client, so a key containing only dashboard and chart would expose one
  user's cached layout to the next user of the same browser. `localStorage` is used only for
  the anonymous client id.
- A debounced (~500 ms, trailing), serialized PUT queue keyed per chart. At most one PUT is in
  flight; while it runs, newer changes replace one queued payload, which is sent after the
  current request settles. This guarantees that an older request cannot commit after a newer
  request from the same page.
- Reset first cancels the debounce, clears the queued payload, waits for any in-flight PUT,
  and only then sends DELETE. A generation token prevents a settled pre-reset mutation from
  scheduling another write and recreating the deleted state.
- A best-effort `fetch(..., { keepalive: true })` flush runs on `visibilitychange`/`pagehide`.
  This reduces lost final gestures but is not treated as a delivery guarantee. The 32 KB
  payload cap keeps it inside the browser's keepalive body limit.
- Persistence failures are non-fatal: log once, keep the in-memory state, do not surface an
  error state on the chart.

`dashboardName` is read from `usePathname()` (routes are
`app/Dashboards/<DashboardName>/page.tsx`), so no prop plumbing through `TabsWrapper` or
`ChartWrapper` is needed. `chartID` is already an injected prop.

---

## Changes in `modules/TableModule/index.tsx`

Current state layers stay, but their initialisers change from "config only" to
"reconciled(config, saved)". New state: `columnOrder`, `columnSizing`.

```
saved (server/localStorage) ─┐
                             ├─► reconcileViewState ─► initial state ─► useReactTable
config defaults ─────────────┘                                │
                                                              ▼
                                            user gesture ─► setState ─► debounced PUT
```

Concretely:

- `useState` initialisers for `userVisibility`, `sorting`, `foldedGroups` take the reconciled
  value.
- Add `const [columnOrder, setColumnOrder] = useState<string[]>(...)` and
  `const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(...)`.
- Pass `columnOrder` / `columnSizing` into `state` and wire
  `onColumnOrderChange` / `onColumnSizingChange`.
- Because the saved state arrives **asynchronously**, the table renders config defaults
  first. Track hydration as `loading | applying | ready` and track which of the five slices
  the user changes before GET resolves. On success, apply reconciled server values only to
  untouched slices and retain dirty slices; on a missing record or failed GET, keep config
  defaults for untouched slices. This prevents a late response from clobbering a gesture.
- Dropping the `localStorage` cache removes the instant first paint it used to provide, so
  the layout reflow after hydration has to be handled in the UI instead. While
  `viewState.persist` is on and hydration is `loading`, render the existing
  `ChartState`-style skeleton in place of the table body; the toolbar stays visible and
  non-interactive. Once hydration reaches `applying`/`ready` the table renders once, in its
  final layout. Without `persist` there is no GET and no skeleton — behaviour is unchanged.
- One `useEffect` watches the five persisted slices and calls the debounced save only in the
  `ready` state. It must not fire on the initial config-default render or for values written
  by hydration. If pre-hydration interaction produced dirty slices, persist the final merged
  state once hydration is ready.
- `expanded`, `pagination`, `columnFilters`, and `globalFilter` are **not** persisted — they
  are per-session query state, not layout.

The existing column popover becomes a view-options popover and gains a
"Standardansicht wiederherstellen" item that clears local state to the config defaults and
performs the ordered DELETE above. Two render gates currently hide it and **both** must be
updated: the toolbar wrapper condition
([modules/TableModule/index.tsx](modules/TableModule/index.tsx#L280), today
`globalSearch || columnMenu.show || columnGroups.length > 0`) and the popover's own condition
([modules/TableModule/index.tsx](modules/TableModule/index.tsx#L315), today
`columnMenu.show && toggleableColumns.length > 0`). Both need an additional
"reset action available" term so the popover survives `columnMenu.show: false` and a column
set where every entry has `lockVisibility: true`.

---

## Not in scope

- Sharing a saved layout between users, or an admin-published default layout.
- Persisting expansion, pagination, or filter state.
- Keyboard-accessible reordering (see the `@dnd-kit` note above).
- Including view state in the `ShareButton` permalink — the share snapshot stays
  filter-only, so a shared link shows the recipient's own layout.

---

## Files touched

| File | Change |
| --- | --- |
| `modules/TableModule/chartType.d.ts` | Add `viewState` block |
| `modules/TableModule/index.tsx` | Order/sizing state, DnD headers, resize handles, hydration + save effects, reset action |
| `modules/TableModule/columns.tsx` | Header render: drag affordance, resize handle, group-block drag source |
| `modules/TableModule/viewState.ts` *(new)* | `TableViewState` type, Zod schema, `reconcileViewState`, `normalizeOrder`, width clamps |
| `modules/TableModule/instructions.md` | Document `viewState`, the two new interactions, and persistence semantics |
| `modules/instructions.md` | Note the new `TableModule` capability |
| `hooks/useTableViewState.ts` *(new)* | Query, hydration lifecycle, serialized mutation queue, reset, and anon client id |
| `app/api/tableViewState/viewStateStore.ts` *(new)* | Table bootstrap, `MERGE` upsert, load, delete |
| `app/api/tableViewState/[dashboard]/[chartId]/route.ts` *(new)* | GET / PUT / DELETE, server-side identity resolution, Zod validation |
| `app/api/utils/requestIdentity.ts` *(new)* | `resolveViewStateOwner(headers)` |
| `tests/tableViewState.test.ts` *(new)* | `reconcileViewState` + `normalizeOrder` unit tests |
| `tests/useTableViewState.test.ts` *(new)* | Hydration, save ordering, and reset lifecycle tests |

Module contract is unaffected: no change to `index.tsx`'s default export or props type, no
change to `chartDataSchema.ts`, and `chartType.d.ts` still declares exactly one `type`.
Run `npm run module:validate` and `npm run module:generateRegistry` after the config type
changes.

---

## Validation

1. `npm run verify:typescript`, `npm run lint`, `npm run module:validate`.
2. `npm run test` — unit tests for the reconciler: added column, removed column, renamed
   column, group added after save, group removed after save, saved sort on a
   now-`sortable: false` column, out-of-range width, version mismatch, corrupt JSON.
3. Playwright on a dashboard using `TableModule`
   ([pagesConfig/pages.json](pagesConfig/pages.json) → pick the table dashboard): reorder two
   columns, resize one, hide one, sort one, fold a group, reload, confirm all five restored.
4. Confirm a folded group cannot be split by dragging an ungrouped column into it.
5. Confirm `viewState` omitted → behaviour identical to today (no drag handles, no resize
   handles, no network calls to `/api/tableViewState`).
6. Confirm a PUT whose body carries a forged `owner`/`owner_key` field still writes to the
   header-derived owner: the extra field is stripped by the schema, the request succeeds, and
   the victim's row is untouched.
7. Confirm persistence failure (stop the warehouse / force a 500) leaves the table fully
   usable.
8. Confirm the initial render sends no PUT before GET settles. With a delayed GET, change one
   slice and confirm the gesture survives while untouched slices hydrate.
9. Complete several gestures while a PUT is in flight and confirm the final stored payload is
   the newest state. Reset with a PUT pending and confirm the deleted state is not recreated.
10. Switch forwarded users in the same browser and confirm no previous user's layout is read
    from browser storage or displayed.
11. Confirm resizing visibly changes header and body-cell widths, survives reload, preserves
    horizontal overflow, and works with `stickyFirstColumn` before and after reorder.
12. Confirm the reset action remains reachable with `columnMenu.show: false` and when every
    column has `lockVisibility: true`.
13. With `persist: true` and a throttled GET, confirm the skeleton shows instead of a
    default-layout table and that the table paints exactly once, already in the saved layout.
14. With two tabs open on the same dashboard, confirm the last completed gesture wins and
    neither tab errors.

---

## Open risks

- **Databricks write latency.** Delta `MERGE` per gesture is heavier than a key-value store.
  The 500 ms debounce plus `onEnd` resize mode keeps this to roughly one write per completed
  interaction. The serialized latest-payload queue bounds each chart to one in-flight and one
  queued write; persistence remains non-blocking for table interactions.
- **Delta small-file growth.** One row per (user, dashboard, chart) with frequent `MERGE`
  updates produces many small files. A periodic `OPTIMIZE` may be needed; worth noting but
  not solving in v1.
- **First paint depends on the warehouse.** With `persist: true` the table body waits for the
  GET, so a cold warehouse delays the table behind a skeleton. The alternative (paint config
  defaults, then reflow) was rejected because the reflow is more jarring than a short
  skeleton, and the previous `localStorage` mitigation is not safe on a shared browser. If
  the delay proves noticeable, cap the skeleton with a timeout and fall back to the
  default-layout render plus hydration merge.
- **Header gesture conflict.** Drag-to-reorder, drag-to-resize, and click-to-sort all live on
  the same `<th>`. Needs explicit hit-zone separation (resize handle ~6 px on the right edge,
  `stopPropagation` on both gestures, sort only on a plain click with no drag movement).
- **`stickyFirstColumn` + resize/reorder.** Both features assume a known first column and its
  width; verify the sticky offset recalculates and that the sticky column can be dragged away
  from position 0.
