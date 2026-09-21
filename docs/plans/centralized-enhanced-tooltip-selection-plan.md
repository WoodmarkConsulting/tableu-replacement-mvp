# Implementation Plan: Centralized Enhanced Tooltip & Selection Decoupling

## 1. Executive Summary & Problem Analysis

### Context
In the dashboard framework, charts allow users to select data marks (bars, line points, pie slices, scatter points, map regions, table rows) to drive **cross-chart connections**, **tab jumps (drilldowns)**, and **enhanced detail tooltips** (`TooltipCard`).

### The Problem & Inconsistencies
Today, tooltip display is coupled directly inside individual chart visualization modules rather than being owned by `ChartWrapper`:

1. **Direct Store Coupling in Modules:**
   Four modules (`BarChartModule`, `LineChartModule`, `PieChartModule`, and `ScatterPlotModule`) import `useTooltipStore` directly and invoke `showTooltipOnClick` whenever `enhancedTooltip: true` is configured and an element is clicked.
2. **Inconsistent UX Across Modules:**
   `MapModule` and `TableModule` do *not* call `showTooltipOnClick` on element click; they only emit `onSelectionChange`. In those modules, the enhanced tooltip can only be opened via the right-click context menu (**Tooltip anzeigen**).
3. **UX Friction in Drilldown & Filtering Workflows:**
   When a user clicks a bar to filter linked charts (especially with `apply: "auto"`) or to prepare a tab jump, popping up a large static detail card immediately obstructs the visualization and swallows subsequent click interactions.
4. **Architectural Contract Violation:**
   `AGENTS.md` specifies:
   > *"`ChartWrapper` also owns selection, enhanced tooltip state, lasso interaction, connection resolution, and the right-click context menu."*
   > *"Each module owns only the chart-specific visual representation of those rows."*
   Modules calling `showTooltipOnClick(...)` breaks this separation of concerns.

### Constraints discovered in the current code (must be respected)

- **`types/baseChart.d.ts` is a global ambient declaration file.** There is not a single
  `from "@/types/baseChart"` import in the repo; `BaseChartProps`,
  `ChartWrapperInjectedProps` and `SelectionChangeOptions` are consumed as globals. Adding a
  top-level `export` converts the file into a module and removes every global declaration.
  (The `import type { ChartWrapperInjectedProps } from "@/types/baseChart"` snippet in
  `AGENTS.md` is stale and must not be used as precedent.)
- **Modules currently branch on the raw `enhancedTooltip` prop for non-tooltip decisions.**
  `ChartWrapper` spreads `{...baseProps}` into the module, and:
  - `BarChartModule` / `LineChartModule`: `normalInteractionEnabled && (selectionEnabled || enhancedTooltip)`
    gates cursor and click handling.
  - `PieChartModule`: `typeof onSelectionChange === "function" || enhancedTooltip === true`.
    A strict `=== true` comparison silently becomes `false` for the new object form.
- **Modules also read the tooltip store to suppress their own hover tooltip.**
  `BarChartModule`, `LineChartModule` and `PieChartModule` subscribe to `state.tooltip`
  (`showEnhancedTooltip = !!enhancedTooltipData`) and render their Recharts tooltip only when
  no static card is open. Deleting the store subscription without a replacement makes both
  tooltips render at once.
- **`showTooltipOnClick` clears the staged connection action.** `_getTooltipData` in
  `stores/tooltip.ts` synchronously calls `useFiltersStore.getState().clearPendingAction()`.
  Today modules call it *before* `onSelectionChange`, so the `stagePendingAction` inside the
  awaited `resolveConnectionFilters` always wins. Centralizing both calls makes that ordering
  implicit and it must be pinned down deliberately.
- **`TableModule` and `MapModule` always select additively** (`onSelectionChange(rows, { additive: true })`),
  so any `position` they emit would re-trigger the tooltip on every single row/region click.
- **`tsc --noEmit` is not clean on `main`** (~51 pre-existing `chartID` / `TableSchemaKey`
  errors in generated `app/Dashboards/*/page.tsx`). Acceptance must be "no new errors", not
  "exit 0".

---

## 2. Target Clean Architecture

