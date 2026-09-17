# Unified Dimension Filter Model — Migration Plan

Status: Proposed

## Goal

Make dimensions the single vocabulary for every filter that reaches a chart:

- filter controls,
- global and tab applicability,
- tab-jump selections,
- same-tab and cross-tab chart selections,
- active-filter display, reset, and snapshots,
- SQL input binding.

The UI interactions remain distinct. A tab jump still navigates and creates a
breadcrumb; a chart action can still be manual or automatic. Internally, both
produce typed contributions against dimension IDs and use the same resolver.

## Current Inconsistency

The current runtime has two filter models:

1. `stores/filterProvider.ts` stores global/tab dimension values and tab-jump
   values under scoped keys. `ChartWrapper` maps them through `filterBindings`.
2. `stores/chartConnectionsStore.ts` stores target chart SQL columns directly.
   `ChartWrapper` appends these columns after dimension parameters, so a chart
   connection can overwrite a dimension-bound SQL field.

This causes different behavior for the same user concept:

- tab-jump filters are visible, shareable, scoped by dimension, and cleared by
  dimension actions;
- chart-connection filters are invisible, transient, keyed by SQL column, and
  cleared through a separate lifecycle;
- multiple connection sources currently union values, while a collision with a
  control value silently replaces the control value;
- `scope` currently mixes control placement with query applicability.

## Target Invariants

1. Every dashboard dimension has a non-empty, dashboard-unique `id`.
2. Runtime filter state references dimension IDs, never SQL field names.
3. Every applied filter has an explicit source and target.
4. Control placement and filter applicability are separate concepts.
5. A chart has one binding from a dimension ID to one SQL input field.
6. Only one pure resolver builds a chart's effective dimension values.
7. Combining multiple constraints is explicit and deterministic; assignment
   order never decides the result.
8. Every applied contribution can be displayed, cleared, reset, and persisted.
9. Invalid config fails during generation, not as a silently unfiltered chart.

## Target Domain Model

### Dimensions

Keep dimensions as dashboard-level semantic definitions. Replace `scope` with
an optional control declaration; actions can use hidden dimensions that have no
control.

```ts
type FilterControlPlacement =
  | { location: "dashboard" }
  | { location: "tab"; tab: string };

type FilterDimension = {
  id: string;
  label: string;
  type: FilterType;
  control?: FilterControlPlacement;
  options?: FilterOption[];
  optionsSource?: string;
  defaultValue?: FilterValue;
  composition?: "intersect" | "union";
};
```

Defaults:

- `composition` defaults to `"intersect"`, matching normal filter semantics.
- A dimension without `control` is action-only and does not render in the
  sidebar.
- A dashboard control creates a dashboard-targeted contribution.
- A tab control creates a contribution targeted to its configured tab.

### Targets and Sources

```ts
type FilterTarget =
  | { kind: "dashboard" }
  | { kind: "tab"; tab: string }
  | { kind: "chart"; chartID: TableSchemaKey };

type FilterSource =
  | { kind: "control"; dimensionId: string }
  | { kind: "tabJump"; actionId: string; sourceChartID: TableSchemaKey }
  | { kind: "chartSelection"; actionId: string; sourceChartID: TableSchemaKey };

type FilterContribution = {
  key: string;
  dimensionId: string;
  source: FilterSource;
  target: FilterTarget;
  value: FilterValue;
};
```

`key` is stable for one logical producer, target, and dimension. Updating the
same source replaces its previous contribution instead of accumulating stale
values.

### Store Shape

Extend `filterProvider` into the only filter store:

```ts
type FilterStoreState = {
  dimensions: FilterDimension[];
  draftContributions: Record<string, FilterContribution>;
  appliedContributions: Record<string, FilterContribution>;
  pendingAction: {
    sourceChartID: TableSchemaKey;
    contributions: FilterContribution[];
  } | null;
  hasApplied: boolean;
  activeTab: string;
  breadcrumbs: TabJumpBreadcrumb[];
};
```

Controls write only draft contributions. `applyFilters()` promotes control
contributions while preserving already-applied action contributions. Tab jumps
and applied chart actions write both layers immediately. Manual chart actions
use `pendingAction` until the user chooses a target or applies all targets.

Remove `chartConnectionsStore` after chart actions have migrated.

## Resolution and Composition

Add a pure resolver, for example `lib/filters/resolveChartFilters.ts`:

```ts
resolveChartFilters({
  chartID,
  tab,
  dimensions,
  contributions,
  bindings,
}): ResolvedChartFilters
```

Resolution steps:

1. Keep contributions targeting the dashboard, current tab, or current chart.
2. Group them by `dimensionId`.
3. Normalize each non-empty contribution into an allowed-value constraint.
4. Combine values using the dimension's declared composition rule.
5. Return semantic dimension values, plus an `impossible` flag when an
   intersection is empty.
6. Map resolved dimensions through the chart's `filterBindings` exactly once.

