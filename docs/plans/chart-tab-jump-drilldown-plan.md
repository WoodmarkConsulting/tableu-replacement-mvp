# Chart Selection Tab Jump ("Drill-to-Tab") — Implementation Plan

## Overview & Goal
Enable users to select data points (via single click, multi-point selection, or lasso selection) in any selection-capable chart module and drill down into another dashboard tab with that selection automatically passed into the target tab's filters. 

The user triggers the jump via a right-click context menu action. The target tab receives the selected values as tab-level filters (`tab:<targetTab>:<dimId>`), immediately applies them (updating both draft and applied filter layers so queries run without an extra "Apply" click), switches the active tab, and displays a breadcrumb allowing the user to navigate back, restoring the target tab's prior filter state.

---

## Confirmed Requirements
1. **Trigger:** Right-click context menu on the chart (`ContextMenu`). An item such as *"Auf Tab springen"* / *"Drilldown: [Target Tab Name]"* appears when valid rows are selected and a tab navigation is configured for that chart.
2. **Configuration:** Explicit configuration in dashboard JSON under the `tabJumps` key.
3. **Filter Scope:** Sets **tab-level filter dimensions** in the target tab (`scope: "tab"`, `tab: targetTab`).
4. **Selection Types:** Supports single row click, multi-row selection, and lasso selection. Values map to single values or string arrays (e.g., for `multiselect` dimensions).
5. **Breadcrumb / Return:** A breadcrumb appears in the header/tab bar when navigated via drilldown, showing the previous tab origin and allowing a single-click return.

---

## 1. Declarative Configuration Spec

Add `tabJumps` to `DashboardConfig` in `types/tabs.d.ts`, strictly typed against the dashboard tabs and charts (matching `ChartConnection`).

> **Important:** `types/tabs.d.ts` is an **ambient global declaration file** — it contains no
> imports and no exports, which is why `TabsConfig`, `DashboardConfig`, and `ChartConnection`
> are usable unqualified across the codebase (e.g. `components/TabsWrapper/index.tsx`,
> `components/DashboardShell/index.tsx`). Declare the new types with bare `type` (matching the
> existing `ChartConnection` declaration). Adding a single `export` would turn the file into a
> module and un-global every type it declares.

```typescript
type TabJumpMapping = {
  // Column from selected chart data (client-side selectedRows).
  // Must resolve to a primitive (string | number | boolean) on every selected row.
  sourceField: string;
  // Target filter dimension ID on the target tab
  targetDimensionId: string;
};

type TabJumpConfig<Tconf extends TabsConfig[] = TabsConfig[]> = {
  fromChartID: Tconf[number]["rows"][number]["components"][number]["chartID"];
  targetTab: Tconf[number]["trigger"];
  label?: string; // Optional context menu label, e.g. "Details in [Tab] ansehen"
  mappings: TabJumpMapping[];
  // If true (default), restores the target tab's previous filter values when
  // returning via the breadcrumb. Named for what it does: restore, not clear.
  restoreOnReturn?: boolean;
};

type DashboardConfig<T extends TabsConfig[] = TabsConfig[]> = {
  reportName: string;
  filterLayout: "sidebar" | "top";
  filters: FilterDimension<T>[];
  tabs: T;
  connections?: ChartConnection<T>[];
  tabJumps?: TabJumpConfig<T>[];
};
```

### Example in `pagesConfig/*.json`
```json
{
  "reportName": "Vehicle Battery Overview",
  "tabJumps": [
    {
      "fromChartID": "error_code_distribution",
      "targetTab": "Vehicle Details",
      "label": "Fahrzeugdetails für Fehlercode anzeigen",
      "mappings": [
        {
          "sourceField": "error_code",
          "targetDimensionId": "selected_error_code"
        }
      ]
    }
  ]
}
```

---

## 2. Architecture & State Management

