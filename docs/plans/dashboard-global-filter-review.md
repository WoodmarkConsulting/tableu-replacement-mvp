# Implementation Review: Dashboard-Global Filter Action Target

_Reviewed: 2026-09-24 · Branch: main (uncommitted working tree)_

## Summary of Changes

The change introduces `{ kind: "dashboard" }` as a first-class action target scope in the declarative actions framework, allowing chart selections and drilldowns to produce dashboard-wide filter contributions that apply to every chart across all tabs.

- **Target Model & Types**:
  Extended `ActionTarget` in [types/tabs.d.ts](types/tabs.d.ts#L44-L50) with `| { kind: "dashboard" }`, documenting that navigation remains tab-only.
- **Contribution Resolution**:
  Extended `resolveActionContributions` in [lib/filters/actions.ts](lib/filters/actions.ts#L201-L208) to construct `{ kind: "dashboard" }` filter targets with `source.kind: "chartSelection"`.
- **Validation**:
  Added validation in [lib/validateDashboardConfig.ts](lib/validateDashboardConfig.ts#L131-L155) accepting `target.kind === "dashboard"` and rejecting `navigate` on dashboard targets.
- **Context Menu UI**:
  Added a dedicated "Dashboardweit" group to the chart context menu in [components/ChartWrapper/index.tsx](components/ChartWrapper/index.tsx#L944-L983), rendering individual dashboard actions and an "Alle filtern" batch option when multiple executable dashboard actions exist. Excluded dashboard targets from the tab-relative lists in [components/ChartWrapper/index.tsx](components/ChartWrapper/index.tsx#L551-L578).
- **Documentation & Unit Tests**:
  Updated [AGENTS.md](AGENTS.md#L203-L225) and [README.md](README.md#L227-L235) to describe dashboard-wide action targets. Added contribution resolution test in [tests/actionsResolver.test.ts](tests/actionsResolver.test.ts#L299-L320) and validation tests in [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts#L597-L633).

---

## Alignment with Plan

| Planned Task | Status | Notes |
| :--- | :--- | :--- |
| 1. Add `{ kind: "dashboard" }` to `ActionTarget` | **Implemented** | [types/tabs.d.ts](types/tabs.d.ts#L46-L50) |
| 2. Build `{ kind: "dashboard" }` in `resolveActionContributions` | **Implemented** | [lib/filters/actions.ts](lib/filters/actions.ts#L201-L208) |
| 3. Validate target kind & reject `navigate` | **Implemented** | [lib/validateDashboardConfig.ts](lib/validateDashboardConfig.ts#L131-L155) |
| 4. Context menu "Dashboardweit" group + "Alle filtern" | **Implemented** | [components/ChartWrapper/index.tsx](components/ChartWrapper/index.tsx#L944-L983) |
| 5. Exclude dashboard targets from current/other tab filters | **Implemented** | [components/ChartWrapper/index.tsx](components/ChartWrapper/index.tsx#L551-L578) |
| 6. Store execution verification | **Verified** | Scope-agnostic fallthrough in [stores/filterProvider.ts](stores/filterProvider.ts#L473-L495) handles dashboard targets without changes. |
| 7. Unit tests for resolver and validation | **Implemented** | [tests/actionsResolver.test.ts](tests/actionsResolver.test.ts#L299-L320), [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts#L597-L633) |
| 8. Composition unit test (dashboard control + dashboard action) | **Deferred / Missing** | Planned composition test for the same dimension was not added to [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts). |
| 9. Documentation updates in agent and project guides | **Implemented** | [AGENTS.md](AGENTS.md#L203-L225), [README.md](README.md#L227-L235) |

**Scope Creep Assessment**: None. The changes stay focused strictly on the planned authoring and context menu capabilities.

---

## Code Quality Observations

1. **Separation of Concerns & Store Integration**:
   - The integration cleanly leverages the unified filtering model. Because `contributionAppliesTo` in [lib/filters/contributions.ts](lib/filters/contributions.ts#L30-L31) already returns `true` for `{ kind: "dashboard" }`, and [components/ActiveFilters/index.tsx](components/ActiveFilters/index.tsx#L73-L116) displays non-control contributions as "via Auswahl" chips with remove buttons, no changes were needed in the store or chip display layers.
2. **Execution Memoization**:
   - `isActionExecutable` in [components/ChartWrapper/index.tsx](components/ChartWrapper/index.tsx#L584-L605) is wrapped in `useCallback` with stable dependencies (`dimensions`, `selectedActionContributions`, `selectedRows`).
   - `executableDashboardActions` and `dashboardActions` are cleanly derived and memoized.
3. **Context Menu Separator Conditioning**:
   - Separator logic in [components/ChartWrapper/index.tsx](components/ChartWrapper/index.tsx#L944-L948) (`dashboardActions.length > 0 && (currentTabActions.length > 0 || otherTabActions.length > 0)`) prevents orphaned separators when earlier groups are empty.
4. **Validation Omission: Cycle Detection Graph** _(verified against working tree)_:
   - In [lib/validateDashboardConfig.ts](lib/validateDashboardConfig.ts#L219-L242), the directed graph used to detect circular action dependencies handles `action.target.kind === "chart"` and `action.target.kind === "tab"`, but completely skips `action.target.kind === "dashboard"`.
   - If an action targets `dashboard`, all charts in the dashboard that bind the target dimension are impacted. Omitting this allows undetected circular dependencies (see Operational & Risk Notes).
5. **Validation Omission: Unbound Dimension Check** _(verified against working tree)_:
   - In the mapping loop of [lib/validateDashboardConfig.ts](lib/validateDashboardConfig.ts#L184-L203), `target.kind === "chart"` checks that the target chart binds the dimension, and `target.kind === "tab"` checks that at least one chart on that tab binds it. There is no `else` branch for `dashboard`.
   - For `target.kind === "dashboard"`, there is no check ensuring that at least one chart across the dashboard binds the targeted dimension. A misconfigured action targeting an unbound dimension will fail silently at runtime.
6. **Shared Root Cause (Exhaustiveness)**:
   - Omissions #4 and #5 stem from the same pattern: both loops enumerate `chart` and `tab` and silently fall through for `dashboard`. Neither the mapping-validation loop nor the cycle-graph builder switches exhaustively on `action.target.kind`. A `switch` with a `never`-typed default would have surfaced both gaps at compile time when `{ kind: "dashboard" }` was added, and would prevent recurrence when a fourth target kind is introduced.
6. **Context Menu Label Ambiguity**:
7. **Context Menu Label Ambiguity**:
   - In [components/ChartWrapper/index.tsx](components/ChartWrapper/index.tsx#L960), the label defaults to `"Dashboardweit filtern"`. If a chart has multiple dashboard-wide actions without explicit `label` properties (e.g., one filtering region and one filtering department), both context menu items will render with identical text. Cosmetic only.

---

## Test Coverage Assessment

- **Existing Coverage (Passing)**:
  - [tests/actionsResolver.test.ts](tests/actionsResolver.test.ts#L299-L320): Verifies `resolveActionContributions` correctly outputs `{ kind: "dashboard" }` target and a matching `contributionKey`.
  - [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts#L597-L633): Verifies `validateDashboardConfig` accepts `{ kind: "dashboard" }` and rejects `navigate` on dashboard targets.
- **Missing Coverage**:
  - **Composition of Dashboard Action with Dashboard Control**: The plan explicitly called for testing that a dashboard-targeted action composes with a dashboard control for the same dimension (e.g., control allows `["EU", "US"]`, chart selection applies `["EU"]`, resulting in `["EU"]` under default intersection). Risk is a regression guard rather than untested logic: composition is dimension-level and target-agnostic, so it is already exercised by existing tab/control tests. Worth adding, but lower urgency than the validation gaps.
  - **Cycle Detection**: No test verifies that circular action dependencies involving `{ kind: "dashboard" }` are detected.
  - **Active Filters UI Verification**: No test validates that a dashboard-targeted contribution renders on all tabs in `ActiveFilters` tagged with `"via Auswahl"`.

---

## Operational & Risk Notes

### 1. Architectural Risk: Self-Targeting Selection Erasure Loop _(verified against working tree)_
Note that `tab` targets are **already protected** from this loop: when `fromChartID` binds a mapped dimension and sits on the target tab, the cycle-graph builder emits a self-edge (A→A) that `visit()` rejects as a cycle. Because the `dashboard` branch is missing from that builder, dashboard targets receive no such protection, so fixing the cycle-graph omission (Recommendation P1) also closes this risk.

If a chart `fromChartID` defines a dashboard-targeted action mapping to dimension $D$, and that same chart `fromChartID` also binds dimension $D$ in `filterBindings`:
1. The user clicks a row in Chart A and triggers the dashboard action.
2. The action applies a dashboard-wide contribution targeting $D$.
3. Because Chart A binds $D$, its own query parameters change, causing Chart A to refetch.
4. When refetch finishes, `dataUpdatedAt` updates, altering `zoomContext`.
5. In [components/ChartWrapper/index.tsx](components/ChartWrapper/index.tsx#L368-L377), `handleChartContextSync` detects `appliedContextRef.current !== zoomContext` and calls `clearActionSource(chartA)` ([components/ChartWrapper/chartActions.ts](components/ChartWrapper/chartActions.ts#L38-L40)).
6. `clearActionSource` strips all `chartSelection` contributions originating from Chart A, immediately removing the contribution that was just applied.
7. Chart A's parameters revert, triggering a second query refetch and canceling the user's action.

**Mitigation**: Because non-navigating actions cannot filter their own source chart without creating a context-reset loop, [lib/validateDashboardConfig.ts](lib/validateDashboardConfig.ts#L219-L242) must add graph edges from `fromChartID` to all charts that bind the mapped dimensions (including `fromChartID` itself). The existing cycle detector will then reject self-targeting configurations at validation time. This is the same protection `tab` targets already receive; only the missing `dashboard` branch leaves it open.

### 2. Tooltip Card Footer Scope Consistency
In [components/ChartWrapper/index.tsx](components/ChartWrapper/index.tsx#L990-L996):
```tsx
executableActionCount={executableCurrentTabActions.length}
onApplyActions={applyAllCurrentTabActions}
```
The footer button "Verknüpfte Diagramme filtern" in [components/TooltipCard/index.tsx](components/TooltipCard/index.tsx#L165-L180) evaluates only `executableCurrentTabActions`. If a chart's actions are solely dashboard-scoped, the tooltip footer button will remain hidden, and filtering must be initiated via right-click context menu. This aligns with the plan's scope definition ("Verknüpfte Diagramme" = sibling charts on current tab), but should be documented in [docs/agents/agentProcess.md](docs/agents/agentProcess.md#L629) so dashboard authors understand the distinction.

---

## Actionable Recommendations (prioritized)

### Priority 1: Prevent Cycle & Self-Targeting Feedback Loops in Validation
Omissions #4, #5, and the self-targeting loop (Risk 1) are a single fix: they all stem from the validation loops falling through on `dashboard`. Update [lib/validateDashboardConfig.ts](lib/validateDashboardConfig.ts#L219-L242) to include dashboard-targeted actions in the cycle graph:
```ts
} else if (action.target.kind === "dashboard") {
  const targetCharts = Array.from(charts.values()).filter((chart) =>
    action.mappings.some(
      (mapping) => chart.filterBindings?.[mapping.targetDimensionId] !== undefined,
    ),
  );
  for (const targetChart of targetCharts) {
    graph.set(action.fromChartID, [
      ...(graph.get(action.fromChartID) ?? []),
      targetChart.chartID,
    ]);
  }
}
```
Also add a check in the mapping loop of [lib/validateDashboardConfig.ts](lib/validateDashboardConfig.ts#L184-L203) ensuring at least one chart in the dashboard binds each mapped dimension when `target.kind === "dashboard"`.

To prevent this class of omission recurring, convert both `action.target.kind` branches into exhaustive `switch` statements with a `never`-typed default so a future fourth target kind fails to compile until handled.

### Priority 2: Add Missing Composition Test
Add a test in [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts) verifying that a dashboard-targeted `chartSelection` contribution composes with a dashboard `control` contribution according to the dimension's `composition` rule (`intersect` vs `union`).

### Priority 3: Fallback Context Menu Labels
In [components/ChartWrapper/index.tsx](components/ChartWrapper/index.tsx#L960), enhance the fallback label when `action.label` is omitted:
```ts
const label =
  action.label ??
  `Dashboardweit filtern (${action.mappings.map((m) => m.targetDimensionId).join(", ")})`;
```

### Priority 4: Agent Guidance Update
Update [docs/agents/agentProcess.md](docs/agents/agentProcess.md#L650) step 2 to note `{ kind: "dashboard" }` as an available target choice alongside `{ kind: "chart" }` and `{ kind: "tab" }`.

---

## Overall Verdict

**Needs Minor Changes**

The core implementation is clean, follows repository conventions, and integrates smoothly with the existing Zustand filter store and React Context menu components. All findings below were verified against the working tree. To ensure production robustness, the cycle detection graph and bound-dimension validation in [lib/validateDashboardConfig.ts](lib/validateDashboardConfig.ts) need to cover `{ kind: "dashboard" }` targets — preferably via exhaustive `switch` handling — and the composition test should be added as a regression guard.

---

## Concrete To-Dos

- [ ] **Add `dashboard` branch to cycle graph** — in the graph builder of [lib/validateDashboardConfig.ts](lib/validateDashboardConfig.ts#L219-L242), emit edges from `fromChartID` to every chart that binds a mapped dimension (including `fromChartID` itself). Closes the undetected-cycle gap and the self-targeting erasure loop. _(Blocking)_
- [ ] **Add `dashboard` bound-dimension check** — in the mapping loop of [lib/validateDashboardConfig.ts](lib/validateDashboardConfig.ts#L184-L203), reject a `dashboard` action whose mapped dimension is bound by no chart in the dashboard. _(Blocking)_
- [ ] **Make both `action.target.kind` branches exhaustive** — convert the mapping-validation and cycle-graph branches to `switch` statements with a `never`-typed default so a future target kind fails to compile until handled. _(Recommended)_
- [ ] **Add composition regression test** — in [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts), verify a dashboard-targeted `chartSelection` contribution composes with a dashboard `control` for the same dimension per its `composition` rule (`intersect`/`union`). _(Recommended)_
- [ ] **Add cycle-detection test** — verify a self-targeting or circular `dashboard` action is rejected by `validateDashboardConfig` once the graph fix lands. _(Recommended)_
- [ ] **Improve fallback context-menu label** — in [components/ChartWrapper/index.tsx](components/ChartWrapper/index.tsx#L960), append mapped dimension IDs when `action.label` is absent so multiple dashboard actions are distinguishable. _(Nice-to-have)_
- [ ] **Document tooltip-footer scope** — note in [docs/agents/agentProcess.md](docs/agents/agentProcess.md#L629) that "Verknüpfte Diagramme filtern" covers current-tab siblings only; dashboard-scoped actions run via the context menu. _(Nice-to-have)_
- [ ] **Update agent guidance** — add `{ kind: "dashboard" }` as a target choice in step 2 of [docs/agents/agentProcess.md](docs/agents/agentProcess.md#L650). _(Nice-to-have)_
- [ ] **Add ActiveFilters UI test** — verify a dashboard-targeted contribution renders on all tabs tagged "via Auswahl". _(Optional)_