### Core Design Principles
1. **Modules Only Report Selection & Position:**
   Chart modules must not decide when to render the enhanced tooltip and must not call
   `showTooltipOnClick`. Their sole responsibility on click/lasso is to invoke the injected
   callback:
   ```ts
   onSelectionChange(rows, { additive, position: { x: event.clientX, y: event.clientY } });
   ```
2. **Modules Never See the Tooltip Configuration:**
   `enhancedTooltip` stays a *dashboard config* property (`BaseChartProps`) but is removed from
   the *injected* props. Modules gate interactivity purely on `typeof onSelectionChange === "function"`.
   Typing `ChartWrapperInjectedProps` as `Omit<BaseChartProps<C>, "enhancedTooltip">` turns every
   remaining module reference into a compile error, so the silent `=== true` trap cannot survive.
3. **Hover Suppression Becomes an Injected Boolean:**
   `ChartWrapper` injects `staticTooltipOpen: boolean` (true when the static card belongs to this
   chart). Bar/Line/Pie replace `showEnhancedTooltip` with that prop. This keeps "no module writes
   to the tooltip store" achievable without losing the suppression behaviour.
4. **`ChartWrapper` Owns Tooltip Presentation:**
   `ChartWrapper` handles the incoming `onSelectionChange`:
   - It updates the selected rows in state.
   - It initiates connection resolution and auto-application.
   - It checks whether the tooltip is enabled AND configured to open on selection. If so, it
     invokes `showTooltipOnClick` with the **resulting** selection (`nextRows`).
   - If it does not open the card, and a card for this chart is currently open, it hides it so
     no stale selection stays on screen.
   - The right-click context menu always retains **Tooltip anzeigen** whenever the tooltip is
     enabled and rows are selected (opens at the context-menu coordinates).
5. **Lasso Selection Alignment:**
   `handleLassoSelection` forwards the release position unconditionally; the same central rule in
   `handleSelectionChange` decides whether a card opens.

---

## 3. Declarative Configuration Specification

To give dashboard authors granular control without breaking existing dashboard configurations, `enhancedTooltip` will support both a **boolean shorthand** (backward-compatible) and an **object configuration**.

### Type Definition (`types/baseChart.d.ts`)

> The file is a **global script file**. Declare the new types without `export`, exactly like the
> existing declarations. Adding `export` here would break every global type in the repo.

```typescript
type EnhancedTooltipConfig = {
  /**
   * Whether the enhanced tooltip feature is enabled for this chart.
   * When true, the tooltip query executes and "Tooltip anzeigen" is available in the context menu.
   * Defaults to true when the object is provided.
   */
  enabled?: boolean;

  /**
   * Whether to automatically open the static detail tooltip card upon selection (click or lasso).
   * - true: opens the tooltip card immediately at the click / lasso release point.
   * - false: does not open the card on selection. The selection is still made and connections/drills
   *          are still executed. The user can view the card on demand via right-click -> "Tooltip anzeigen".
   * Defaults to true when enhancedTooltip is enabled.
   */
  openOnSelection?: boolean;
};

type EnhancedTooltipProp = boolean | EnhancedTooltipConfig;
```

Update `BaseChartProps` (the dashboard-config surface, still carries the raw prop):
```typescript
type BaseChartProps<C extends ChartConfigs = ChartConfigs> = {
  chartTitle?: string;
  chartDescription: string;
  chartID: TableSchemaKey;
  enhancedTooltip?: EnhancedTooltipProp;
  lassoEnabled?: boolean;
  chartConfig: C;
};
```

Update `ChartWrapperInjectedProps` (the module surface — raw prop removed, hover-suppression flag added):
```typescript
interface ChartWrapperInjectedProps<
  D extends ChartDataTemplate,
  C extends ChartConfigs = ChartConfigs,
> extends Omit<BaseChartProps<C>, "enhancedTooltip"> {
  // ...unchanged members...
  // True while the wrapper-owned static tooltip card is open for this chart.
  staticTooltipOpen: boolean;
}
```