### A. Navigation & Breadcrumb History in `stores/filterProvider.ts`
Manage tab jump navigation state directly inside `stores/filterProvider.ts` (rather than a separate store). 
**Rationale:** Switching `activeTab`, updating `draftValues` and `appliedValues`, and updating `breadcrumbs` must execute in a **single atomic Zustand `set()` transition**. A separate store risks intermediate renders where the target tab mounts and issues queries with stale filters before the second store applies drill values. This holds because inactive `TabsContent` unmounts, so the target tab's `ChartWrapper`s mount *after* the transaction with the drill values already present in `appliedValues`.

`executeTabJump` must **reuse the existing `applySelection` commit path** (`stores/filterProvider.ts`), which already writes `draftValues` + `appliedValues` + `hasApplied` + `activeTab` in one `set()`. The only additions are `previousValues` capture and the `breadcrumbs` push — extract the shared merge into a helper rather than maintaining a second, parallel implementation.

State shape (declared in `stores/filterProvider.ts`, which *is* a module, so `export` is correct here):
```typescript
export type TabJumpBreadcrumb = {
  fromTab: string;
  fromChartID: string;
  fromChartTitle?: string;
  targetTab: string;
  appliedKeys: string[]; // List of tab:<tab>:<dimId> keys injected by the drill
  previousValues: Record<string, FilterValue | undefined>; // Snapshot of values prior to drill for clean rollback
  restoreOnReturn: boolean;
};

// FilterStoreState additions:
breadcrumbs: TabJumpBreadcrumb[];
executeTabJump: (
  jump: TabJumpConfig,
  selectedRows: Record<string, unknown>[],
  fromChartTitle?: string,
) => boolean;
navigateBack: () => void;
clearBreadcrumbs: () => void;
```

`executeTabJump` and `navigateBack` set `activeTab` **directly inside their own `set()`**; they must not call `setActiveTab`, which carries the breadcrumb-clearing rule from §D and would otherwise wipe the stack it just modified.

