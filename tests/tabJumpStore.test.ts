import assert from "node:assert/strict";
import { beforeEach, describe, it } from "vitest";

import { contributionKey } from "../lib/filters/contributions";
import useFiltersStore, {
  controlContributionKey,
} from "../stores/filterProvider";

const chartA = "69e28f7b-a25a-4911-ae2c-64b3ab5ca155" as TableSchemaKey;
const chartB = "8ea746c9-7d14-4e4a-b5fc-49c805430320" as TableSchemaKey;

const dimensions: FilterDimension[] = [
  {
    id: "global_region",
    label: "Global Region",
    type: "multiselect",
    control: { location: "dashboard" },
  },
  {
    id: "region",
    label: "Region",
    type: "multiselect",
    control: { location: "tab", tab: "TabB" },
  },
  {
    id: "error_code",
    label: "Error Code",
    type: "select",
    control: { location: "tab", tab: "TabB" },
  },
  {
    id: "count",
    label: "Count",
    type: "number",
    control: { location: "tab", tab: "TabB" },
  },
  {
    id: "tab_c_dim",
    label: "Tab C Dim",
    type: "string",
    control: { location: "tab", tab: "TabC" },
  },
];

const jump = (
  id: string,
  targetTab: string,
  sourceField: string,
  targetDimensionId: string,
): TabJumpConfig => ({
  id,
  fromChartID: chartA,
  targetTab,
  mappings: [{ sourceField, targetDimensionId }],
});

const jumpKey = (
  actionId: string,
  targetTab: string,
  dimensionId: string,
): string =>
  contributionKey(
    { kind: "tabJump", actionId, sourceChartID: chartA },
    { kind: "tab", tab: targetTab },
    dimensionId,
  );