Update `SelectionChangeOptions`:
```typescript
// `additive` toggles the passed rows against the current selection (click
// multi-select); omitting it replaces the selection (lasso / single click).
// `position` is the viewport coordinate the wrapper uses when it opens the
// static tooltip; modules always report it, the wrapper decides whether to use it.
type SelectionChangeOptions = {
  additive?: boolean;
  position?: { x: number; y: number };
};
```

### Dashboard JSON Examples (`pagesConfig/*.json`)

#### A. Shorthand (Existing Behavior — fully backward-compatible)
```json
{
  "chartID": "3342fe24-5ed3-4560-b6e8-b6cdfcc776e1",
  "moduleName": "BarChartModule",
  "enhancedTooltip": true
}
```
*Result:* Tooltip enabled; opens immediately on bar click or lasso selection; available in context menu.

#### B. Selection-Only / Drilldown Mode (New Capability)
```json
{
  "chartID": "3342fe24-5ed3-4560-b6e8-b6cdfcc776e1",
  "moduleName": "BarChartModule",
  "enhancedTooltip": {
    "openOnSelection": false
  }
}
```
*Result:* Tooltip enabled; clicking a bar filters linked charts and selects the bar without opening the card; right-click context menu allows inspecting details via "Tooltip anzeigen".

#### C. Fully Disabled
```json
{
  "chartID": "3342fe24-5ed3-4560-b6e8-b6cdfcc776e1",
  "moduleName": "BarChartModule",
  "enhancedTooltip": false
}
```
*Result:* Tooltip disabled completely; no tooltip query, no card, "Tooltip anzeigen" context menu item disabled.

### Per-module default for `openOnSelection`

The shorthand `true` must not change behaviour for modules that never opened a card on click.
`pagesConfig/productionNumbers.json` contains a `TableModule` with `enhancedTooltip: true`; under a
naive normalization every row click would suddenly pop a full detail card over the table (and both
`TableModule` and `MapModule` select additively, so every click would re-query).

Decision: **`TableModule` and `MapModule` do not emit `position` in this change.** They keep their
current context-menu-only behaviour, and `openOnSelection` is a no-op for them. Adding click-to-open
for those modules is a separate, explicitly requested UX change. This keeps the compatibility claim
true and keeps this refactor behaviour-preserving for every existing dashboard.

---

## 4. Normalization Helper

Lives in `components/ChartWrapper/utils.ts` (a real module, so it may export). It consumes the
global `EnhancedTooltipProp` type without importing it.

```typescript
export type NormalizedEnhancedTooltip = {
  enabled: boolean;
  openOnSelection: boolean;
};

export function resolveEnhancedTooltip(
  prop?: EnhancedTooltipProp,
): NormalizedEnhancedTooltip {
  if (typeof prop === "boolean") {
    return {
      enabled: prop,
      openOnSelection: prop,
    };
  }

  if (typeof prop === "object" && prop !== null) {
    const enabled = prop.enabled ?? true;
    return {
      enabled,
      openOnSelection: enabled ? (prop.openOnSelection ?? true) : false,
    };
  }

  return {
    enabled: false,
    openOnSelection: false,
  };
}
```

The "should the card open now" decision is extracted as a pure function in the same file so it is
unit-testable without rendering:

```typescript
export function shouldOpenTooltipForSelection(
  config: NormalizedEnhancedTooltip,
  selectedRowCount: number,
  position?: { x: number; y: number },
): boolean {
  return (
    config.enabled &&
    config.openOnSelection &&
    selectedRowCount > 0 &&
    position !== undefined
  );
}
```

---

## 5. Detailed Component Changes

### 5.1 `components/ChartWrapper/index.tsx`

1. **Destructure `enhancedTooltip` out of the rest object** so it is no longer part of `baseProps`
   and therefore no longer reaches the module via `{...baseProps}`:
   ```typescript
   const {
     moduleName,
     mockData,
     enhancedTooltip,
     // ...existing destructured members...
     ...baseProps
   } = props;
   ```
2. **Normalize once, as a plain call** (not inside `useMemo`: the React Compiler rule
   `react-hooks/preserve-manual-memoization` errors on deps taken from a rest object, and the
   helper is trivial):
   ```typescript
   const tooltipConfig = resolveEnhancedTooltip(enhancedTooltip);
   ```
