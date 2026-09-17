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
  control value silently replaces it. The collision is latent, not observed: it
  requires an `expectedColumns` entry that is string-identical to a
  `filterBindings` SQL field name, and no dashboard defines connections today;
- `scope` currently mixes control placement with query applicability;
- `toQueryParam` in `components/ChartWrapper/utils.ts` returns `null` for any
  object value, so a bound `dateRange` dimension silently produces no filter at
  all. This is a live correctness defect independent of the two-store split.

One frequently assumed defect does **not** exist. `ChartWrapper` resolves a
dimension as `filterValues[globalKey(id)] ?? filterValues[tabKey(activeTab, id)]`,
but `validateFilterDimensions` already enforces dashboard-wide unique IDs across
scopes, so one ID can never occupy both keys. That expression is a "look in
either place" idiom, not a precedence rule, and global values never shadow tab
values.

## Verified Baseline

Facts this plan is calibrated against; re-verify before starting a phase.

- `connections`, `expectedColumns`, and `autoApplyConnections` appear **zero**
  times across `pagesConfig/*.json`. Connection migration is greenfield.
- `tabJumps` is the only live action config: 6 entries in
  `pagesConfig/productionNumbers.json`.
- Config validation today is `validateFilterDimensions` only (non-empty and
  unique dimension IDs), invoked from `scripts/pages/generateNextPage.ts`. It
  does not run at runtime and checks nothing about bindings, tabs, or actions.
- Test coverage is two files: `tests/generateNextPage.test.ts` (dimension ID
  validation) and `tests/tabJumpStore.test.ts` (jump execution and rollback).
  There is no baseline for chart fetching, connection resolution, snapshot
  round-trip, or multiselect serialization.
- Snapshots persist `{ values, activeTab }` as JSON in `filter_snapshots`. The
  row already carries a `dashboard` column; the payload itself is unversioned.

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
10. Resolver output is canonically ordered and serializable, so it can be used
    directly as a stable React Query key without identity churn.
11. A contribution change re-renders only the charts whose resolved values
    change. Components subscribe through memoized or shallow selectors, never
    to the whole contribution record.
12. A dimension value that cannot be expressed in the SQL binding contract is a
    validation error, never a silently dropped filter.

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
  composition?: CompositionRules;
};

type CompositionRule = "intersect" | "union";

type CompositionRules = {
  sameSourceKind?: CompositionRule;
  crossSourceKind?: CompositionRule;
};
```

Composition is declared per source class, not as one flag on the dimension. A
single flag would force the same rule on "two chart selections" and "a control
plus a chart selection", which are different user intents.

Defaults:

- `sameSourceKind` defaults to `"union"`, preserving today's behavior where
  several connection sources broaden the result.
- `crossSourceKind` defaults to `"intersect"`, so a control narrows an action
  and vice versa.
- A dimension without `control` is action-only and does not render in the
  sidebar. `defaultValue` on such a dimension has no target and is rejected by
  validation.
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

This key is the entire correctness guarantee for replacement versus
accumulation, so it is derived by one exported function rather than assembled
at call sites:

```ts
const contributionKey = (
  source: FilterSource,
  target: FilterTarget,
  dimensionId: string,
) =>
  [
    source.kind,
    "actionId" in source ? source.actionId : source.dimensionId,
    target.kind,
    "tab" in target ? target.tab : "chartID" in target ? target.chartID : "",
    dimensionId,
  ].join("|");