describe("stores/filterProvider unified contributions", () => {
  beforeEach(() => {
    useFiltersStore.getState().resetFilterStore();
    useFiltersStore.getState().initFilterStore({
      dimensions,
      initialActiveTab: "TabA",
    });
  });

  it("keeps control edits in draft until apply and resets to applied", () => {
    const key = controlContributionKey(dimensions[0])!;

    useFiltersStore.getState().setDraftFilter("global_region", ["EU"]);
    assert.deepEqual(
      useFiltersStore.getState().draftContributions[key].value,
      ["EU"],
    );
    assert.equal(useFiltersStore.getState().appliedContributions[key], undefined);

    useFiltersStore.getState().applyFilters();
    useFiltersStore.getState().setDraftFilter("global_region", ["US"]);
    useFiltersStore.getState().resetDraft();
    assert.deepEqual(
      useFiltersStore.getState().draftContributions[key].value,
      ["EU"],
    );
  });

  it("applies a tab jump atomically and deduplicates multiselect values", () => {
    let notifications = 0;
    const unsubscribe = useFiltersStore.subscribe(() => notifications++);
    const success = useFiltersStore
      .getState()
      .executeTabJump(
        jump("region-jump", "TabB", "regionCode", "region"),
        [{ regionCode: "EU" }, { regionCode: "US" }, { regionCode: "EU" }],
        "Chart One",
      );
    unsubscribe();

    const key = jumpKey("region-jump", "TabB", "region");
    const state = useFiltersStore.getState();
    assert.equal(success, true);
    assert.equal(notifications, 1);
    assert.deepEqual(state.appliedContributions[key].value, ["EU", "US"]);
    assert.deepEqual(state.draftContributions[key].value, ["EU", "US"]);
    assert.equal(state.activeTab, "TabB");
    assert.equal(state.hasApplied, true);
    assert.equal(state.breadcrumbs[0].fromChartTitle, "Chart One");
  });

  it("rejects multiple values for a single-value target without mutation", () => {
    const before = useFiltersStore.getState();
    const success = useFiltersStore
      .getState()
      .executeTabJump(
        jump("error-jump", "TabB", "code", "error_code"),
        [{ code: "A" }, { code: "B" }],
      );

    assert.equal(success, false);
    assert.deepEqual(
      useFiltersStore.getState().appliedContributions,
      before.appliedContributions,
    );
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 0);
  });

  it("keeps control and tab-jump contributions distinct and rolls back exactly", () => {
    const controlKey = controlContributionKey(dimensions[2])!;
    useFiltersStore.getState().setDraftFilter("error_code", "OLD");
    useFiltersStore.getState().applyFilters();

    const config = jump("error-jump", "TabB", "code", "error_code");
    assert.equal(
      useFiltersStore.getState().executeTabJump(config, [{ code: "NEW" }]),
      true,
    );

    const actionKey = jumpKey("error-jump", "TabB", "error_code");
    assert.equal(
      useFiltersStore.getState().appliedContributions[controlKey].value,
      "OLD",
    );
    assert.equal(
      useFiltersStore.getState().appliedContributions[actionKey].value,
      "NEW",
    );

    useFiltersStore.getState().navigateBack();
    assert.equal(
      useFiltersStore.getState().appliedContributions[controlKey].value,
      "OLD",
    );
    assert.equal(
      useFiltersStore.getState().appliedContributions[actionKey],
      undefined,
    );
    assert.equal(useFiltersStore.getState().activeTab, "TabA");
  });

  it("rolls nested tab jumps back one contribution set at a time", () => {
    useFiltersStore
      .getState()
      .executeTabJump(
        jump("to-b", "TabB", "code", "error_code"),
        [{ code: "B" }],
      );
    useFiltersStore
      .getState()
      .executeTabJump(
        jump("to-c", "TabC", "value", "tab_c_dim"),
        [{ value: "C" }],
      );

    useFiltersStore.getState().navigateBack();
    assert.equal(useFiltersStore.getState().activeTab, "TabB");
    assert.equal(
      useFiltersStore.getState().appliedContributions[
        jumpKey("to-c", "TabC", "tab_c_dim")
      ],
      undefined,
    );

    useFiltersStore.getState().navigateBack();
    assert.equal(useFiltersStore.getState().activeTab, "TabA");
    assert.equal(
      useFiltersStore.getState().appliedContributions[
        jumpKey("to-b", "TabB", "error_code")
      ],
      undefined,
    );
  });

  it("stages one chart action and applies it without dropping controls", () => {
    useFiltersStore.getState().setDraftFilter("global_region", ["EU", "US"]);
    useFiltersStore.getState().applyFilters();
    const source: FilterSource = {
      kind: "chartSelection",
      actionId: "filter-b",
      sourceChartID: chartA,
    };
    const target: FilterTarget = { kind: "chart", chartID: chartB };
    const key = contributionKey(source, target, "region");
    const contribution: FilterContribution = {
      key,
      dimensionId: "region",
      source,
      target,
      value: ["EU"],
    };

    useFiltersStore.getState().stagePendingAction(chartA, [contribution]);
    assert.equal(useFiltersStore.getState().appliedContributions[key], undefined);
    useFiltersStore.getState().applyPendingAction();

    assert.deepEqual(
      useFiltersStore.getState().appliedContributions[key].value,
      ["EU"],
    );
    assert.equal(useFiltersStore.getState().pendingAction, null);
    assert.ok(
      useFiltersStore.getState().appliedContributions[
        controlContributionKey(dimensions[0])!
      ],
    );
  });

  it("hydrates V1 scoped values and V2 contributions", () => {
    useFiltersStore.getState().hydrateSnapshot({
      values: { "global:global_region": ["EU"] },
      activeTab: "TabB",
    });
    const controlKey = controlContributionKey(dimensions[0])!;
    assert.deepEqual(
      useFiltersStore.getState().appliedContributions[controlKey].value,
      ["EU"],
    );

    const source: FilterSource = {
      kind: "chartSelection",
      actionId: "filter-b",
      sourceChartID: chartA,
    };
    const target: FilterTarget = { kind: "chart", chartID: chartB };
    const key = contributionKey(source, target, "region");
    const contribution: FilterContribution = {
      key,
      dimensionId: "region",
      source,
      target,
      value: ["US"],
    };
    useFiltersStore.getState().hydrateSnapshot({
      version: 2,
      contributions: { [key]: contribution },
      activeTab: "TabA",
    });
    assert.deepEqual(useFiltersStore.getState().appliedContributions, {
      [key]: contribution,
    });
  });

  it("clearAll returns to the seeded defaults and the idle state", () => {
    useFiltersStore.getState().setDraftFilter("global_region", ["EU"]);
    useFiltersStore.getState().applyFilters();
    useFiltersStore
      .getState()
      .executeTabJump(
        jump("to-b", "TabB", "code", "error_code"),
        [{ code: "A" }],
      );
    useFiltersStore.getState().stagePendingAction(chartA, []);
    useFiltersStore.getState().clearAll();

    const state = useFiltersStore.getState();
    assert.deepEqual(state.draftContributions, {});
    assert.deepEqual(state.appliedContributions, {});
    assert.equal(state.pendingAction, null);
    assert.deepEqual(state.breadcrumbs, []);
    assert.equal(state.hasApplied, false);

    useFiltersStore.getState().resetFilterStore();
    useFiltersStore.getState().initFilterStore({
      dimensions: [
        { ...dimensions[0], defaultValue: ["EU"] },
        ...dimensions.slice(1),
      ],
      initialActiveTab: "TabA",
    });
    const defaultKey = controlContributionKey(dimensions[0])!;
    useFiltersStore.getState().setDraftFilter("global_region", ["US"]);
    useFiltersStore.getState().applyFilters();
    useFiltersStore.getState().clearAll();

    assert.deepEqual(
      useFiltersStore.getState().appliedContributions[defaultKey].value,
      ["EU"],
    );
  });

  it("stages one action at a time", () => {
    const stage = (actionId: string, value: string[]): FilterContribution => {
      const source: FilterSource = {
        kind: "chartSelection",
        actionId,
        sourceChartID: chartA,
      };
      const target: FilterTarget = { kind: "chart", chartID: chartB };

      return {
        key: contributionKey(source, target, "region"),
        dimensionId: "region",
        source,
        target,
        value,
      };
    };

    useFiltersStore.getState().stagePendingAction(chartA, [stage("one", ["EU"])]);
    useFiltersStore.getState().stagePendingAction(chartB, [stage("two", ["US"])]);

    const pending = useFiltersStore.getState().pendingAction!;
    assert.equal(pending.sourceChartID, chartB);
    assert.deepEqual(pending.contributions[0].value, ["US"]);
  });

  it("clears action contributions per action and per source", () => {
    const action = (actionId: string, value: string[]): FilterContribution => {
      const source: FilterSource = {
        kind: "chartSelection",
        actionId,
        sourceChartID: chartA,
      };
      const target: FilterTarget = { kind: "chart", chartID: chartB };

      return {
        key: contributionKey(source, target, "region"),
        dimensionId: "region",
        source,
        target,
        value,
      };
    };
    const one = action("one", ["EU"]);
    const two = action("two", ["US"]);

    useFiltersStore.getState().applyActionContributions(chartA, [one, two]);
    useFiltersStore
      .getState()
      .executeTabJump(
        jump("to-b", "TabB", "code", "error_code"),
        [{ code: "A" }],
      );

    useFiltersStore.getState().clearActionSource(chartA, ["one"]);
    assert.equal(
      useFiltersStore.getState().appliedContributions[one.key],
      undefined,
    );
    assert.ok(useFiltersStore.getState().appliedContributions[two.key]);

    useFiltersStore.getState().clearActionSource(chartA);
    assert.equal(
      useFiltersStore.getState().appliedContributions[two.key],
      undefined,
    );
    // Tab-jump contributions belong to a different lifecycle.
    assert.ok(
      useFiltersStore.getState().appliedContributions[
        jumpKey("to-b", "TabB", "error_code")
      ],
    );
  });

  it("clears a staged action only for the named source chart", () => {
    const source: FilterSource = {
      kind: "chartSelection",
      actionId: "one",
      sourceChartID: chartA,
    };
    const target: FilterTarget = { kind: "chart", chartID: chartB };
    const contribution: FilterContribution = {
      key: contributionKey(source, target, "region"),
      dimensionId: "region",
      source,
      target,
      value: ["EU"],
    };

    useFiltersStore.getState().stagePendingAction(chartA, [contribution]);
    useFiltersStore.getState().clearPendingAction(chartB);
    assert.equal(
      useFiltersStore.getState().pendingAction?.sourceChartID,
      chartA,
    );

    useFiltersStore.getState().clearPendingAction(chartA);
    assert.equal(useFiltersStore.getState().pendingAction, null);
  });

  it("ignores a V1 snapshot without values instead of throwing", () => {
    useFiltersStore.getState().setDraftFilter("global_region", ["EU"]);
    useFiltersStore.getState().applyFilters();
    const before = useFiltersStore.getState().appliedContributions;

    useFiltersStore.getState().hydrateSnapshot({
      activeTab: "TabB",
    } as unknown as FilterSnapshot);

    assert.deepEqual(
      useFiltersStore.getState().appliedContributions,
      before,
    );
    assert.equal(useFiltersStore.getState().activeTab, "TabA");
  });

  it("rejects a tampered V2 snapshot without partially applying it", () => {
    useFiltersStore.getState().setDraftFilter("global_region", ["EU"]);
    useFiltersStore.getState().applyFilters();
    const before = useFiltersStore.getState().appliedContributions;

    const source: FilterSource = {
      kind: "chartSelection",
      actionId: "filter-b",
      sourceChartID: chartA,
    };
    const target: FilterTarget = { kind: "chart", chartID: chartB };
    const key = contributionKey(source, target, "region");
    const valid: FilterContribution = {
      key,
      dimensionId: "region",
      source,
      target,
      value: ["US"],
    };

    useFiltersStore.getState().hydrateSnapshot({
      version: 2,
      contributions: { "control|forged|dashboard||region": valid },
      activeTab: "TabA",
    });
    assert.deepEqual(useFiltersStore.getState().appliedContributions, before);

    useFiltersStore.getState().hydrateSnapshot({
      version: 2,
      contributions: {
        [key]: { ...valid, value: "US" as unknown as string[] },
      },
      activeTab: "TabA",
    });
    assert.deepEqual(useFiltersStore.getState().appliedContributions, before);

    useFiltersStore.getState().hydrateSnapshot({
      version: 2,
      contributions: {
        [key]: valid,
        "control|ghost|dashboard||ghost": {
          key: "control|ghost|dashboard||ghost",
          dimensionId: "ghost",
          source: { kind: "control", dimensionId: "ghost" },
          target: { kind: "dashboard" },
          value: "x",
        },
      },
      activeTab: "TabA",
    });
    assert.deepEqual(useFiltersStore.getState().appliedContributions, before);
  });
});
