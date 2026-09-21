# Unified Filter Domain — Test Plan and Missing Test Suites

Status: Proposed  
Target test suites: [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts), [tests/tabJumpStore.test.ts](tests/tabJumpStore.test.ts)  
Related implementations: [lib/filters/resolveChartFilters.ts](lib/filters/resolveChartFilters.ts), [stores/filterProvider.ts](stores/filterProvider.ts), [lib/validateDashboardConfig.ts](lib/validateDashboardConfig.ts), [components/ChartWrapper/index.tsx](components/ChartWrapper/index.tsx), [components/ActiveFilters/index.tsx](components/ActiveFilters/index.tsx)  
Depends on: [docs/plans/unified-dimension-filter-model-plan.md](docs/plans/unified-dimension-filter-model-plan.md), [docs/plans/testing-strategy-plan.md](docs/plans/testing-strategy-plan.md)  
Tooling: Vitest (`node` environment for domain/store/validator, `jsdom` for UI integration)

---

## 1. Overview and Review Findings

During the architectural review and implementation review of the **Unified Dimension Filter Model**, several test gaps were identified across the pure filter resolver, the contribution store lifecycle, dashboard configuration validation, and UI component behavior.

The unified filter model transitions filtering from flat dictionaries to a typed contribution graph:
$$\text{FilterContribution} = \text{source} \times \text{target} \times \text{dimension} \to \text{value}$$

Existing tests ([tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts) and [tests/tabJumpStore.test.ts](tests/tabJumpStore.test.ts)) establish basic characterization for key derivation, simple tab jumps, and single-source resolution. This document specifies the comprehensive suite of missing test cases required to prevent regressions and enforce system invariants.

---

## 2. Review Findings & Test Gap Matrix

| Review Finding | Impact Area | Risk Level | Target Suite |
|---|---|---|---|
| Multi-source date range intersection & boundary inversion (`from > to`) | Resolver | High | [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts) |
| Explicit composition overrides (`crossSourceKind`, `sameSourceKind`) | Resolver | High | [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts) |
| Single-value enumerable conflicts (`select`, `option` with multiple values) | Resolver | High | [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts) |
| Non-enumerable multi-producer deduplication (agreeing vs disagreeing values) | Resolver | Medium | [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts) |
| Empty filter values (`[]`, `""`, `{ from: null, to: null }`) ignored during resolution | Resolver | High | [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts) |
| Population of `conflictKeys` alongside `conflicts` for targeted UI removal | Resolver | Medium | [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts) |
| Action staging concurrency (subsequent stage overwrites prior pending action) | Store | Medium | [tests/tabJumpStore.test.ts](tests/tabJumpStore.test.ts) |
| Selective action teardown via `clearActionSource(sourceChartID)` | Store | High | [tests/tabJumpStore.test.ts](tests/tabJumpStore.test.ts) |
| Single-value tab jump target validation (rejects multiple rows without mutation) | Store | High | [tests/tabJumpStore.test.ts](tests/tabJumpStore.test.ts) |
| Nested tab jump breadcrumb history and exact LIFO rollback | Store | High | [tests/tabJumpStore.test.ts](tests/tabJumpStore.test.ts) |
| Untrusted/tampered snapshot hydration validation (dropping or rejecting invalid contributions) | Store / API | High | [tests/tabJumpStore.test.ts](tests/tabJumpStore.test.ts) |
| Validation of delimiter `\|` collision in dimension IDs and tab names | Config Validator | Medium | [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts) |
| Cycle detection in declarative chart connections | Config Validator | High | [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts) |
| Rejection of legacy keys (`expectedColumns`, `autoApplyConnections`, `scope`) | Config Validator | High | [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts) |
| Rejection of duplicate SQL parameter bindings across multiple dimensions | Config Validator | Medium | [tests/unifiedFilterDomain.test.ts](tests/unifiedFilterDomain.test.ts) |
| Tab-scoping for chart-targeted action chips in active filters bar | Component | Medium | Component Suite |
| Impossible filter state ("Widersprüchliche Filter") UI rendering & reset action | Component | Medium | Component Suite |

