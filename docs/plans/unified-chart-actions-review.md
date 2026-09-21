# Implementation Review: Unified Chart Actions

_Reviewed: 2026-09-21 · Branch: `main` (uncommitted working tree)_

## Summary of Changes

The change unifies the two legacy interaction mechanisms (`connections`, `tabJumps`)
into a single declarative `actions: ChartAction[]` model, per
[docs/plans/unified-chart-actions-plan.md](unified-chart-actions-plan.md). Key pieces:

- New unified types in `types/tabs.d.ts` (`ChartAction`, `ActionTarget`,
  `ActionTrigger`, `ActionSourceResolution`).
- New pure normalizer `lib/normalizeDashboardConfig.ts` translating legacy shapes
  into `actions`.
- New resolution engine `lib/filters/actions.ts` (`canExecuteAction`,
  `resolveActionContributions`), with `lib/filters/tabJump.ts` reduced to a shim.
- Store method `executeAction` in `stores/filterProvider.ts`.
- Rewritten action controller + unified "Filtern" submenu in
  `components/ChartWrapper/index.tsx`.
- Validator, generator, `DashboardShell`, `TabsWrapper`, `TooltipCard` updates;
  config migration for `pagesConfig/connectionAcceptance.json`.

Validation status: 75 unit tests pass across the 5 touched suites;
`tsc --noEmit` surfaces no new errors in the touched files; the
`connectionAcceptance` e2e spec passes.

## Alignment with Plan

Mostly strong, with three concrete deviations:

1. **Behavior B1 test is a placeholder, not a real test.**
   `tests/behaviorRegression.test.ts` (B1) re-implements a hand-rolled
   `asyncResolve` with its own `activeRequestId` and asserts on that local logic;
   the comment even says _"Verified by requestID guard pattern in resolveActions."_
   It never exercises `resolveActions` / `connectionRequestRef`. This gives false
   confidence for the stale-response guard, which is the single most subtle piece
   of the async path.

2. **Behavior B2 has no test at all.** The suite covers B1, B3–B8 (7 tests, no B2).
   Plan Task 4a explicitly requires _"Every behavior B1–B8 has a passing test."_
   B2 (mounting a chart must not clear its selection or the cross-tab filters it
   applied) is exactly the kind of regression that is easy to reintroduce and hard
   to catch manually.

3. **Task 4b e2e coverage was not implemented.**
   `tests/e2e/connectionAcceptance.spec.ts` only renames the menu label
   `Verlinktes Diagramm filtern` → `Filtern`. None of the Task 4b/§6 acceptance
   assertions were added: two-section submenu, cross-tab non-navigating target
   applying without a tab switch, drilldown + breadcrumb restore, and — notably —
   the explicit criterion _"a chart whose actions are all clientRow and whose
   enhancedTooltip is false issues no request to `/api/data/chart/tooltip` on
   selection."_ That last one guards a real perf/correctness property of the new
   `resolveActions` split and is worth asserting.

## Code Quality Observations

- **Triple duplication of the legacy→action mapping.** The same
  connection/tabJump→`ChartAction` translation now exists in three places:
  `lib/normalizeDashboardConfig.ts`, the `resolveTabJumpContributions` shim in
  `lib/filters/tabJump.ts`, and the inline `normalizedLegacyActions` `useMemo` in
  `components/ChartWrapper/index.tsx`. Because `DashboardShell` always normalizes
  before passing `actions`, the ChartWrapper inline path (and the
  `connections`/`tabJumps` props threaded through `TabsWrapper`) is effectively
  dead in the real render path. This is a maintenance trap — three copies that can
  drift.

- **DashboardShell passes redundant props.** `components/DashboardShell/index.tsx`
  forwards both the normalized `actions` and `rawConfig.connections` /
  `rawConfig.tabJumps` to `TabsWrapper`. Since `ChartWrapper` prefers `actions`
  when non-empty (`actions.length > 0 ? actions : normalizedLegacyActions`), the
  legacy props are unused. Recommend dropping them and the ChartWrapper fallback,
  so normalization lives in exactly one place.

- **`tabJump.ts` retention contradicts the plan.** Plan Task 2 says
  _"Delete `lib/filters/tabJump.ts`."_ It survives as a shim, and the store still
  retains `executeTabJump` even though `ChartWrapper` now calls `executeAction`.
  Not harmful, but it's dead-ish surface area that the plan intended to remove.