Composition rules:

- Values within one multiselect contribution are OR alternatives.
- Independent contributions default to intersection (AND).
- `composition: "union"` is available only where product behavior explicitly
  requires values from several producers to broaden the result.
- A scalar dimension rejects an action that resolves to multiple values.
- `null`, an empty string, or an empty multiselect removes that contribution.
- An empty intersection means “match nothing,” not “no filter.” `ChartWrapper`
  returns an empty result without issuing a warehouse query in that case.
- Date ranges intersect as `max(from)` to `min(to)`; an inverted result is
  impossible. Until this is implemented, action mappings to `dateRange` remain
  invalid.

This removes both current precedence rules: global no longer silently shadows a
tab value, and chart actions no longer overwrite a previously assigned SQL
parameter.

## SQL Binding Contract

Keep chart bindings declarative:

```ts
filterBindings: Record<dimensionId, inputFieldName>
```

The binding identifies only the SQL field. Serialization follows the dimension
type:

- `string`, `select`, `option`, `dateString`, `number`: scalar or `null`;
- `multiselect`: comma-joined string or `null`, preserving the current SQL
  contract;
- `dateRange`: migrate to an explicit two-field binding before enabling it in
  actions.

Chart actions must therefore target a dimension, not an SQL column. A target
chart receives the result only when it binds that dimension. Connection values
with multiple selected values require a `multiselect` target dimension.

## Config Model

Keep `tabJumps` and `connections` as separate user-facing concepts, but give
them the same dimension mapping shape.

```ts
type FilterActionMapping = {
  sourceField: string;
  targetDimensionId: string;
};

type ChartConnection = {
  id: string;
  fromChartID: TableSchemaKey;
  toChartID: TableSchemaKey;
  mappings: FilterActionMapping[];
  apply?: "manual" | "auto";
};

type TabJumpConfig = {
  id: string;
  fromChartID: TableSchemaKey;
  targetTab: string;
  mappings: FilterActionMapping[];
  label?: string;
  restoreOnReturn?: boolean;
};
```

For connections, `sourceField` is the exact alias returned by tooltip SQL.
`targetDimensionId` replaces `expectedColumns`; the target chart's
`filterBindings` owns the final SQL field name.

## Validation Boundary

Expand the existing dashboard validator into `validateDashboardConfig()` and
run it from generation and runtime initialization.

Validate:

- dimension IDs are non-empty and dashboard-unique;
- control tabs and action target tabs exist;
- every `filterBindings` key names a dimension;
- one chart does not bind two dimensions to the same SQL input field;
- action IDs are unique;
- action source and target charts exist;
- every action mapping names a dimension;
- every target chart binds every mapped dimension;
- a tab-targeted action reaches at least one chart on that tab;
- multi-value actions target `multiselect` dimensions;
- unsupported date-range action mappings fail clearly;
- deprecated `expectedColumns` produces a migration error after the adapter
  phase.

Runtime extraction must still validate that tooltip/selected rows contain the
configured `sourceField`, because SQL result aliases are not fully known to the
TypeScript generator.

## UI Semantics

- Controls continue to edit draft state and use Apply/Reset.
- Tab jumps and chart actions continue to apply immediately when activated.
- `ActiveFilters` renders contribution-level chips, including source and target
  context for action filters. Clearing a chip removes that contribution only.
- “Alle zurücksetzen” clears control, tab-jump, chart-action, pending-action,
  and breadcrumb state in one store transition.
- Breadcrumbs record contribution keys created by a jump. Return removes or
  restores exactly those contributions.
- Sharing persists every applied contribution and the active tab. Pending
  actions and breadcrumb navigation history are not persisted.

## Migration Phases

### Phase 0 — Characterization Tests

- Pin current control draft/apply/reset behavior.
- Pin tab-jump apply/rollback and nested breadcrumb behavior.
- Pin manual and automatic chart-action staging/application/clearing.
- Add a regression test demonstrating the current SQL-field overwrite.

Exit criterion: behavior is documented by tests before state changes.

### Phase 1 — Pure Domain and Validation

- Introduce target, source, contribution, and resolver types under
  `lib/filters/`.
- Expand dashboard config validation without changing runtime behavior.
- Add unit tests for applicability, composition, impossible intersections, and
  invalid references.

Exit criterion: the resolver is fully tested and unused by production code.

### Phase 2 — Controls on Contributions

- Change global/tab controls to create control contributions.
- Move default-value seeding, draft/apply/reset, chips, and chart parameter
  construction onto the resolver.
- Preserve current `scope` config through a temporary adapter that translates
  it to `control` placement.

Exit criterion: existing dashboards issue identical requests for control-only
  filtering.

### Phase 3 — Tab Jumps on Contributions

- Replace direct scoped-key writes in `executeTabJump` with atomic contribution
  writes.