### B. Filter Application & Data Extraction Mechanism
For V1, data extraction is **synchronous from client-side `selectedRows`**:
1. For each mapping in `tabJump.mappings`:
   - Verify `sourceField` exists on selected rows. If missing on all rows, the jump cannot proceed.
   - Extract, **narrow to primitives**, and deduplicate. Module rows may contain arrays or objects
     (e.g. `LineChartModule`'s `y: number[]`), where `Set` dedupe is reference-based and meaningless.
     Reuse the guard pattern of `isConnectionFilterValue` in `components/ChartWrapper/index.tsx`:
     ```typescript
     const raw = selectedRows.map((r) => r[sourceField]);
     if (raw.some((v) => v != null && !isPrimitive(v))) return false; // jump not possible
     const uniqueValues = Array.from(new Set(raw.filter((v) => v != null)));
     ```
   - Find target dimension in `state.dimensions` where `id === targetDimensionId && scope === "tab" && tab === targetTab`.
   - Validate dimension type against selection multiplicity:
     - **`multiselect` target:** Map to `string[]` (`uniqueValues.map(String)`).
     - **Single-value target (`select`, `option`, `string`, `number`):**
       - If `uniqueValues.length === 1`: Map to scalar (`number` or `string`).
       - If `uniqueValues.length > 1`: **Invalid mapping.** Disable the context menu item or abort the jump. *Do not concatenate into `"val1,val2"`*, as standard single-select controls will not match joined strings.
     - **`dateString` / `dateRange` targets:** **Not supported as drill targets.** Reject at config
       validation time; selection values have no defined mapping to a date literal or range object.
   - Key: `tab:<targetTab>:<targetDimensionId>`.
2. Capture rollback snapshot `previousValues`:
   - For each injected key, record `state.appliedValues[key]` (may be `undefined`).
   - Do **not** fall back to the dimension's `defaultValue` here. Defaults are already resolved and
     seeded into `appliedValues` at init (`resolveDefaultValue` / `initFilterStore`), so
     `appliedValues[key] === undefined` means the value is genuinely unset.
3. Push `TabJumpBreadcrumb` to `breadcrumbs`.
4. Atomically commit to store:
   - `draftValues: { ...state.draftValues, ...entries }`
   - `appliedValues: { ...state.appliedValues, ...entries }`
   - `hasApplied: true`
   - `activeTab: targetTab`
   - `breadcrumbs: [...state.breadcrumbs, newBreadcrumb]`
   - Queries on the target tab fire immediately with the injected filters.

### C. Return & Rollback Mechanism (`navigateBack`)
When the user clicks the breadcrumb to return:
1. Pop the top breadcrumb from `breadcrumbs`.
2. If `restoreOnReturn !== false`:
   - For each key in `appliedKeys`:
     - If `previousValues[key] !== undefined`, restore `draftValues[key]` and `appliedValues[key]` to it.
     - If `previousValues[key]` was `undefined`, **delete the key** from both layers. Never write a raw
       configured `defaultValue` back, since that would re-introduce an unresolved relative date token
       (e.g. `"-3 months"`) into the applied layer.
3. Set `activeTab = fromTab` (directly, not via `setActiveTab`).
4. Atomically update the store in a single `set()` call.

### D. Manual Tab Navigation Rule
If the user manually switches tabs using the top `TabsList` navigation buttons (instead of clicking the breadcrumb):
- If `newTab !== activeBreadcrumb.targetTab`: Clear the breadcrumb stack (or hide the breadcrumbs while on an unrelated tab) to prevent confusing cross-navigation breadcrumbs.
- This rule lives in `setActiveTab`, which is also invoked by `useFilterUrlSync` during permalink
  hydration. That is harmless (the stack is empty at hydration time) but should be kept in mind.

### E. Chip Removal Consistency
Drill filters surface as removable chips in `ActiveFilters`. Removing one calls `clearDimension`,
which deletes the key without touching `breadcrumbs`, leaving the breadcrumb asserting a filter that
no longer exists. **Resolution for V1:** when every key in the top breadcrumb's `appliedKeys` has been
removed from `appliedValues`, dismiss that breadcrumb.


---

## 3. UI/UX Components

### A. Chart Context Menu Extension (`components/ChartWrapper/index.tsx`)
In `ChartWrapper`:
1. Receive `tabJumps?: TabJumpConfig[]` (passed from `TabsWrapper`).
2. Filter to outgoing tab jumps where `fromChartID === chartID`.
3. If no matching tab jumps exist for this chart, do not render any tab jump menu items.
4. If matching tab jumps exist:
   - Evaluate jump feasibility based on `selectedRows` (e.g., ensure `selectedRows.length > 0`, all `sourceField`s exist, and single-select targets do not have `uniqueValues.length > 1`).
   - If 1 matching tab jump:
     ```tsx
     <ContextMenuItem
       disabled={!canJump}
       onClick={() => handleTabJump(jump)}>
       <ExternalLink className="size-4 mr-2" />
       {jump.label ?? `Details in \"${jump.targetTab}\" ansehen`}
     </ContextMenuItem>
     ```
   - If multiple tab jumps exist for the chart:
     ```tsx
     <ContextMenuSub>
       <ContextMenuSubTrigger disabled={selectedRows.length === 0}>
         <ArrowRightCircle className="size-4 mr-2" />
         Auf Tab springen
       </ContextMenuSubTrigger>
       <ContextMenuSubContent>
         {matchingJumps.map((jump, index) => (
           <ContextMenuItem
             key={`${jump.targetTab}:${index}`}
             disabled={!canExecuteJump(jump, selectedRows)}
             onClick={() => handleTabJump(jump)}>
             {jump.label ?? jump.targetTab}
           </ContextMenuItem>
         ))}
       </ContextMenuSubContent>
     </ContextMenuSub>
     ```
     The key includes the index because a chart may legitimately define two jumps to the same
     `targetTab` with different `mappings`.

### B. Breadcrumb Component (`components/TabBreadcrumb/index.tsx`)
Create a breadcrumb bar rendered in `components/DashboardShell/index.tsx` directly above `TabsWrapper`:
* Visible only when `breadcrumbs.length > 0 && activeTab === currentBreadcrumb.targetTab`.
* Displays:
  - Back button with icon: `<Button variant="ghost" size="sm" onClick={navigateBack}><ChevronLeft className="size-4 mr-1" /> Zurück zu {breadcrumb.fromTab}</Button>`
  - Informational trail: `Gefiltert nach Auswahl in "${breadcrumb.fromChartTitle ?? breadcrumb.fromChartID}"`
* Clean styling with subtle border and muted background (`bg-muted/50 border rounded-md px-3 py-1.5 text-xs`).

---

## 4. Detailed File-by-File Impact

1. **`types/tabs.d.ts`**
   - Add generic `TabJumpMapping` and `TabJumpConfig<Tconf>` as **non-exported ambient `type`s**
     (this file must stay a global declaration file — see §1).
   - Add `tabJumps?: TabJumpConfig<T>[]` to `DashboardConfig<T>`.
   - Add `tabJumps?: TabJumpConfig[]` to `Props` of `TabsWrapper` and `ChartWrapper`.

2. **`stores/filterProvider.ts`**
   - Add `TabJumpBreadcrumb` type with `previousValues`.
   - Add `breadcrumbs`, `executeTabJump`, `navigateBack`, and `clearBreadcrumbs` to `FilterStoreState`.
   - Extract the `applySelection` merge (draft + applied + `hasApplied` + `activeTab`) into a shared
     helper and build `executeTabJump` on top of it instead of duplicating the commit logic.
   - Reset `breadcrumbs: []` inside `resetFilterStore()`.
   - Handle manual `setActiveTab`: if switching away from `targetTab`, dismiss breadcrumb stack.
   - `clearDimension`: dismiss the top breadcrumb once all of its `appliedKeys` are gone (§2E).

3. **`scripts/pages/generateNextPage.ts`**
   - Update boilerplate generation to include `tabJumps: ${JSON.stringify(dashboardConfig.tabJumps, null, 2)}` in the generated `dashboardConfig` so pages maintain drilldown definitions.
   - **Pre-existing bug to fix in the same change:** the generator currently emits only
     `reportName`, `filterLayout`, `filters`, and `tabs`. `connections` is silently dropped even
     though `DashboardShell` destructures it, so chart connections are dead in generated pages.
     Emit `connections` alongside `tabJumps`.
   - **Migration note:** the generator skips any existing `app/Dashboards/<Name>` folder. Already
     generated pages must be deleted and regenerated (or hand-edited) to pick up `tabJumps` and
     `connections`.

4. **`components/TabsWrapper/index.tsx`**
   - Accept `tabJumps?: TabJumpConfig[]` prop.
   - Forward `tabJumps` to each child `ChartWrapper`.

5. **`components/ChartWrapper/index.tsx`**
   - Accept `tabJumps?: TabJumpConfig[]` prop.
   - Identify applicable tab jumps for `chartID`.
   - Check value extractability & single-select compatibility.
   - Render context menu item(s) conditionally.
   - Dispatch `executeTabJump` on click.

6. **`components/TabBreadcrumb/index.tsx` (New component)**
   - Render breadcrumb navigation and back button.
   - Hook into `useFilterStore` for `breadcrumbs` and `navigateBack`.

7. **`components/DashboardShell/index.tsx`**
   - Pass `config.tabJumps` to `TabsWrapper`.
   - Mount `<TabBreadcrumb />` above `TabsWrapper`.

8. **Documentation Updates**
   - Update `AGENTS.md` and `README.md` to document the `tabJumps` configuration format and drilldown behavior.

---

## 5. Edge Cases & Validation

1. **Lasso & Multi-selection into Single-Select Dimension:**
   - Multi-selection often yields multiple distinct values (e.g., 5 different error codes).
   - If the target dimension is single-select (`select`, `option`, `string`, `number`) and `uniqueValues.length > 1`, disable the jump menu item with a clear explanation rather than arbitrarily picking the first value or emitting an invalid comma-separated string.
2. **Missing Field in Selected Data:**
   - If `sourceField` is not present on `selectedRows`, the jump action is disabled. (Future V2 enhancement can add async tooltip-backed extraction via `POST /api/data/chart/tooltip` if `enhancedTooltip: true`).
3. **Target Dimension Scope & Validation:**
   - Validate that `targetDimensionId` exists, has `scope: "tab"`, and belongs to `tab: targetTab`. Tab drilldowns are strictly scoped to tab-level filters to prevent mutating global filter state on the originating tab.
   - Validate that **no global dimension shares the same `id`**. `ChartWrapper` resolves parameters as
     `filterValues[globalKey(id)] ?? filterValues[tabKey(activeTab, id)]`, so a global entry with a
     value silently shadows the injected `tab:` entry and the drill appears to do nothing.
   - Validate that **at least one chart on `targetTab` binds the dimension** via `filterBindings`.
     Without a binding the drill only produces an `ActiveFilters` chip and changes no query.
   - Reject `dateString` and `dateRange` target dimensions (§2B).
4. **Previous State Restoration on Return:**
   - Preserves whatever filter value existed on `targetTab` prior to the jump, or removes the key
     entirely if it was unset, rather than wiping the filter to `NULL` or re-injecting a raw
     `defaultValue`.
5. **URL Sharing / Snapshots:**
   - Since `executeTabJump` updates `appliedValues` and `activeTab`, `ShareButton` snapshots faithfully capture the drilled tab's **filter state**.
   - **Accepted V1 limitation:** `breadcrumbs` are not part of `FilterSnapshot`. A shared drill
     permalink lands on the filtered tab with no back affordance and no rollback data. The recipient
     clears the drill filters via the `ActiveFilters` chips.

6. **Nested Drilldowns (Tab A $\to$ Tab B $\to$ Tab C):**
   - Handled via `breadcrumbs` stack: each return pops one level and restores the prior level's state.
7. **Manual Tab Switching:**
   - Switching tabs via `TabsList` clears/dismisses the active breadcrumb stack to avoid invalid breadcrumb trails.

---

## 6. Test Coverage

Tooling per `docs/plans/testing-strategy-plan.md` (Vitest; `node` for store logic, `jsdom` +
React Testing Library for the context menu and breadcrumb).

**Store (`stores/filterProvider.ts`) — `node`:**
- `executeTabJump` writes `draftValues`, `appliedValues`, `hasApplied`, `activeTab`, and
  `breadcrumbs` in a single state update (assert via one subscriber notification).
- Multi-value selection into a single-select target returns `false` and mutates nothing.
- Multi-value selection into a `multiselect` target produces a deduplicated `string[]`.
- Non-primitive `sourceField` values (arrays/objects) abort the jump.
- `previousValues` captures `undefined` for unset keys; `navigateBack` then **deletes** the key
  rather than writing back a raw `defaultValue` (regression test with a `"-3 months"` default).
- `navigateBack` restores a pre-existing value and returns to `fromTab`.
- Nested A→B→C: two pops restore each level in order.
- `setActiveTab` to an unrelated tab clears the stack; `executeTabJump` and `navigateBack` do not.
- `clearDimension` on the last remaining `appliedKey` dismisses the breadcrumb.
- `resetFilterStore` empties `breadcrumbs`.

**`ChartWrapper` — `jsdom`:**
- No `tabJumps` for the chart → no jump menu items rendered.
- Menu item disabled with an empty selection, with a missing `sourceField`, and on a
  multi-value → single-select mapping.
- Multiple jumps render a submenu; two jumps to the same `targetTab` both render.

**`generateNextPage.ts` — `node`:**
- Generated page source contains both `connections` and `tabJumps` from the source config.

