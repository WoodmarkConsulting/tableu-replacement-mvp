# Chart Selection Tab Jump ("Drill-to-Tab") — Implementation Plan

## Overview & Goal
Enable users to select data points (via single click, multi-point selection, or lasso selection) in any selection-capable chart module and drill down into another dashboard tab with that selection automatically passed into the target tab's filters. 

The user triggers the jump via a right-click context menu action. The target tab receives the selected values as tab-level filters (`tab:<targetTab>:<dimId>`), immediately applies them (updating both draft and applied filter layers so queries run without an extra "Apply" click), switches the active tab, and displays a breadcrumb allowing the user to navigate back and optionally clear the drill filters.

---

## Confirmed Requirements
1. **Trigger:** Right-click context menu on the chart (`ContextMenu`). An item such as *"Auf Tab springen"* / *"Drilldown: [Target Tab Name]"* appears when valid rows are selected and a tab navigation is configured for that chart.
2. **Configuration:** Explicit configuration in dashboard JSON (`tabJumps` or `tabDrilldowns`).
3. **Filter Scope:** Sets **tab-level filter dimensions** in the target tab (`scope: "tab"`, `tab: targetTab`).
4. **Selection Types:** Supports single row click, multi-row selection, and lasso selection. Values map to single values or string arrays (e.g., for `multiselect` dimensions).
5. **Breadcrumb / Return:** A breadcrumb appears in the header/tab bar when navigated via drilldown, showing the previous tab origin and allowing a single-click return.

---

## 1. Declarative Configuration Spec

Add `tabJumps` to `DashboardConfig` in `types/tabs.d.ts`:

```typescript
export type TabJumpMapping = {
  // Column from selected chart data (or resolved tooltip data)
  sourceField: string;
  // Target filter dimension ID on the target tab
  targetDimensionId: string;
};

export type TabJumpConfig = {
  fromChartID: string;
  targetTab: string;
  label?: string; // Optional context menu label, e.g. "Details in [Tab] ansehen"
  mappings: TabJumpMapping[];
  // If true, clears the drilled tab filters when returning via breadcrumb (default: true)
  clearOnReturn?: boolean;
};

export type DashboardConfig<T extends TabsConfig[] = TabsConfig[]> = {
  reportName: string;
  filterLayout: "sidebar" | "top";
  filters: FilterDimension<T>[];
  tabs: T;
  connections?: ChartConnection<T>[];
  tabJumps?: TabJumpConfig[];
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

### A. Navigation & Breadcrumb History Store
Manage tab jump navigation state using Zustand. We can extend `stores/filterProvider.ts` or create a lightweight `stores/tabJumpStore.ts`. Keeping it coupled with filter navigation in `stores/filterProvider.ts` (or a dedicated `stores/tabJumpStore.ts`) ensures clean reset on dashboard switch.

State shape:
```typescript
export type TabJumpBreadcrumb = {
  fromTab: string;
  fromChartID: string;
  fromChartTitle?: string;
  targetTab: string;
  appliedKeys: string[]; // List of tab:<tab>:<dimId> keys injected by the drill
};