```

A key collision silently discards a filter, so this function is unit-tested
directly.

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

`pendingAction` holds one action at a time. Two source charts staging manual
actions concurrently means last write wins, and the earlier staged action is
discarded without being applied. This matches the current `pendingSourceFilters`
behavior and is retained deliberately.

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
- Contributions from the same source kind combine with `sameSourceKind`
  (default union); contributions from different source kinds combine with
  `crossSourceKind` (default intersect).
- Set composition applies only to enumerable types: `select`, `multiselect`,
  and `option`. For free-text `string`, `number`, and `dateString`, a dimension
  accepts exactly **one** contribution per chart. A second contribution is an
  error surfaced in the UI, not a silent intersection, because the result must
  still serialize to a single scalar SQL field.
- A scalar dimension rejects an action that resolves to multiple values.
- `null`, an empty string, or an empty multiselect removes that contribution.
- An empty intersection means “match nothing,” not “no filter.” `ChartWrapper`
  returns an empty result without issuing a warehouse query in that case, and
  renders an explicit empty state naming the conflict rather than an
  unexplained blank chart.
- Date ranges intersect as `max(from)` to `min(to)`; an inverted result is
  impossible. Until this is implemented, action mappings to `dateRange` remain
  invalid.

This removes the remaining precedence-by-assignment rule: a chart action can no
longer overwrite a previously assigned SQL parameter, because composition is
decided per dimension before any binding is applied.

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
- `dateRange`: not serializable under the current single-field binding.
  `toQueryParam` returns `null` for it today, so such a binding silently drops
  the filter. Until an explicit two-field binding naming two SQL input fields
  exists, a `filterBindings` entry for a `dateRange` dimension is a validation
  error, and action mappings to `dateRange` stay invalid.

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

Because no dashboard uses `connections` today, this is a **breaking config
change with no compatibility adapter**. `expectedColumns` and
`autoApplyConnections` become validation errors in the same change that
introduces `mappings` and `apply`.

## Validation Boundary

Expand the existing dashboard validator into `validateDashboardConfig()` and
run it from generation and runtime initialization.

Validate:

- dimension IDs are non-empty and dashboard-unique;
- control tabs and action target tabs exist;
- every `filterBindings` key names a dimension;
- one chart does not bind two dimensions to the same SQL input field;
- no chart binds a `dateRange` dimension while single-field binding is the only
  supported form;
- a dimension with `defaultValue` also declares a `control`;
- action IDs are unique;
- action source and target charts exist;
- every action mapping names a dimension;
- every target chart binds every mapped dimension;
- a tab-targeted action reaches at least one chart on that tab;
- multi-value actions target `multiselect` dimensions;
- non-enumerable dimensions are not reachable by more than one producer;
- connection graphs are acyclic, so `A → B → C → A` fails at generation rather
  than looping at runtime;
- unsupported date-range action mappings fail clearly;
- `expectedColumns` and `autoApplyConnections` produce a migration error.

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
- An `impossible` resolution renders a dedicated empty state that names the
  conflicting dimension, instead of the generic "no data" state.
- `optionsSource` queries stay non-dependent. Filter option lists are never
  narrowed by contributions; this migration does not change that.

## Migration Phases

### Phase 0 — Characterization Tests

The repository has two test files and no baseline for anything this plan
touches except tab jumps, so this phase is the largest single chunk of work,
not a warm-up. Scope it to behavior that must be preserved:

- Pin current control draft/apply/reset behavior.
- Pin tab-jump apply/rollback and nested breadcrumb behavior.
- Pin multiselect comma-joined serialization and empty-value handling.
- Pin snapshot save/restore round-trip.

Do **not** characterize chart connections. They have no production usage, so
there is no behavior to preserve; testing the current store only locks in the
model being replaced.

Exit criterion: control, tab-jump, serialization, and snapshot behavior are
documented by tests before state changes.

### Phase 1 — Pure Domain and Validation

This is the highest-value, lowest-risk part of the plan and should land as its
own change, ahead of everything else. Today the only check is non-empty and
unique dimension IDs at generation time; shipping `validateDashboardConfig()`
alone already catches dangling `filterBindings` keys, missing tabs, and the
silent `dateRange` drop.

- Introduce target, source, contribution, and resolver types under
  `lib/filters/`.
- Ship `validateDashboardConfig()` standalone, without changing runtime
  behavior.
- Add unit tests for applicability, composition, impossible intersections,
  contribution-key derivation, and invalid references.

Exit criterion: the validator runs during generation, and the resolver is fully
tested and unused by production code.

### Phase 2 — Controls on Contributions

- Change global/tab controls to create control contributions.
- Move default-value seeding, draft/apply/reset, chips, and chart parameter
  construction onto the resolver.
- Preserve current `scope` config through a temporary adapter that translates
  it to `control` placement.
- Introduce memoized per-chart selectors so a contribution change does not
  re-render every `ChartWrapper`.

Exit criterion: existing dashboards issue identical requests for control-only
filtering, and the Phase 0 control tests pass unchanged.

### Phase 3 — Chart Connections on Dimensions

Connections come before tab jumps. They have zero production usage, so this
phase proves the contribution and resolver design against real SQL at zero
migration risk, while tab jumps — which already target dimension IDs and are
live in `productionNumbers` — migrate afterwards onto a proven resolver.

- Add `id`, `mappings`, and `apply` to connection config; reject
  `expectedColumns` and `autoApplyConnections`.
- Translate connection tooltip results into dimension contributions.
- Move pending/manual and automatic application into `filterProvider`.
- Switch target queries to the common resolver.
- Remove SQL-column writes from `ChartWrapper`.
- Author one new connection-based dashboard as the acceptance vehicle, since no
  existing config exercises this path.

Exit criterion: chart actions compose with controls without overwriting
parameters, and no runtime state holds an SQL field name.

### Phase 4 — Tab Jumps on Contributions

- Replace direct scoped-key writes in `executeTabJump` with atomic contribution
  writes.
- Store contribution keys in breadcrumbs for exact rollback.
- Remove global/tab key helpers from tab-jump behavior.
- Migrate tab-jump target dimensions away from duplicated `drill_*` dimensions
  where an existing semantic dimension is appropriate.

Exit criterion: jump, nested jump, return, chip removal, reset, and sharing all
use the common contribution state, and the Phase 0 tab-jump tests pass against
the new store.

### Phase 5 — Unified Visibility, Reset, and Snapshots

- Render action contributions in `ActiveFilters` with source/target labels.
- Make clear-all and dashboard teardown clear every contribution lifecycle.
- Version snapshots and persist `appliedContributions`.
- Add a V1 snapshot reader that converts scoped values to control
  contributions; write only V2 snapshots.
- Reject snapshots belonging to another dashboard. The `filter_snapshots` row
  already stores `dashboard`, so this is a comparison at read time, not a
  schema change.

Accepted V1 migration loss: a V1 snapshot stores tab-jump values under the same
`tab:<tab>:<id>` keys as controls, so the two are indistinguishable. Restored V1
links therefore show former jump filters as control chips with no breadcrumb.
This is acceptable and is not worked around.

Exit criterion: the visible filter summary matches every constraint used by a
chart query, and shared links reproduce that state.

### Phase 6 — Cleanup

- Delete `stores/chartConnectionsStore.ts` and the `scope` adapter.
- Remove scoped value keys and the dual-key (`global` then `tab`) lookup.
- Remove the `expectedColumns` and `autoApplyConnections` types.
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
- `components/ChartWrapper/utils.ts` (`toQueryParam` serialization)
- `components/FilterControl/index.tsx`
- `components/FilterActions/index.tsx`
- `components/ActiveFilters/index.tsx`
- `components/TabBreadcrumb/index.tsx`
- `hooks/useFilterUrlSync.ts`
- `hooks/useShareFilters.ts`
- `app/api/filters/snapshotStore.ts` (snapshot versioning)
- `scripts/pages/generateNextPage.ts`
- `tests/` (characterization and unit suites)
- `pagesConfig/*.json`
- target chart and tooltip SQL files for migrated connections

Module implementations should not change; they continue to report selected
rows through `onSelectionChange`.

## Test Plan

### Unit

- target applicability for dashboard, tab, and chart contributions;
- contribution-key derivation, including near-miss collision cases;
- replacement by stable source key;
- same-source union and cross-source intersection, plus configured overrides;
- a second producer on a non-enumerable dimension raises an error;
- empty intersection produces `impossible`, not `null`;
- resolver output is canonically ordered and stable across re-resolution;
- scalar/multiselect/date-range validation;
- control draft/apply/reset does not remove action contributions;
- clear contribution and clear all;
- tab-jump atomic apply and exact rollback;
- pending/manual and automatic chart actions, including concurrent staging
  where the later action replaces the earlier one;
- snapshot V1 migration and V2 round-trip;
- complete config cross-reference validation, including connection cycles,
  `dateRange` bindings, and `defaultValue` without `control`.

### Component

- bound charts receive resolved values from all applicable targets;
- unrelated tabs/charts do not re-query and do not re-render;
- action chips show source and target and clear independently;
- Apply/Reset affects drafts only;
- all-target tooltip action leaves no hidden filters;
- impossible constraints render a conflict-specific empty state without a
  request.

### End-to-End

1. Apply a dashboard control and verify all bound charts receive it.
2. Apply a tab control and verify only charts on that tab receive it.
3. Apply a same-tab chart action on the same dimension and verify explicit
   composition instead of SQL-field overwrite.
4. Perform a tab jump and verify navigation, chips, target queries, and return.
5. Clear all and verify controls, jumps, connections, and breadcrumbs reset.
6. Share the state and verify every applied contribution is restored.

## Rollout and Safety

- Land Phase 1 validation as its own change, before any store work.
- Land phases independently; do not combine store migration, config migration,
  and SQL migration in one change.
- Keep one resolver behind the temporary `scope` adapter during migration;
  connections have no adapter and switch shape in a single change.
- Add development warnings for deprecated `scope` config before making it an
  error. Connection config skips the warning period because it has no users.
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
- A bound `dateRange` dimension can no longer silently produce an unfiltered
  query.
- Control and tab-jump behavior in existing dashboards is unchanged. Connection
  behavior is explicitly allowed to change, including its config shape, because
  no dashboard uses it.