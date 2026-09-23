# Unified Chart Actions — Legacy Cleanup Plan

Follow-up to [unified-chart-actions-plan.md](unified-chart-actions-plan.md) and
[unified-chart-actions-review.md](unified-chart-actions-review.md). The unified
`actions` model is live: `executeTabJump` and `lib/normalizeDashboardConfig.ts`
are removed, and `validateDashboardConfig` now hard-rejects legacy `connections`
and `tabJumps`. This plan tracks the remaining leftovers so no dead legacy
surface or stale documentation remains.

## 1. Goals & Non-Goals

### Goals

- Remove all dead legacy code paths (`connections` / `tabJumps` / tab-jump shim).
- Fix the dev/scratch pages that now crash because the validator rejects
  `connections`.
- Align instructions, agent prompts, and docs with the unified `actions`
  vocabulary and the dual `clientRow` / `tooltipLookup` resolution model.

### Non-Goals

- No changes to the resolver ([lib/filters/actions.ts](../../lib/filters/actions.ts)),
  the store `executeAction` path, or contribution-key semantics — these are
  verified correct and compatible.
- No historical rewriting of `docs/plans/*.md` design documents; they are records
  of prior work and stay as-is.

## 2. Cleanup Tasks (prioritized)

### Task 1 — Fix or delete the broken scratch pages (blocker)

- **Problem**: [app/testPage/page.tsx](../../app/testPage/page.tsx) (line ~623)
  and [app/testPageLineChart/page.tsx](../../app/testPageLineChart/page.tsx)
  (line ~367) still pass a `DashboardConfig` containing `connections:` into
  `<DashboardShell>`. `DashboardShell` runs `validateDashboardConfig` in dev,
  which now throws on `"connections" in raw`, so both pages crash on load. Each is
  also a `tsc` error because `connections` is not a `DashboardConfig` key.
- **Action**: Migrate each page's `connections` block to an equivalent
  `actions` entry (`sourceResolution: "tooltipLookup"`, `target: { kind: "chart" }`),
  or delete the scratch page if it is no longer needed.
- **Acceptance**: Both pages load in dev without throwing; no new `tsc` errors
  beyond the known generated-page baseline; `pnpm exec eslint .` clean except the
  known `TableModule` warning.

### Task 2 — Delete the dead tab-jump shim

- **Problem**: [lib/filters/tabJump.ts](../../lib/filters/tabJump.ts)
  (`resolveTabJumpContributions`) has zero code importers and references the
  removed `TabJumpConfig` type. Plan Task 2 of the original work already called
  for its deletion.
- **Action**: Delete the file. Confirm no remaining `from "@/lib/filters/tabJump"`
  or relative imports.
- **Acceptance**: `grep` for `resolveTabJumpContributions` / `filters/tabJump`
  returns only doc/plan matches; `pnpm exec tsc --noEmit` and `pnpm exec vitest run`
  unaffected.

### Task 3 — Remove the stale legacy validator guard & comment drift

- **Problem**:
  - [lib/validateDashboardConfig.ts](../../lib/validateDashboardConfig.ts) still
    checks per-chart `autoApplyConnections` and its message points authors at the
    removed "connection" concept.
  - `FilterActionMapping.sourceField` in [types/tabs.d.ts](../../types/tabs.d.ts)
    is documented only as "client-side selectedRows", but for `tooltipLookup` it
    is an SQL result alias.
- **Action**: Drop or repoint the `autoApplyConnections` guard; update the
  `sourceField` comment to cover both `clientRow` and `tooltipLookup` resolutions.
- **Acceptance**: Validator messages reference only `actions`; the type comment
  documents both resolutions.

### Task 4 — Update `AGENTS.md`

- **Problem**: [AGENTS.md](../../AGENTS.md) contains two near-verbatim sections:
  `### Selection, enhanced tooltips, and connections` (~line 142) and
  `### Selection, enhanced tooltips, and actions` (~line 196). The first is a
  legacy-titled duplicate of the lasso/tooltip prose in the second.
- **Action**: Delete the stale `…and connections` section, keeping the unified
  `…and actions` section as the single source.
- **Acceptance**: `AGENTS.md` has exactly one selection/tooltip section, titled
  around the actions model.

### Task 5 — Refresh module & agent instructions

- **Problem**:
  - [modules/instructions.md](../../modules/instructions.md) (~line 32) describes
    outgoing filtering only as "resolved from source tooltip SQL" targeting a
    `multiselect` dimension — it omits `clientRow` resolution and the relaxed
    manual-target rule.
  - [.github/agents/Development.agent.md](../../.github/agents/Development.agent.md)
    (~line 58) and [.github/agents/Dashboard.agent.md](../../.github/agents/Dashboard.agent.md)
    (~line 3) still use "chart connections" wording.
  - [docs/agents/agentProcess.md](../../docs/agents/agentProcess.md) §14 mixes
    "Actions and Connections".
- **Action**: Rewrite these to the unified `actions` vocabulary, describing the
  two resolution modes (`clientRow` vs `tooltipLookup`), the `sourceField`
  meaning per mode, target kinds (`chart` / `tab`), `trigger`, `navigate`, and the
  value cap.
- **Acceptance**: No user-facing instruction or agent prompt describes
  `connections` / `tabJumps` as authoring surfaces.

### Task 6 — Rename the misleading generator test

- **Problem**: [tests/generateNextPage.test.ts](../../tests/generateNextPage.test.ts)
  (~line 94) is titled "includes connections and tabJumps in generated page
  boilerplate" but its body asserts only `actions:`.
- **Action**: Rename the test to reflect that it asserts `actions` emission.
- **Acceptance**: Test title matches its assertions; suite still green.

### Task 7 (optional) — Decouple the "Filtern" submenu gating

- **Problem**: In [components/ChartWrapper/index.tsx](../../components/ChartWrapper/index.tsx)
  the "Filtern" submenu trigger is disabled while
  `!selectedConnectionContributions`. For a chart mixing `clientRow` and
  `tooltipLookup` actions, this blocks an executable `clientRow` action while the
  async `tooltipLookup` is still loading, even though `clientRow` needs no
  roundtrip.
- **Action**: Gate `clientRow` actions on the live `canExecuteAction` result
  rather than on the presence of the resolved async contributions, so they remain
  usable during in-flight tooltip resolution.
- **Acceptance**: A `clientRow` action is selectable immediately on selection even
  when a sibling `tooltipLookup` action on the same chart is still resolving; no
  regression in existing e2e assertions.

## 3. Validation

- `pnpm exec tsc --noEmit` — compare error count/files against the known baseline
  (~51 pre-existing generated-page `chartID` errors); Task 1 must not add new
  ones and should remove the `connections`-related errors.
- `pnpm exec vitest run` — all suites green.
- `pnpm exec eslint .` — clean except the known `TableModule` warning.
- Manual: load a dev page (or the migrated scratch pages) and confirm no
  validator throw.

## 4. Suggested Sequencing

Tasks 1–6 are independent and can land in one commit or a small series. Task 7 is
an optional UX refinement and should be a separate commit with its own e2e
assertion. Tasks touching `modules/**` do not apply here (no module files change),
so `module:validate` / `module:generateRegistry` are not required.