// Store additions:
breadcrumbs: TabJumpBreadcrumb[];
pushTabJump: (jump: TabJumpBreadcrumb) => void;
popTabJump: () => TabJumpBreadcrumb | undefined;
clearBreadcrumbs: () => void;
```

### B. Filter Application Mechanism
When jumping, we utilize the existing `applySelection(entries, navigateTo)` on `useFilterStore`:
1. For each mapping in `tabJump.mappings`:
   - Extract values of `sourceField` from all `selectedRows`.
   - Deduplicate values.
   - Match target dimension:
     - If target dimension is `multiselect`: value is `string[]`.
     - If target dimension is single-select/string/number and length == 1: value is `values[0]`.
     - If multi-value selected for single-select: fallback to first or join depending on dimension definition.
   - Create key `tab:<targetTab>:<targetDimensionId>`.
2. Record `appliedKeys` in `TabJumpBreadcrumb`.
3. Call `applySelection(filterEntries, targetTab)`:
   - This writes directly to `draftValues` and `appliedValues`.
   - Sets `hasApplied = true`.
   - Switches `activeTab = targetTab`.
   - Triggers re-fetch for charts bound to those dimensions in the target tab immediately.

---

## 3. UI/UX Components

### A. Chart Context Menu Extension (`components/ChartWrapper/index.tsx`)
In `ChartWrapper`:
1. Receive `tabJumps?: TabJumpConfig[]` (passed from `TabsWrapper`).
2. Identify outgoing tab jumps where `fromChartID === chartID`.
3. In `ContextMenuContent`, below `Verlinktes Diagramm filtern`, render a new section:
   - If there is 1 matching tab jump:
     ```tsx
     <ContextMenuItem
       disabled={selectedRows.length === 0}
       onClick={() => handleTabJump(jump)}>
       <ExternalLink className="size-4 mr-2" />
       {jump.label ?? `Details in \"${jump.targetTab}\" filtern`}
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
         {tabJumps.map(jump => (
           <ContextMenuItem key={jump.targetTab} onClick={() => handleTabJump(jump)}>
             {jump.label ?? jump.targetTab}
           </ContextMenuItem>
         ))}
       </ContextMenuSubContent>
     </ContextMenuSub>
     ```

### B. Breadcrumb Component (`components/TabBreadcrumb/index.tsx`)
Create a new breadcrumb bar displayed right above the tab list in `components/DashboardShell/index.tsx` (or inside `TabsWrapper`):
* Shows: `[Original Tab: <fromTab>] > [<targetTab> (Gefiltert durch <fromChartTitle>)]`
* Clicking `[Original Tab: <fromTab>]`:
  - Optionally clears the injected `appliedKeys` in filterStore (clean return).
  - Pops the breadcrumb.
  - Sets `activeTab` back to `fromTab`.
* Includes an optional small "Filter aufheben & zurück" button.

---

## 4. Detailed File-by-File Impact

1. **`types/tabs.d.ts`**
   - Add `TabJumpMapping`, `TabJumpConfig`.
   - Add `tabJumps?: TabJumpConfig[]` to `DashboardConfig`.
   - Add `tabJumps?: TabJumpConfig[]` to `Props` of `TabsWrapper` and `ChartWrapper`.

2. **`stores/filterProvider.ts` (or `stores/tabJumpStore.ts`)**
   - Add breadcrumb history state:
     - `drillBreadcrumbs: TabJumpBreadcrumb[]`
     - `executeTabJump(jump: TabJumpBreadcrumb, filterEntries: Record<string, FilterValue>)`
     - `navigateBack(clearFilters?: boolean)`
   - Ensure clean reset in `resetFilterStore()`.

3. **`components/TabsWrapper/index.tsx`**
   - Accept `tabJumps?: TabJumpConfig[]` from `DashboardShell`.
   - Forward `tabJumps` down to each `ChartWrapper`.

4. **`components/ChartWrapper/index.tsx`**
   - Accept `tabJumps`.
   - Compute applicable tab jumps for the current `chartID`.
   - Extract mapped filter values from `selectedRows` on trigger.
   - Render the context menu item(s).
   - Dispatch `executeTabJump`.

5. **`components/TabBreadcrumb/index.tsx` (New component)**
   - Render breadcrumb navigation bar with back arrow and jump trail.
   - Accessible and styled with Tailwind / Lucide icons (`ChevronLeft`, `CornerUpLeft`, etc.).

6. **`components/DashboardShell/index.tsx`**
   - Pass `config.tabJumps` to `TabsWrapper`.
   - Mount `<TabBreadcrumb />` above `TabsWrapper`.

7. **Documentation Updates**
   - Update `AGENTS.md` and `README.md` to document the new `tabJumps` config syntax and flow.

---

## 5. Edge Cases & Validation

1. **Lasso & Multi-selection:**
   - Multi-selection can yield 100+ items. Ensure target dimension is `multiselect` or handle slicing/joining safely.
   - Verify that arrays serialize properly according to the dimension's expected format.
2. **Missing Field in Selected Data:**
   - If `sourceField` is not present on the selected chart data points, log a descriptive warning in dev mode and disable the context menu option or notify the user.
3. **Target Dimension Scope:**
   - Validate that the target dimension specified in `targetDimensionId` actually exists and has `scope: "tab"` with `tab: targetTab`.
4. **URL Sharing / Snapshots:**
   - Since `applySelection` updates `appliedValues` and `activeTab`, `ShareButton` snapshotting will preserve the state of the drilled tab when creating a share link.
5. **Breadcrumb Stack Limits:**
   - Handle nested jumps gracefully (Tab A -> Tab B -> Tab C).