- **Awkward nested gate type.** In `lib/filters/actions.ts`,
  `extractPrimitivesForMapping` returns
  `{ ok: false; reason: ActionGateResult & { ok: false } }` — a `reason` that is
  itself a full gate result (`reason.reason`). It works, but the double-wrapping is
  confusing; a flat `{ ok: false; reason: GateReason }` would read better and
  de-nest the call sites.

## Test Coverage Assessment

- **Resolver (`tests/actionsResolver.test.ts`): excellent.** Covers `clientRow`
  flat + `values.<col>`, `tooltipLookup` arrays/scalars, sort determinism under
  shuffled input, non-primitive rejection, single-select gating, numeric handling,
  and the value cap. Gate/resolve agreement is asserted. This is the strongest part
  of the change.
- **Store (`tests/tabJumpStore.test.ts`): good.** `executeAction` with/without
  navigate, atomic draft+applied writes, single-notification atomicity, B8
  re-application, B10 breadcrumb pop. B9 (`navigateBack` LIFO restore) is covered
  only by pre-existing `executeTabJump`-based tests, not via `executeAction` — a
  small gap since the production path no longer uses `executeTabJump`.
- **Gaps:** B1 (fake), B2 (missing), and the Task 4b e2e assertions (missing), as
  above.

## Operational & Risk Notes

- **Silent behavior change in a fixture config.** In
  `pagesConfig/connectionAcceptance.json` the `ecu-to-details-fahrzeugreihe`
  mapping changed from `apply: "manual"` to `trigger: "auto"`. That flips it from
  an on-demand filter to one that fires immediately on every selection — a real UX
  change, undocumented in the plan and unasserted by the e2e. If intentional (to
  exercise the auto path), add an assertion; if accidental, revert to `manual`.
- **Contribution-key stability: verified.** Normalized legacy connections stay
  `chartSelection` and tab jumps stay `tabJump` (source-kind derivation
  `action.navigate ? "tabJump" : "chartSelection"`), so `contributionKey`,
  breadcrumbs, and `FilterSnapshotV2` payloads remain compatible.
- **Value-ordering change for tab jumps (intended).** The unified resolver now
  sorts `multiselect` values that the old tab-jump path left unsorted. This is the
  plan's stated determinism goal and only affects value arrays (not keys);
  snapshots rehydrate applied contributions directly, so no compatibility break.
- **Failed `tooltipLookup` no longer discards `clientRow` results.** The new
  `resolveActions` catch logs and continues, so partial `clientRow` contributions
  still apply. This is a reasonable improvement and consistent with the plan's
  "leaves the selection intact," but differs from the old all-or-nothing behavior —
  worth a one-line test.

## Actionable Recommendations (prioritized)

1. **Replace the fake B1 test** with one that drives `resolveActions` (or at
   minimum the `connectionRequestRef` guard) using fake timers, per the plan. As
   written it asserts nothing about the shipped code.
2. **Add the missing B2 test** (mount does not clear selection / cross-tab applied
   filters).
3. **Resolve the `trigger: "auto"` fixture change** — confirm intent, and either
   revert to `manual` or add an e2e assertion that selection auto-applies the
   Fahrzeugreihe filter.
4. **Add the Task 4b e2e assertions**, especially the "no
   `/api/data/chart/tooltip` request for clientRow-only + `enhancedTooltip: false`"
   check — it's cheap with the existing `warehouseMock` and guards a core property
   of the new split.
5. **Collapse the triple legacy-normalization** to one path: remove
   `normalizedLegacyActions` + the `connections`/`tabJumps` props from
   `ChartWrapper`/`TabsWrapper`/`DashboardShell`, relying solely on
   `normalizeDashboardConfig`. Delete `lib/filters/tabJump.ts` and `executeTabJump`
   (or document why they remain).
6. **Flatten the `extractPrimitivesForMapping` gate type** to
   `{ ok: false; reason: GateReason }`.

## Overall Verdict

**Needs Minor Changes.** The runtime design, resolver, store, and validator are
well-structured, aligned with the plan, and green on unit tests + typecheck. The
blockers to "Ready" are test-integrity issues rather than logic defects: a
placeholder B1 test, a missing B2 test, unimplemented Task 4b e2e coverage, and one
undocumented behavioral change in the migrated fixture. Address items 1–4 before
merge; items 5–6 are follow-up cleanups.