---

## 3. Test Suite 1: Pure Filter Resolver (`tests/unifiedFilterDomain.test.ts`)

This suite exercises [lib/filters/resolveChartFilters.ts](lib/filters/resolveChartFilters.ts) against multi-source composition, edge values, boundary violations, and conflict generation.

### 3.1 Date Range Multi-Source Composition

- **Case 1.1: Multi-source date range intersection**
  - **Setup**: Two sources contribute date ranges to the same `dateRange` dimension on the target chart. Source 1: `{ from: "2026-01-01", to: "2026-08-31" }`, Source 2: `{ from: "2026-03-01", to: "2026-10-15" }`.
  - **Expectation**: `impossible: false`, resolved value is `{ from: "2026-03-01", to: "2026-08-31" }` ($\max(\text{from})$, $\min(\text{to})$).
- **Case 1.2: Inverted boundary violation (`from > to`)**
  - **Setup**: Source 1: `{ from: "2026-07-01", to: "2026-12-31" }`, Source 2: `{ from: "2026-01-01", to: "2026-05-31" }`.
  - **Expectation**: $\max(\text{from}) = \text{"2026-07-01"}$, $\min(\text{to}) = \text{"2026-05-31"}$. Because $\text{from} > \text{to}$, resolved filter must report `impossible: true`, `conflicts: ["period"]`, and populate `conflictKeys` with both contribution keys.
- **Case 1.3: Partial / one-sided date ranges**
  - **Setup**: Source 1: `{ from: "2026-02-01", to: null }`, Source 2: `{ from: null, to: "2026-11-30" }`.
  - **Expectation**: `impossible: false`, resolved value is `{ from: "2026-02-01", to: "2026-11-30" }`.

```typescript
it("resolves date ranges using max(from) and min(to)", () => {
  const periodDim: FilterDimension = {
    id: "period",
    label: "Period",
    type: "dateRange",
    control: { location: "dashboard" },
  };
  const source1: FilterSource = { kind: "control", dimensionId: "period" };
  const source2: FilterSource = {
    kind: "chartSelection",
    actionId: "date-select",
    sourceChartID: chartA,
  };
  const target: FilterTarget = { kind: "dashboard" };

  const resolved = resolveChartFilters({
    chartID: chartA,
    tab: "Overview",
    dimensions: [periodDim],
    contributions: [
      makeContribution(source1, target, "period", {
        from: "2026-01-01",
        to: "2026-08-31",
      }),
      makeContribution(source2, target, "period", {
        from: "2026-03-01",
        to: "2026-10-15",
      }),
    ],
    bindings: { period: "period" },
  });

  expect(resolved.impossible).toBe(false);
  expect(resolved.dimensionValues.period).toEqual({
    from: "2026-03-01",
    to: "2026-08-31",
  });
});

it("marks inverted date ranges (from > to) as impossible conflicts", () => {
  const periodDim: FilterDimension = {
    id: "period",
    label: "Period",
    type: "dateRange",
    control: { location: "dashboard" },
  };
  const source1: FilterSource = { kind: "control", dimensionId: "period" };
  const source2: FilterSource = {
    kind: "chartSelection",
    actionId: "date-select",
    sourceChartID: chartA,
  };
  const target: FilterTarget = { kind: "dashboard" };

  const resolved = resolveChartFilters({
    chartID: chartA,
    tab: "Overview",
    dimensions: [periodDim],
    contributions: [
      makeContribution(source1, target, "period", {
        from: "2026-07-01",
        to: "2026-12-31",
      }),
      makeContribution(source2, target, "period", {
        from: "2026-01-01",
        to: "2026-05-31",
      }),
    ],
    bindings: { period: "period" },
  });

  expect(resolved.impossible).toBe(true);
  expect(resolved.conflicts).toEqual(["period"]);
  expect(resolved.conflictKeys.length).toBe(2);
});