import { describe, it, beforeEach } from "vitest";
import assert from "node:assert/strict";
import useFiltersStore, { tabKey } from "../stores/filterProvider";

describe("stores/filterProvider dimension validation", () => {
  it("rejects duplicate dimension ids during initialization", () => {
    useFiltersStore.getState().resetFilterStore();

    assert.throws(() =>
      useFiltersStore.getState().initFilterStore({
        dimensions: [
          {
            id: "region",
            label: "Global Region",
            scope: "global",
            type: "string",
          },
          {
            id: "region",
            label: "Tab Region",
            scope: "tab",
            type: "string",
            tab: "TabB",
          },
        ],
        initialActiveTab: "TabA",
      }),
      /Filter dimension id "region" must be unique within a dashboard\./,
    );
  });
});

describe("stores/filterProvider tab jumps", () => {
  const dimensions: FilterDimension[] = [
    {
      id: "region",
      label: "Region",
      scope: "tab",
      type: "multiselect",
      tab: "TabB",
    },
    {
      id: "error_code",
      label: "Error Code",
      scope: "tab",
      type: "select",
      tab: "TabB",
    },
    {
      id: "count",
      label: "Count",
      scope: "tab",
      type: "number",
      tab: "TabB",
    },
    {
      id: "created_at",
      label: "Created At",
      scope: "tab",
      type: "dateString",
      tab: "TabB",
      defaultValue: "-3 months",
    },
    {
      id: "global_dim",
      label: "Global Dim",
      scope: "global",
      type: "string",
    },
    {
      id: "shadowed_dim",
      label: "Shadowed Dim",
      scope: "global",
      type: "string",
    },
    {
      id: "tab_c_dim",
      label: "Tab C Dim",
      scope: "tab",
      type: "string",
      tab: "TabC",
    },
  ];

  beforeEach(() => {
    useFiltersStore.getState().resetFilterStore();
    useFiltersStore.getState().initFilterStore({
      dimensions,
      initialActiveTab: "TabA",
    });
  });

  it("executeTabJump writes draftValues, appliedValues, hasApplied, activeTab, and breadcrumbs in a single state update", () => {
    let subscriberNotifications = 0;
    const unsubscribe = useFiltersStore.subscribe(() => {
      subscriberNotifications++;
    });

    const jump: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabB",
      label: "Go to Tab B",
      mappings: [
        {
          sourceField: "regionCode",
          targetDimensionId: "region",
        },
      ],
    };

    const selectedRows = [
      { regionCode: "EU" },
      { regionCode: "US" },
    ];

    const success = useFiltersStore.getState().executeTabJump(jump, selectedRows, "Chart One");
    unsubscribe();

    assert.equal(success, true);
    assert.equal(subscriberNotifications, 1, "Expected exactly 1 subscriber notification");

    const state = useFiltersStore.getState();
    const key = tabKey("TabB", "region");
    assert.deepEqual(state.draftValues[key], ["EU", "US"]);
    assert.deepEqual(state.appliedValues[key], ["EU", "US"]);
    assert.equal(state.hasApplied, true);
    assert.equal(state.activeTab, "TabB");
    assert.equal(state.breadcrumbs.length, 1);
    assert.equal(state.breadcrumbs[0].fromTab, "TabA");
    assert.equal(state.breadcrumbs[0].targetTab, "TabB");
    assert.equal(state.breadcrumbs[0].fromChartTitle, "Chart One");
  });

  it("multi-value selection into a single-select target returns false and mutates nothing", () => {
    const jump: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabB",
      mappings: [
        {
          sourceField: "code",
          targetDimensionId: "error_code",
        },
      ],
    };

    const selectedRows = [
      { code: "ERR_1" },
      { code: "ERR_2" },
    ];

    const stateBefore = { ...useFiltersStore.getState() };
    const success = useFiltersStore.getState().executeTabJump(jump, selectedRows);

    assert.equal(success, false);
    const stateAfter = useFiltersStore.getState();
    assert.deepEqual(stateAfter.draftValues, stateBefore.draftValues);
    assert.deepEqual(stateAfter.appliedValues, stateBefore.appliedValues);
    assert.equal(stateAfter.activeTab, "TabA");
    assert.equal(stateAfter.breadcrumbs.length, 0);
  });

  it("multi-value selection into a multiselect target produces a deduplicated string[]", () => {
    const jump: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabB",
      mappings: [
        {
          sourceField: "regionCode",
          targetDimensionId: "region",
        },
      ],
    };

    const selectedRows = [
      { regionCode: "EU" },
      { regionCode: "US" },
      { regionCode: "EU" },
    ];

    const success = useFiltersStore.getState().executeTabJump(jump, selectedRows);
    assert.equal(success, true);

    const state = useFiltersStore.getState();
    const key = tabKey("TabB", "region");
    assert.deepEqual(state.appliedValues[key], ["EU", "US"]);
  });

  it("non-primitive sourceField values (arrays/objects) abort the jump", () => {
    const jump: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabB",
      mappings: [
        {
          sourceField: "series",
          targetDimensionId: "region",
        },
      ],
    };

    const selectedRows = [
      { series: [1, 2, 3] },
      { series: { a: 1 } },
    ];

    const success = useFiltersStore.getState().executeTabJump(jump, selectedRows);
    assert.equal(success, false);
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 0);
  });

  it("rejects date targets and dimensions outside the target tab", () => {
    const dateJump: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabB",
      mappings: [
        {
          sourceField: "date",
          targetDimensionId: "created_at",
        },
      ],
    };

    assert.equal(useFiltersStore.getState().executeTabJump(dateJump, [{ date: "2026-01-01" }]), false);

    const globalDimensionJump: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabB",
      mappings: [
        {
          sourceField: "val",
          targetDimensionId: "shadowed_dim",
        },
      ],
    };

    assert.equal(useFiltersStore.getState().executeTabJump(globalDimensionJump, [{ val: "val1" }]), false);
  });

  it("previousValues captures undefined for unset keys; navigateBack deletes the key rather than writing back raw defaultValue", () => {
    const jump: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabB",
      mappings: [
        {
          sourceField: "code",
          targetDimensionId: "error_code",
        },
      ],
    };

    const key = tabKey("TabB", "error_code");
    assert.equal(useFiltersStore.getState().appliedValues[key], undefined);

    const success = useFiltersStore.getState().executeTabJump(jump, [{ code: "ERR_1" }]);
    assert.equal(success, true);
    assert.equal(useFiltersStore.getState().appliedValues[key], "ERR_1");

    useFiltersStore.getState().navigateBack();
    const stateAfterBack = useFiltersStore.getState();
    assert.equal(stateAfterBack.activeTab, "TabA");
    assert.equal(stateAfterBack.appliedValues[key], undefined);
    assert.equal(stateAfterBack.draftValues[key], undefined);
    assert.equal(Object.hasOwn(stateAfterBack.appliedValues, key), false);
    assert.equal(stateAfterBack.breadcrumbs.length, 0);
  });

  it("navigateBack restores a pre-existing value and returns to fromTab", () => {
    const key = tabKey("TabB", "error_code");
    useFiltersStore.getState().setDraftFilter(key, "OLD_VAL");
    useFiltersStore.getState().applyFilters();
    assert.equal(useFiltersStore.getState().appliedValues[key], "OLD_VAL");

    const jump: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabB",
      mappings: [
        {
          sourceField: "code",
          targetDimensionId: "error_code",
        },
      ],
    };

    useFiltersStore.getState().executeTabJump(jump, [{ code: "NEW_VAL" }]);
    assert.equal(useFiltersStore.getState().appliedValues[key], "NEW_VAL");

    useFiltersStore.getState().navigateBack();
    const stateAfterBack = useFiltersStore.getState();
    assert.equal(stateAfterBack.activeTab, "TabA");
    assert.equal(stateAfterBack.appliedValues[key], "OLD_VAL");
    assert.equal(stateAfterBack.draftValues[key], "OLD_VAL");
    assert.equal(stateAfterBack.breadcrumbs.length, 0);
  });

  it("nested A->B->C: two pops restore each level in order", () => {
    const jump1: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabB",
      mappings: [
        {
          sourceField: "code",
          targetDimensionId: "error_code",
        },
      ],
    };

    const jump2: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabC",
      mappings: [
        {
          sourceField: "cVal",
          targetDimensionId: "tab_c_dim",
        },
      ],
    };

    // Tab A -> Tab B
    useFiltersStore.getState().executeTabJump(jump1, [{ code: "ERR_TAB_B" }]);
    assert.equal(useFiltersStore.getState().activeTab, "TabB");
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 1);

    // Tab B -> Tab C
    useFiltersStore.getState().executeTabJump(jump2, [{ cVal: "VAL_TAB_C" }]);
    assert.equal(useFiltersStore.getState().activeTab, "TabC");
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 2);

    const keyB = tabKey("TabB", "error_code");
    const keyC = tabKey("TabC", "tab_c_dim");
    assert.equal(useFiltersStore.getState().appliedValues[keyB], "ERR_TAB_B");
    assert.equal(useFiltersStore.getState().appliedValues[keyC], "VAL_TAB_C");

    // Pop 1: C -> B
    useFiltersStore.getState().navigateBack();
    assert.equal(useFiltersStore.getState().activeTab, "TabB");
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 1);
    assert.equal(useFiltersStore.getState().appliedValues[keyB], "ERR_TAB_B");
    assert.equal(useFiltersStore.getState().appliedValues[keyC], undefined);

    // Pop 2: B -> A
    useFiltersStore.getState().navigateBack();
    assert.equal(useFiltersStore.getState().activeTab, "TabA");
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 0);
    assert.equal(useFiltersStore.getState().appliedValues[keyB], undefined);
  });

  it("setActiveTab to an unrelated tab clears the stack; executeTabJump and navigateBack do not", () => {
    const jump: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabB",
      mappings: [
        {
          sourceField: "code",
          targetDimensionId: "error_code",
        },
      ],
    };

    useFiltersStore.getState().executeTabJump(jump, [{ code: "ERR_1" }]);
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 1);

    // setActiveTab to same tab (TabB) does not clear
    useFiltersStore.getState().setActiveTab("TabB");
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 1);

    // setActiveTab to unrelated tab (TabA) clears stack
    useFiltersStore.getState().setActiveTab("TabA");
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 0);
  });

  it("clearDimension on the last remaining appliedKey dismisses the breadcrumb", () => {
    const jump: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabB",
      mappings: [
        {
          sourceField: "code",
          targetDimensionId: "error_code",
        },
        {
          sourceField: "regionCode",
          targetDimensionId: "region",
        },
      ],
    };

    useFiltersStore.getState().executeTabJump(jump, [{ code: "ERR_1", regionCode: "EU" }]);
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 1);

    const key1 = tabKey("TabB", "error_code");
    const key2 = tabKey("TabB", "region");

    // Clearing one key leaves the breadcrumb active
    useFiltersStore.getState().clearDimension(key1);
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 1);

    // Clearing the last key dismisses the breadcrumb
    useFiltersStore.getState().clearDimension(key2);
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 0);
  });

  it("resetFilterStore empties breadcrumbs", () => {
    const jump: TabJumpConfig = {
      fromChartID: "123456as",
      targetTab: "TabB",
      mappings: [
        {
          sourceField: "code",
          targetDimensionId: "error_code",
        },
      ],
    };

    useFiltersStore.getState().executeTabJump(jump, [{ code: "ERR_1" }]);
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 1);

    useFiltersStore.getState().resetFilterStore();
    assert.equal(useFiltersStore.getState().breadcrumbs.length, 0);
  });
});