3. **Inject the hover-suppression flag** into the module:
   ```typescript
   staticTooltipOpen={tooltipChartID === chartID && tooltip !== null}
   ```
4. **Update `handleSelectionChange`.** Two corrections over the naive version: the tooltip must
   mirror the *resulting* selection (`nextRows`, not the incoming `rows`, which is only the clicked
   row in additive mode), and an already-open card for this chart must be dismissed when it is not
   being reopened — otherwise a card opened from the context menu keeps showing a stale selection.
   ```typescript
   const handleSelectionChange = (
     rows: DataType[],
     options?: SelectionChangeOptions,
   ) => {
     // ...existing additive merge into `nextRows`, setSelection, selectionRef...

     // Order is load-bearing: showTooltipOnClick synchronously calls
     // clearPendingAction, so it must run before resolveConnectionFilters stages.
     if (
       shouldOpenTooltipForSelection(
         tooltipConfig,
         nextRows.length,
         options?.position,
       )
     ) {
       showTooltipOnClick({
         chartID,
         dataPoints: nextRows as TooltipDataPoint[],
         position: options!.position!,
       });
     } else if (useTooltipStore.getState().chartID === chartID) {
       hideTooltip();
     }

     void resolveConnectionFilters(nextRows);
   };
   ```
   `clearSelection` keeps its own `hideTooltip` call; the branch above makes it redundant but
   harmless.
5. **Update `handleLassoSelection`** — always forward the release position and let the central rule
   decide:
   ```typescript
   const handleLassoSelection = (
     rows: DataType[],
     tooltipPosition: { x: number; y: number },
   ) => {
     handleSelectionChange(rows, { position: tooltipPosition });
   };
   ```
   The explicit `showTooltipOnClick` call currently in this function is removed.
6. **Replace the three remaining `baseProps.enhancedTooltip` truthiness checks** with
   `tooltipConfig.enabled`:
   - `showSelectedTooltip` guard.
   - "Tooltip anzeigen" disabled state: `!tooltipConfig.enabled || selectedRows.length === 0`.
   - Tooltip card render gate stays `tooltipChartID === chartID`.

### 5.2 Modules Cleanup

For `BarChartModule`, `LineChartModule`, `PieChartModule`, `ScatterPlotModule`:

1. Remove the `useTooltipStore` import and the `showTooltipOnClick` call from the click handler.
2. Remove `enhancedTooltip` from the props destructure. `ChartWrapperInjectedProps` now omits it,
   so any missed reference fails type-check — this is the safety net for the `PieChartModule`
   `=== true` trap.
3. Replace the interaction gates that referenced it:
   - Bar/Line: `normalInteractionEnabled && (selectionEnabled || enhancedTooltip)` →
     `normalInteractionEnabled && selectionEnabled`.
   - Pie: `typeof onSelectionChange === "function" || enhancedTooltip === true` →
     `typeof onSelectionChange === "function"`.
   `ChartWrapper` always passes `onSelectionChange`, so no interaction is lost.
4. Replace `showEnhancedTooltip = !!enhancedTooltipData` with the injected `staticTooltipOpen` in
   the hover-tooltip render conditions (Bar, Line, Pie). `ScatterPlotModule` has no such
   subscription and only drops the `showTooltipOnClick` call plus its `useCallback` dependency.
5. Pass the click position through the existing callback, merged with `additive`:
   - Bar (`handleChartClick`), Pie, Scatter: `{ additive, position: { x: event.clientX, y: event.clientY } }`
     (Scatter uses `sourceEvent`).
   - Line (`handleChartClick`): `{ position: { x: event.clientX, y: event.clientY } }`.
6. `modules/MapModule/index.tsx` and `modules/TableModule/index.tsx`: **no behavioural change.**
   They only gain the `staticTooltipOpen` prop in their type surface (unused). See "Per-module
   default for `openOnSelection`" above.

### 5.3 Validation in `lib/validateDashboardConfig.ts`

`enhancedTooltip` is currently unvalidated. Add a check inside the existing
`for (const chart of charts.values())` loop, next to the `autoApplyConnections` legacy guard, using
the same `Chart "<chartID>" …` message style:

- `undefined` and `boolean` pass.
- An object must have only the keys `enabled` and `openOnSelection`, each `boolean` when present.
  Any other key or type throws
  `Chart "<chartID>" has an invalid enhancedTooltip configuration: …`.
- Any other type (string, number, array, `null`) throws.

The validator already runs on the generation path, so a malformed config fails
`npm run pageConfig:generatePage` rather than surfacing at runtime.

### 5.4 Documentation Updates

- Update `modules/instructions.md` and the `instructions.md` of every module touched in 5.2
  (`BarChartModule`, `LineChartModule`, `PieChartModule`, `ScatterPlotModule`). The pre-commit hook
  requires both the module-level and the top-level instructions to be staged with any change under
  `modules/<ModuleName>/`.
- Document `staticTooltipOpen` in the injected-props section of each module's instructions.
- Update `AGENTS.md` (enhanced tooltip / selection section) with the `enhancedTooltip` object schema
  and the `openOnSelection` rule, including the Table/Map exception.
- Run `npm run module:validate` and `npm run module:validateDocs`.

---

## 6. Test Plan

> **Infrastructure constraint:** `vitest.config.mts` runs `environment: "node"` with
> `include: ["tests/**/*.test.ts", "**/*.test.ts"]`, and there is no `jsdom` /
> `@testing-library/react` in `devDependencies`. A `.tsx` component test would neither be picked
> up nor run. React-level behaviour is therefore covered by Playwright, and the decision logic is
> covered by pure unit tests against the extracted helpers.

### 6.1 Unit Tests: Normalization & Decision
Location: `tests/enhancedTooltipConfig.test.ts`

- **T1.1 (Boolean true):** `resolveEnhancedTooltip(true)` → `{ enabled: true, openOnSelection: true }`.
- **T1.2 (Boolean false):** `resolveEnhancedTooltip(false)` → `{ enabled: false, openOnSelection: false }`.
- **T1.3 (Undefined/Omitted):** `resolveEnhancedTooltip(undefined)` → `{ enabled: false, openOnSelection: false }`.
- **T1.4 (Object with `openOnSelection: false`):** → `{ enabled: true, openOnSelection: false }`.
- **T1.5 (Object with `enabled: false`):** `{ enabled: false, openOnSelection: true }` → `{ enabled: false, openOnSelection: false }`.
- **T1.6 (Decision — open):** `shouldOpenTooltipForSelection({ enabled: true, openOnSelection: true }, 2, { x: 1, y: 2 })` → `true`.
- **T1.7 (Decision — empty result selection):** same config, `selectedRowCount: 0` → `false`.
  Covers the additive-deselect case where the incoming `rows` array is non-empty but the resulting
  selection is empty.
- **T1.8 (Decision — no position):** same config, position `undefined` → `false` (context-menu path
  and modules that do not report a position).
- **T1.9 (Decision — suppressed):** `{ enabled: true, openOnSelection: false }` → `false`.

### 6.2 Validation Tests
Location: `tests/enhancedTooltipConfig.test.ts` (same file)

- **T1.10:** `validateDashboardConfig` accepts `true`, `false`, omitted, `{}`,
  `{ "openOnSelection": false }`, `{ "enabled": false }`.
- **T1.11:** It rejects `"true"`, `1`, `null`, `[]`, and `{ "openOnHover": true }` with a message
  naming the offending `chartID`.

### 6.3 End-to-End Tests (Playwright)

**New fixture, not a mutation of the existing one.** `tests/e2e/connectionAcceptance.spec.ts`
depends on tooltip-on-click (the helper that closes "Tooltip schließen" before right-clicking, and
the `warehouse.tooltipCalls` assertions). Flipping "Produktion je ECU" to `openOnSelection: false`
would break those tests and make the backward-compatibility case untestable.

Add a second bar chart (or a dedicated tab) to `pagesConfig/connectionAcceptance.json` configured
with `"enhancedTooltip": { "openOnSelection": false }`, wired to the same auto-apply connection,
and regenerate the page.

