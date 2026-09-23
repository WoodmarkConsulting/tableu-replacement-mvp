import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TooltipDataPoint, TooltipPathResponse } from "../app/api/utils/types";
import {
  handleChartContextSync,
  resolveChartActions,
} from "../components/ChartWrapper/chartActions";
import { contributionKey } from "../lib/filters/contributions";
import useFiltersStore from "../stores/filterProvider";

const chartA = "69e28f7b-a25a-4911-ae2c-64b3ab5ca155" as TableSchemaKey;
const chartB = "8ea746c9-7d14-4e4a-b5fc-49c805430320" as TableSchemaKey;

const dimensions: FilterDimension[] = [
  {
    id: "region",
    label: "Region",
    type: "multiselect",
    control: { location: "dashboard" },
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    control: { location: "tab", tab: "Overview" },
  },
];

describe("behaviors B1-B8 regression tests", () => {
  beforeEach(() => {
    useFiltersStore.getState().resetFilterStore();
    useFiltersStore.getState().initFilterStore({
      dimensions,
      initialActiveTab: "Overview",
    });
  });

  it("B1: A stale async resolution must never overwrite a newer selection", async () => {
    vi.useFakeTimers();
    try {
      const actionRequestRef = { current: 0 };
      let resolvedContributions: {
        context: string;
        contributions: FilterContribution[];
      } | null = null;

      const action: ChartAction = {
        id: "act-async",
        fromChartID: chartA,
        sourceResolution: "tooltipLookup",
        trigger: "auto",
        target: { kind: "chart", chartID: chartB },
        mappings: [{ sourceField: "region", targetDimensionId: "region" }],
      };

      const fetchTooltipMock = (
        _chartID: string,
        rows: TooltipDataPoint[],
      ): Promise<TooltipPathResponse> => {
        const val = (rows[0] as Record<string, unknown>).val as string;
        const delay = val === "stale" ? 100 : 20;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              dataPoint: [{ region: val }],
              failedBatches: 0,
            });
          }, delay);
        });
      };

      // Selection 1: slow (100ms)
      const p1 = resolveChartActions({
        chartID: chartA,
        zoomContext: "ctx-1",
        dimensions,
        outgoingActions: [action],
        rows: [{ val: "stale" }],
        fetchTooltip: fetchTooltipMock,
        actionRequestRef,
        setResolvedActionContributions: (val) => {
          resolvedContributions = val;
        },
        stagePendingAction: (cId, c) =>
          useFiltersStore.getState().stagePendingAction(cId, c),
        clearPendingAction: (cId) =>
          useFiltersStore.getState().clearPendingAction(cId),
        applyActionContributions: (cId, c, aIds) =>
          useFiltersStore.getState().applyActionContributions(cId, c, aIds),
        clearActionSource: (cId, aIds) =>
          useFiltersStore.getState().clearActionSource(cId, aIds),
      });

      // Selection 2: fast (20ms) - newer selection initiated before Selection 1 resolves
      const p2 = resolveChartActions({
        chartID: chartA,
        zoomContext: "ctx-1",
        dimensions,
        outgoingActions: [action],
        rows: [{ val: "fresh" }],
        fetchTooltip: fetchTooltipMock,
        actionRequestRef,
        setResolvedActionContributions: (val) => {
          resolvedContributions = val;
        },
        stagePendingAction: (cId, c) =>
          useFiltersStore.getState().stagePendingAction(cId, c),
        clearPendingAction: (cId) =>
          useFiltersStore.getState().clearPendingAction(cId),
        applyActionContributions: (cId, c, aIds) =>
          useFiltersStore.getState().applyActionContributions(cId, c, aIds),
        clearActionSource: (cId, aIds) =>
          useFiltersStore.getState().clearActionSource(cId, aIds),
      });

      // Advance by 25ms: Selection 2 finishes and applies to store
      await vi.advanceTimersByTimeAsync(25);
      await p2;

      const key = contributionKey(
        { kind: "chartSelection", actionId: action.id, sourceChartID: chartA },
        { kind: "chart", chartID: chartB },
        "region",
      );
      expect(
        useFiltersStore.getState().appliedContributions[key]?.value,
      ).toEqual(["fresh"]);

      // Advance remaining 80ms: Selection 1 finishes, but its requestID is stale
      await vi.advanceTimersByTimeAsync(80);
      await p1;

      // Stale resolution must NOT overwrite fresh
      expect(
        useFiltersStore.getState().appliedContributions[key]?.value,
      ).toEqual(["fresh"]);
      expect(
        (resolvedContributions as { contributions: FilterContribution[] } | null)
          ?.contributions[0]?.value,
      ).toEqual(["fresh"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("B2: Mounting a chart must not clear its selection or the filters it applied to another tab", () => {
    const action: ChartAction = {
      id: "act-b2",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "auto",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "region", targetDimensionId: "region" }],
    };
    const contrib: FilterContribution = {
      key: contributionKey(
        { kind: "chartSelection", actionId: action.id, sourceChartID: chartA },
        { kind: "chart", chartID: chartB },
        "region",
      ),
      dimensionId: "region",
      source: { kind: "chartSelection", actionId: action.id, sourceChartID: chartA },
      target: { kind: "chart", chartID: chartB },
      value: ["EU"],
    };

    // Chart A has applied a cross-tab contribution to Chart B
    useFiltersStore.getState().applyActionContributions(chartA, [contrib], [action.id]);
    expect(useFiltersStore.getState().appliedContributions[contrib.key]).toBeDefined();

    // Chart A mounts: appliedContextRef is initially null
    const appliedContextRef = { current: null as string | null };
    const actionRequestRef = { current: 0 };
    let selectionInvalidated = false;

    // First run (mount) of handleChartContextSync with zoomContext "ctx-1"
    const changedOnMount = handleChartContextSync({
      chartID: chartA,
      zoomContext: "ctx-1",
      appliedContextRef,
      actionRequestRef,
      outgoingActions: [action],
      clearActionSource: (id) => useFiltersStore.getState().clearActionSource(id),
      onInvalidateSelection: () => {
        selectionInvalidated = true;
      },
    });

    // Mount must NOT clear the applied cross-tab filter and must not invalidate selection
    expect(changedOnMount).toBe(false);
    expect(selectionInvalidated).toBe(false);
    expect(appliedContextRef.current).toBe("ctx-1");
    expect(actionRequestRef.current).toBe(0);
    expect(useFiltersStore.getState().appliedContributions[contrib.key]).toBeDefined();

    // Chart A unmounts (e.g. user switched tabs)
    useFiltersStore.getState().clearPendingAction(chartA);
    // Applied contributions outlive the chart unmount
    expect(useFiltersStore.getState().appliedContributions[contrib.key]).toBeDefined();

    // Chart A remounts when user switches back to Chart A's tab (new mount with null ref)
    const remountAppliedContextRef = { current: null as string | null };
    const changedOnRemount = handleChartContextSync({
      chartID: chartA,
      zoomContext: "ctx-1",
      appliedContextRef: remountAppliedContextRef,
      actionRequestRef,
      outgoingActions: [action],
      clearActionSource: (id) => useFiltersStore.getState().clearActionSource(id),
      onInvalidateSelection: () => {
        selectionInvalidated = true;
      },
    });

    // Remounting must still NOT clear the cross-tab filter
    expect(changedOnRemount).toBe(false);
    expect(selectionInvalidated).toBe(false);
    expect(useFiltersStore.getState().appliedContributions[contrib.key]).toBeDefined();
  });

  it("failed tooltipLookup does not discard synchronously resolved clientRow contributions", async () => {
    const actionRequestRef = { current: 0 };
    let resolvedContributions: {
      context: string;
      contributions: FilterContribution[];
    } | null = null;

    const clientAction: ChartAction = {
      id: "act-client",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "auto",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "region", targetDimensionId: "region" }],
    };
    const tooltipAction: ChartAction = {
      id: "act-tooltip",
      fromChartID: chartA,
      sourceResolution: "tooltipLookup",
      trigger: "manual",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "status", targetDimensionId: "status" }],
    };

    const failingFetchTooltip = (): Promise<TooltipPathResponse> => {
      return Promise.reject(new Error("Warehouse timeout"));
    };

    await resolveChartActions({
      chartID: chartA,
      zoomContext: "ctx-1",
      dimensions,
      outgoingActions: [clientAction, tooltipAction],
      rows: [{ region: "EU" }],
      fetchTooltip: failingFetchTooltip,
      actionRequestRef,
      setResolvedActionContributions: (val) => {
        resolvedContributions = val;
      },
      stagePendingAction: (cId, c) =>
        useFiltersStore.getState().stagePendingAction(cId, c),
      clearPendingAction: (cId) =>
        useFiltersStore.getState().clearPendingAction(cId),
      applyActionContributions: (cId, c, aIds) =>
        useFiltersStore.getState().applyActionContributions(cId, c, aIds),
      clearActionSource: (cId, aIds) =>
        useFiltersStore.getState().clearActionSource(cId, aIds),
    });

    const clientKey = contributionKey(
      {
        kind: "chartSelection",
        actionId: clientAction.id,
        sourceChartID: chartA,
      },
      { kind: "chart", chartID: chartB },
      "region",
    );
    // ClientRow contribution applied and staged despite tooltip failure
    expect(
      useFiltersStore.getState().appliedContributions[clientKey]?.value,
    ).toEqual(["EU"]);
    expect(
      (resolvedContributions as { contributions: FilterContribution[] } | null)
        ?.contributions,
    ).toHaveLength(1);
    expect(
      (resolvedContributions as { contributions: FilterContribution[] } | null)
        ?.contributions[0]?.dimensionId,
    ).toBe("region");
    // The failed roundtrip is recorded so the menu can show an error instead of
    // staying stuck on "loading".
    expect(
      (resolvedContributions as { failed: boolean } | null)?.failed,
    ).toBe(true);
  });

  it("publishes clientRow contributions before a sibling tooltipLookup resolves", async () => {
    vi.useFakeTimers();
    try {
      const actionRequestRef = { current: 0 };
      const published: Array<{
        context: string;
        contributions: FilterContribution[];
      } | null> = [];

      const clientAction: ChartAction = {
        id: "act-client-early",
        fromChartID: chartA,
        sourceResolution: "clientRow",
        trigger: "manual",
        target: { kind: "chart", chartID: chartB },
        mappings: [{ sourceField: "region", targetDimensionId: "region" }],
      };
      const tooltipAction: ChartAction = {
        id: "act-tooltip-late",
        fromChartID: chartA,
        sourceResolution: "tooltipLookup",
        trigger: "manual",
        target: { kind: "chart", chartID: chartB },
        mappings: [{ sourceField: "status", targetDimensionId: "status" }],
      };

      const pending = resolveChartActions({
        chartID: chartA,
        zoomContext: "ctx-early",
        dimensions,
        outgoingActions: [clientAction, tooltipAction],
        rows: [{ region: "EU" }],
        fetchTooltip: () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  dataPoint: [{ status: "open" }],
                  failedBatches: 0,
                }),
              50,
            );
          }),
        actionRequestRef,
        setResolvedActionContributions: (val) => {
          published.push(val);
        },
        stagePendingAction: (cId, c) =>
          useFiltersStore.getState().stagePendingAction(cId, c),
        clearPendingAction: (cId) =>
          useFiltersStore.getState().clearPendingAction(cId),
        applyActionContributions: (cId, c, aIds) =>
          useFiltersStore.getState().applyActionContributions(cId, c, aIds),
        clearActionSource: (cId, aIds) =>
          useFiltersStore.getState().clearActionSource(cId, aIds),
      });

      await Promise.resolve();

      const early = published.find((entry) => entry !== null);
      expect(early?.contributions).toHaveLength(1);
      expect(early?.contributions[0]?.dimensionId).toBe("region");
      expect(early?.contributions[0]?.value).toEqual(["EU"]);
      expect(
        useFiltersStore.getState().pendingAction?.contributions,
      ).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(50);
      await pending;

      expect(published.at(-1)?.contributions.map((c) => c.dimensionId)).toEqual([
        "region",
        "status",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("B3: A genuine zoomContext change invalidates selection and clears this chart's action source", () => {
    const action: ChartAction = {
      id: "act-b3",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "auto",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "region", targetDimensionId: "region" }],
    };
    const contrib: FilterContribution = {
      key: contributionKey(
        { kind: "chartSelection", actionId: action.id, sourceChartID: chartA },
        { kind: "chart", chartID: chartB },
        "region",
      ),
      dimensionId: "region",
      source: { kind: "chartSelection", actionId: action.id, sourceChartID: chartA },
      target: { kind: "chart", chartID: chartB },
      value: ["EU"],
    };

    useFiltersStore.getState().applyActionContributions(chartA, [contrib], [action.id]);
    expect(useFiltersStore.getState().appliedContributions[contrib.key]).toBeDefined();

    // Zoom/filter change triggers clearActionSource(chartID)
    useFiltersStore.getState().clearActionSource(chartA);
    expect(useFiltersStore.getState().appliedContributions[contrib.key]).toBeUndefined();
  });

  it("B4: Unmounting clears only this chart's staged action, never another chart's", () => {
    const contribA: FilterContribution = {
      key: "chartSelection|a|chart|b|region",
      dimensionId: "region",
      source: { kind: "chartSelection", actionId: "a", sourceChartID: chartA },
      target: { kind: "chart", chartID: chartB },
      value: ["EU"],
    };
    const contribB: FilterContribution = {
      key: "chartSelection|b|chart|a|region",
      dimensionId: "region",
      source: { kind: "chartSelection", actionId: "b", sourceChartID: chartB },
      target: { kind: "chart", chartID: chartA },
      value: ["US"],
    };

    useFiltersStore.getState().stagePendingAction(chartA, [contribA]);
    // Chart B stages its action
    useFiltersStore.getState().stagePendingAction(chartB, [contribB]);
    expect(useFiltersStore.getState().pendingAction?.sourceChartID).toBe(chartB);

    // Chart A unmounts and calls clearPendingAction(chartA) - chart B's staging remains
    useFiltersStore.getState().clearPendingAction(chartA);
    expect(useFiltersStore.getState().pendingAction?.sourceChartID).toBe(chartB);

    // Chart B unmounts and calls clearPendingAction(chartB)
    useFiltersStore.getState().clearPendingAction(chartB);
    expect(useFiltersStore.getState().pendingAction).toBeNull();
  });

  it("B5: Emptying the selection clears previously auto-applied filters", () => {
    const action: ChartAction = {
      id: "act-b5",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "auto",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "region", targetDimensionId: "region" }],
    };
    const contrib: FilterContribution = {
      key: contributionKey(
        { kind: "chartSelection", actionId: action.id, sourceChartID: chartA },
        { kind: "chart", chartID: chartB },
        "region",
      ),
      dimensionId: "region",
      source: { kind: "chartSelection", actionId: action.id, sourceChartID: chartA },
      target: { kind: "chart", chartID: chartB },
      value: ["EU"],
    };

    useFiltersStore.getState().applyActionContributions(chartA, [contrib], [action.id]);
    expect(useFiltersStore.getState().appliedContributions[contrib.key]).toBeDefined();

    // When selection becomes empty:
    useFiltersStore.getState().clearActionSource(chartA, [action.id]);
    expect(useFiltersStore.getState().appliedContributions[contrib.key]).toBeUndefined();
  });

  it("B6: Auto-applied filters stay staged so the source tooltip stays open and its all-target action remains available", () => {
    const action: ChartAction = {
      id: "act-b6",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "auto",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "region", targetDimensionId: "region" }],
    };
    const contrib: FilterContribution = {
      key: contributionKey(
        { kind: "chartSelection", actionId: action.id, sourceChartID: chartA },
        { kind: "chart", chartID: chartB },
        "region",
      ),
      dimensionId: "region",
      source: { kind: "chartSelection", actionId: action.id, sourceChartID: chartA },
      target: { kind: "chart", chartID: chartB },
      value: ["EU"],
    };

    useFiltersStore.getState().stagePendingAction(chartA, [contrib]);
    useFiltersStore.getState().applyActionContributions(chartA, [contrib], [action.id]);

    // pendingAction must NOT be cleared by applyActionContributions
    expect(useFiltersStore.getState().pendingAction).not.toBeNull();
    expect(useFiltersStore.getState().pendingAction?.sourceChartID).toBe(chartA);
  });

  it("B7: Action application bypasses the Apply gate and sets hasApplied: true", () => {
    expect(useFiltersStore.getState().hasApplied).toBe(false);

    const action: ChartAction = {
      id: "act-b7",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "region", targetDimensionId: "region" }],
    };
    const contrib: FilterContribution = {
      key: "chartSelection|act-b7|chart|b|region",
      dimensionId: "region",
      source: { kind: "chartSelection", actionId: action.id, sourceChartID: chartA },
      target: { kind: "chart", chartID: chartB },
      value: ["EU"],
    };

    useFiltersStore.getState().executeAction(action, [contrib]);
    expect(useFiltersStore.getState().hasApplied).toBe(true);
  });

  it("B8: Re-applying an action replaces only its own contributions", () => {
    const act1: FilterContribution = {
      key: "chartSelection|act-1|chart|b|region",
      dimensionId: "region",
      source: { kind: "chartSelection", actionId: "act-1", sourceChartID: chartA },
      target: { kind: "chart", chartID: chartB },
      value: ["EU"],
    };
    const act2: FilterContribution = {
      key: "chartSelection|act-2|chart|b|region",
      dimensionId: "region",
      source: { kind: "chartSelection", actionId: "act-2", sourceChartID: chartA },
      target: { kind: "chart", chartID: chartB },
      value: ["APAC"],
    };

    useFiltersStore.getState().applyActionContributions(chartA, [act1, act2]);
    expect(useFiltersStore.getState().appliedContributions[act1.key]).toBeDefined();
    expect(useFiltersStore.getState().appliedContributions[act2.key]).toBeDefined();

    const act1Updated: FilterContribution = {
      ...act1,
      value: ["US"],
    };
    useFiltersStore.getState().executeAction(
      {
        id: "act-1",
        fromChartID: chartA,
        sourceResolution: "clientRow",
        trigger: "manual",
        target: { kind: "chart", chartID: chartB },
        mappings: [{ sourceField: "region", targetDimensionId: "region" }],
      },
      [act1Updated],
    );

    // act-1 is updated, act-2 remains untouched
    expect(useFiltersStore.getState().appliedContributions[act1.key].value).toEqual(["US"]);
    expect(useFiltersStore.getState().appliedContributions[act2.key].value).toEqual(["APAC"]);
  });

  it("applies an auto clientRow action before a sibling tooltipLookup resolves", async () => {
    vi.useFakeTimers();
    try {
      const actionRequestRef = { current: 0 };
      const clientAction: ChartAction = {
        id: "act-auto-client",
        fromChartID: chartA,
        sourceResolution: "clientRow",
        trigger: "auto",
        target: { kind: "chart", chartID: chartB },
        mappings: [{ sourceField: "region", targetDimensionId: "region" }],
      };
      const tooltipAction: ChartAction = {
        id: "act-slow-tooltip",
        fromChartID: chartA,
        sourceResolution: "tooltipLookup",
        trigger: "auto",
        target: { kind: "chart", chartID: chartB },
        mappings: [{ sourceField: "status", targetDimensionId: "status" }],
      };

      const pending = resolveChartActions({
        chartID: chartA,
        zoomContext: "ctx-auto",
        dimensions,
        outgoingActions: [clientAction, tooltipAction],
        rows: [{ region: "EU" }],
        fetchTooltip: () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({ dataPoint: [{ status: "open" }], failedBatches: 0 }),
              100,
            );
          }),
        actionRequestRef,
        setResolvedActionContributions: () => {},
        stagePendingAction: (cId, c) =>
          useFiltersStore.getState().stagePendingAction(cId, c),
        clearPendingAction: (cId) =>
          useFiltersStore.getState().clearPendingAction(cId),
        applyActionContributions: (cId, c, aIds) =>
          useFiltersStore.getState().applyActionContributions(cId, c, aIds),
        clearActionSource: (cId, aIds) =>
          useFiltersStore.getState().clearActionSource(cId, aIds),
      });

      // Let the synchronous step-1 client application settle.
      await Promise.resolve();

      const clientKey = contributionKey(
        {
          kind: "chartSelection",
          actionId: clientAction.id,
          sourceChartID: chartA,
        },
        { kind: "chart", chartID: chartB },
        "region",
      );
      const tooltipKey = contributionKey(
        {
          kind: "chartSelection",
          actionId: tooltipAction.id,
          sourceChartID: chartA,
        },
        { kind: "chart", chartID: chartB },
        "status",
      );

      // The auto clientRow action is applied without waiting for the 100ms roundtrip.
      expect(
        useFiltersStore.getState().appliedContributions[clientKey]?.value,
      ).toEqual(["EU"]);
      // The tooltipLookup action is still pending until its roundtrip resolves.
      expect(
        useFiltersStore.getState().appliedContributions[tooltipKey],
      ).toBeUndefined();

      await vi.advanceTimersByTimeAsync(100);
      await pending;

      expect(
        useFiltersStore.getState().appliedContributions[tooltipKey]?.value,
      ).toBe("open");
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-executing a navigating (tabJump) action removes its stale dimension contributions", () => {
    const navAction: ChartAction = {
      id: "act-nav",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "tab", tab: "Overview" },
      navigate: { restoreOnReturn: true },
      mappings: [{ sourceField: "region", targetDimensionId: "region" }],
    };

    const regionContrib: FilterContribution = {
      key: contributionKey(
        { kind: "tabJump", actionId: navAction.id, sourceChartID: chartA },
        { kind: "tab", tab: "Overview" },
        "region",
      ),
      dimensionId: "region",
      source: { kind: "tabJump", actionId: navAction.id, sourceChartID: chartA },
      target: { kind: "tab", tab: "Overview" },
      value: ["EU"],
    };

    useFiltersStore.getState().executeAction(navAction, [regionContrib]);
    expect(
      useFiltersStore.getState().appliedContributions[regionContrib.key]?.value,
    ).toEqual(["EU"]);

    // Re-execute the same navigating action, now resolving a different dimension.
    const statusContrib: FilterContribution = {
      key: contributionKey(
        { kind: "tabJump", actionId: navAction.id, sourceChartID: chartA },
        { kind: "tab", tab: "Overview" },
        "status",
      ),
      dimensionId: "status",
      source: { kind: "tabJump", actionId: navAction.id, sourceChartID: chartA },
      target: { kind: "tab", tab: "Overview" },
      value: "open",
    };
    useFiltersStore.getState().executeAction(navAction, [statusContrib]);

    // The stale region contribution from the prior tabJump must be swept.
    expect(
      useFiltersStore.getState().appliedContributions[regionContrib.key],
    ).toBeUndefined();
    expect(
      useFiltersStore.getState().appliedContributions[statusContrib.key]?.value,
    ).toBe("open");
  });
});