- Store contribution keys in breadcrumbs for exact rollback.
- Remove global/tab key helpers from tab-jump behavior.
- Migrate tab-jump target dimensions away from duplicated `drill_*` dimensions
  where an existing semantic dimension is appropriate.

Exit criterion: jump, nested jump, return, chip removal, reset, and sharing all
use the common contribution state.

### Phase 4 — Chart Connections on Dimensions

- Add `id` and `mappings` to connection config.
- Translate connection tooltip results into dimension contributions.
- Move pending/manual and automatic application into `filterProvider`.
- Switch target queries to the common resolver.
- Remove SQL-column writes from `ChartWrapper`.

During this phase, a compatibility adapter may translate
`expectedColumns: ["country"]` into identity mappings only when a dimension
named `country` exists and the target chart binds it. Ambiguous cases fail with
a migration message rather than guessing.

Exit criterion: chart actions compose with controls and tab jumps without
overwriting parameters.

### Phase 5 — Unified Visibility, Reset, and Snapshots

- Render action contributions in `ActiveFilters` with source/target labels.
- Make clear-all and dashboard teardown clear every contribution lifecycle.
- Version snapshots and persist `appliedContributions`.
- Add a V1 snapshot reader that converts scoped values to control
  contributions; write only V2 snapshots.
- Reject snapshots belonging to another dashboard.

Exit criterion: the visible filter summary matches every constraint used by a
chart query, and shared links reproduce that state.

### Phase 6 — Cleanup

- Delete `stores/chartConnectionsStore.ts` and compatibility adapters.
- Remove scoped value keys and global-first fallback resolution.
- Remove deprecated `expectedColumns` and `autoApplyConnections` in favor of
  connection-level `apply`.
- Update generated pages, dashboard JSON, README, `AGENTS.md`, and historical
  plans that describe the old runtime as current behavior.

Exit criterion: repository search finds no second filter store, raw connection
SQL-column state, or legacy scoped-key query resolution.

## File Impact

Primary implementation surfaces:

- `types/filters.d.ts`
- `types/tabs.d.ts`
- `lib/filterDimensions.ts` or a new `lib/filters/` domain folder
- `stores/filterProvider.ts`
- `stores/chartConnectionsStore.ts` (removed at the end)
- `components/ChartWrapper/index.tsx`
- `components/ChartWrapper/connectionApplication.ts`
- `components/FilterControl/index.tsx`
- `components/FilterActions/index.tsx`
- `components/ActiveFilters/index.tsx`
- `components/TabBreadcrumb/index.tsx`
- `hooks/useFilterUrlSync.ts`
- `hooks/useShareFilters.ts`
- `scripts/pages/generateNextPage.ts`
- `pagesConfig/*.json`
- target chart and tooltip SQL files for migrated connections

Module implementations should not change; they continue to report selected
rows through `onSelectionChange`.

## Test Plan

### Unit

- target applicability for dashboard, tab, and chart contributions;
- replacement by stable source key;
- intersection and explicit union behavior;
- empty intersection produces `impossible`, not `null`;
- scalar/multiselect/date-range validation;
- control draft/apply/reset does not remove action contributions;
- clear contribution and clear all;
- tab-jump atomic apply and exact rollback;
- pending/manual and automatic chart actions;
- snapshot V1 migration and V2 round-trip;
- complete config cross-reference validation.

### Component

- bound charts receive resolved values from all applicable targets;
- unrelated tabs/charts do not re-query;
- action chips show source and target and clear independently;
- Apply/Reset affects drafts only;
- all-target tooltip action leaves no hidden filters;
- impossible constraints render an empty chart without a request.

### End-to-End

1. Apply a dashboard control and verify all bound charts receive it.
2. Apply a tab control and verify only charts on that tab receive it.
3. Apply a same-tab chart action on the same dimension and verify explicit
   composition instead of SQL-field overwrite.
4. Perform a tab jump and verify navigation, chips, target queries, and return.
5. Clear all and verify controls, jumps, connections, and breadcrumbs reset.
6. Share the state and verify every applied contribution is restored.

## Rollout and Safety

- Land phases independently; do not combine store migration, config migration,
  and SQL migration in one change.
- Keep one resolver behind both old and new config adapters during migration.
- Add development warnings for deprecated config before making it an error.
- Regenerate one small dashboard as a canary before `ProductionNumbers`.
- Do not remove the old connection store until manual apply, auto apply,
  per-target apply, tooltip ownership, and reciprocal-connection teardown tests
  pass against the unified store.

## Acceptance Criteria

- One store owns every filter constraint used by chart queries.
- One resolver determines chart applicability and composition.
- No runtime filter state contains SQL field names.
- Config validation catches invalid dimension, chart, tab, mapping, and binding
  references before page generation.
- Global controls, tab controls, tab jumps, and chart actions compose without
  precedence-by-assignment.
- Active chips, reset, and snapshots represent the complete applied state.
- Existing dashboard behavior is preserved unless a config explicitly selects
  a new composition rule.