- **T3.1 (Auto-connection without tooltip interference):** on the new chart —
  1. Hover → wait → click a bar (Recharts v3 requires the preceding mouse-move).
  2. The bar is visually selected.
  3. `TooltipCard` does **not** appear in the DOM.
  4. The auto-connected table updates its filter parameter (assert the posted params via
     `warehouseMock`).
  5. A second bar can be clicked directly, with no "Tooltip schließen" step in between.
- **T3.2 (Context-menu inspection):** with a row selected on the new chart, right-click →
  **Tooltip anzeigen** opens `TooltipCard`, and the footer action "Verknüpfte Diagramme filtern"
  still applies the staged contributions. This is the regression test for the
  `clearPendingAction` / `stagePendingAction` ordering.
- **T3.3 (Stale card dismissal):** with the card open from T3.2, click a different bar →
  the card closes instead of showing the previous selection.
- **T3.4 (Backward compatibility):** the existing "Produktion je ECU" chart
  (`enhancedTooltip: true`) still opens the card on click and still issues exactly one batched
  tooltip request — i.e. the existing spec keeps passing unchanged.
- **T3.5 (Lasso parity):** a lasso gesture on the `openOnSelection: false` chart selects points and
  resolves connections without opening the card.
- **T3.6 (Table regression):** a `TableModule` with `enhancedTooltip: true` still opens no card on
  row click.

---

## 7. Success Metrics

1. **Zero Module Coupling:**
   No module under `modules/` imports `useTooltipStore` or calls `showTooltipOnClick`; hover
   suppression runs entirely off the injected `staticTooltipOpen` prop.
2. **No Module Reads the Tooltip Config:**
   `enhancedTooltip` does not appear in any file under `modules/`, enforced by the
   `Omit<…, "enhancedTooltip">` on `ChartWrapperInjectedProps`.
3. **Behaviour-Preserving for Existing Dashboards:**
   `pagesConfig/connectionAcceptance.json` and `pagesConfig/productionNumbers.json` need no edits
   other than the new E2E fixture chart, and the existing E2E spec passes unchanged.
4. **Clean Contract Validation:**
   `npm run module:validate`, `npm run module:validateDocs`, `pnpm exec eslint .` (baseline: 1
   known `react-hooks/incompatible-library` warning in `TableModule`) pass, and
   `pnpm exec tsc --noEmit` shows **no new errors versus the ~51-error baseline** in generated
   pages.
5. **Unobstructed User Workflows:**
   Dashboards configured with `openOnSelection: false` filter and drill without a card appearing,
   and no card ever shows a selection that is no longer active.
6. **Full Test Suite Green:**
   `pnpm exec vitest run` and `pnpm test:e2e` pass reliably.

---

## 8. Implementation Order

1. Types (`types/baseChart.d.ts`, ambient) + helpers in `components/ChartWrapper/utils.ts` + unit
   tests T1.1–T1.9. Green before touching components.
2. `ChartWrapper` (§5.1). At this point modules still compile but their own
   `showTooltipOnClick` calls duplicate the wrapper's — expect a transient double tooltip; do not
   commit here.
3. Module cleanup (§5.2) driven by the type errors from the `Omit`, one module at a time, plus the
   matching `instructions.md` updates in the same commit.
4. Validation (§5.3) + tests T1.10/T1.11.
5. E2E fixture chart, page regeneration, and specs T3.1–T3.6.
6. `AGENTS.md` update.

---

## 9. Explicitly Out of Scope

- **Duplicate tooltip requests.** `resolveConnectionFilters` already POSTs
  `/api/data/chart/tooltip` for the same rows, and `showTooltipOnClick` fires a second request;
  the `lastTooltipResponse` cache in `components/ChartWrapper/utils.ts` only helps when the first
  request already resolved. This refactor keeps that behaviour unchanged. Sharing one resolved
  response between the card and the connection resolution is a worthwhile follow-up, but mixing it
  in here would couple two independent abort/ordering mechanisms (`_abortController` vs.
  `connectionRequestRef`) in the same change.
- **Click-to-open tooltips for `TableModule` / `MapModule`.** Requires a UX decision and a
  dashboard config migration; see "Per-module default for `openOnSelection`".
- **jsdom / React Testing Library setup for component tests.** Track separately if wanted; not
  required for this change.
