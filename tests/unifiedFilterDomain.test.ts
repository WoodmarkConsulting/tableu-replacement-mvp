import { describe, expect, it } from "vitest";

import barchartTest from "../pagesConfig/barchartTest.json";
import blkPageConfig from "../pagesConfig/blkPageConfig.json";
import connectionAcceptance from "../pagesConfig/connectionAcceptance.json";
import cudoTest from "../pagesConfig/cudoTest.json";
import dacodaPageConfig from "../pagesConfig/dacodaPageConfig.json";
import drillTest from "../pagesConfig/drillTest.json";
import multiselectTest from "../pagesConfig/multiselectTest.json";
import productionNumbers from "../pagesConfig/productionNumbers.json";
import { contributionKey } from "../lib/filters/contributions";
import { resolveChartFilters } from "../lib/filters/resolveChartFilters";
import { validateDashboardConfig } from "../lib/validateDashboardConfig";

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

const makeContribution = (
  source: FilterSource,
  target: FilterTarget,
  dimensionId: string,
  value: FilterValue,
): FilterContribution => ({
  key: contributionKey(source, target, dimensionId),
  dimensionId,
  source,
  target,
  value,
});

describe("unified filter contribution domain", () => {
  it("derives stable keys without near-miss collisions", () => {
    const control: FilterSource = { kind: "control", dimensionId: "region" };
    const dashboard: FilterTarget = { kind: "dashboard" };
    const tab: FilterTarget = { kind: "tab", tab: "Overview" };

    expect(contributionKey(control, dashboard, "region")).toBe(
      "control|region|dashboard||region",
    );
    expect(contributionKey(control, tab, "region")).not.toBe(
      contributionKey(control, dashboard, "region"),
    );
  });

  it("applies dashboard, current-tab, and current-chart contributions only", () => {
    const control: FilterSource = { kind: "control", dimensionId: "region" };
    const selection: FilterSource = {
      kind: "chartSelection",
      actionId: "filter-detail",
      sourceChartID: chartB,
    };
    const contributions = [
      makeContribution(control, { kind: "dashboard" }, "region", ["EU", "US"]),
      makeContribution(control, { kind: "tab", tab: "Other" }, "region", ["APAC"]),
      makeContribution(selection, { kind: "chart", chartID: chartA }, "region", ["EU"]),
    ];

    expect(
      resolveChartFilters({
        chartID: chartA,
        tab: "Overview",
        dimensions,
        contributions,
        bindings: { region: "region_code" },
      }),
    ).toMatchObject({
      dimensionValues: { region: ["EU"] },
      params: { region_code: "EU" },
      impossible: false,
    });
  });

  it("unions same-source selections and reports an empty cross-source intersection", () => {
    const first: FilterSource = {
      kind: "chartSelection",
      actionId: "one",
      sourceChartID: chartA,
    };
    const second: FilterSource = {
      kind: "chartSelection",
      actionId: "two",
      sourceChartID: chartB,
    };
    const control: FilterSource = { kind: "control", dimensionId: "region" };
    const target: FilterTarget = { kind: "dashboard" };

    const union = resolveChartFilters({
      chartID: chartA,
      tab: "Overview",
      dimensions,
      contributions: [
        makeContribution(first, target, "region", ["EU"]),
        makeContribution(second, target, "region", ["US"]),
      ],
      bindings: { region: "region_code" },
    });
    expect(union.params.region_code).toBe("EU,US");

    const impossible = resolveChartFilters({
      chartID: chartA,
      tab: "Overview",
      dimensions,
      contributions: [
        makeContribution(first, target, "region", ["EU"]),
        makeContribution(control, target, "region", ["US"]),
      ],
      bindings: { region: "region_code" },
    });
    expect(impossible).toMatchObject({
      impossible: true,
      conflicts: ["region"],
    });
  });

  it("returns canonically ordered values and params", () => {
    const control: FilterSource = { kind: "control", dimensionId: "region" };
    const contribution = makeContribution(
      control,
      { kind: "dashboard" },
      "region",
      ["US", "EU", "US"],
    );
    const resolved = resolveChartFilters({
      chartID: chartA,
      tab: "Overview",
      dimensions,
      contributions: [contribution],
      bindings: { status: "status", region: "region_code" },
    });

    expect(Object.keys(resolved.params)).toEqual(["region_code", "status"]);
    expect(resolved.dimensionValues.region).toEqual(["EU", "US"]);
  });

  it("honours explicit composition overrides", () => {
    const first: FilterSource = {
      kind: "chartSelection",
      actionId: "one",
      sourceChartID: chartA,
    };
    const second: FilterSource = {
      kind: "chartSelection",
      actionId: "two",
      sourceChartID: chartB,
    };
    const control: FilterSource = { kind: "control", dimensionId: "region" };
    const target: FilterTarget = { kind: "dashboard" };

    const sameSourceIntersect = resolveChartFilters({
      chartID: chartA,
      tab: "Overview",
      dimensions: [
        { ...dimensions[0], composition: { sameSourceKind: "intersect" } },
      ],
      contributions: [
        makeContribution(first, target, "region", ["EU", "US"]),
        makeContribution(second, target, "region", ["US", "APAC"]),
      ],
      bindings: { region: "region_code" },
    });
    expect(sameSourceIntersect.params.region_code).toBe("US");

    const crossSourceUnion = resolveChartFilters({
      chartID: chartA,
      tab: "Overview",
      dimensions: [
        { ...dimensions[0], composition: { crossSourceKind: "union" } },
      ],
      contributions: [
        makeContribution(first, target, "region", ["EU"]),
        makeContribution(control, target, "region", ["US"]),
      ],
      bindings: { region: "region_code" },
    });
    expect(crossSourceUnion.params.region_code).toBe("EU,US");
    expect(crossSourceUnion.impossible).toBe(false);
  });

  it("reports a conflict when a single-value dimension resolves to many values", () => {
    const control: FilterSource = { kind: "control", dimensionId: "status" };
    const selection: FilterSource = {
      kind: "chartSelection",
      actionId: "pick-status",
      sourceChartID: chartB,
    };
    const target: FilterTarget = { kind: "dashboard" };
    const contributions = [
      makeContribution(control, target, "status", "open"),
      makeContribution(selection, target, "status", "closed"),
    ];

    const resolved = resolveChartFilters({
      chartID: chartA,
      tab: "Overview",
      dimensions: [
        { ...dimensions[1], composition: { crossSourceKind: "union" } },
      ],
      contributions,
      bindings: { status: "status" },
    });

    expect(resolved.impossible).toBe(true);
    expect(resolved.conflicts).toEqual(["status"]);
    expect(resolved.conflictKeys).toEqual(
      contributions.map((contribution) => contribution.key).sort(),
    );
  });

  it("ignores empty values instead of treating them as conflicts", () => {
    const control: FilterSource = { kind: "control", dimensionId: "region" };
    const statusControl: FilterSource = {
      kind: "control",
      dimensionId: "status",
    };
    const target: FilterTarget = { kind: "dashboard" };

    const resolved = resolveChartFilters({
      chartID: chartA,
      tab: "Overview",
      dimensions,
      contributions: [
        makeContribution(control, target, "region", []),
        makeContribution(statusControl, target, "status", ""),
      ],
      bindings: { region: "region_code", status: "status" },
    });

    expect(resolved).toMatchObject({
      impossible: false,
      params: { region_code: null, status: null },
    });
    expect(resolved.dimensionValues).toEqual({});
  });

  it("accepts agreeing non-enumerable producers and rejects disagreeing ones", () => {
    const code: FilterDimension = {
      id: "code",
      label: "Code",
      type: "string",
      control: { location: "dashboard" },
    };
    const control: FilterSource = { kind: "control", dimensionId: "code" };
    const selection: FilterSource = {
      kind: "chartSelection",
      actionId: "pick-code",
      sourceChartID: chartB,
    };
    const target: FilterTarget = { kind: "dashboard" };

    expect(
      resolveChartFilters({
        chartID: chartA,
        tab: "Overview",
        dimensions: [code],
        contributions: [
          makeContribution(control, target, "code", "A"),
          makeContribution(selection, target, "code", "A"),
        ],
        bindings: { code: "code" },
      }),
    ).toMatchObject({ impossible: false, params: { code: "A" } });

    expect(
      resolveChartFilters({
        chartID: chartA,
        tab: "Overview",
        dimensions: [code],
        contributions: [
          makeContribution(control, target, "code", "A"),
          makeContribution(selection, target, "code", "B"),
        ],
        bindings: { code: "code" },
      }),
    ).toMatchObject({ impossible: true, conflicts: ["code"] });
  });

  it("marks a bound dateRange dimension as unresolvable rather than unfiltered", () => {
    const period: FilterDimension = {
      id: "period",
      label: "Period",
      type: "dateRange",
      control: { location: "dashboard" },
    };
    const control: FilterSource = { kind: "control", dimensionId: "period" };

    const resolved = resolveChartFilters({
      chartID: chartA,
      tab: "Overview",
      dimensions: [period],
      contributions: [
        makeContribution(control, { kind: "dashboard" }, "period", {
          from: "2026-01-01",
          to: "2026-08-31",
        }),
      ],
      bindings: { period: "period" },
    });

    expect(resolved).toMatchObject({ impossible: true, conflicts: ["period"] });
    expect(resolved.params.period).toBeUndefined();
  });
});

describe("dashboard config validation", () => {
  const validConfig = (): DashboardConfig =>
    ({
      reportName: "Validation",
      filters: dimensions.map((dimension) => ({ ...dimension })),
      tabs: [
        {
          trigger: "Overview",
          rows: [
            {
              components: [
                {
                  moduleName: "TableModule",
                  space: 12,
                  chartID: chartA,
                  chartConfig: {},
                  filterBindings: { region: "region_code", status: "status" },
                },
              ],
            },
          ],
        },
      ],
    }) as unknown as DashboardConfig;

  it("accepts valid cross-references", () => {
    expect(() => validateDashboardConfig(validConfig())).not.toThrow();
  });

  it("rejects a config that is not a dashboard object", () => {
    expect(() =>
      validateDashboardConfig([] as unknown as DashboardConfig),
    ).toThrow("`filters` and `tabs` arrays");
  });

  it("rejects dangling bindings and single-field dateRange bindings", () => {
    const dangling = validConfig();
    dangling.tabs[0].rows[0].components[0].filterBindings = {
      missing: "missing",
    };
    expect(() => validateDashboardConfig(dangling)).toThrow(
      'binds unknown filter dimension "missing"',
    );

    const dateRange = validConfig();
    dateRange.filters.push({
      id: "period",
      label: "Period",
      type: "dateRange",
      control: { location: "dashboard" },
    });
    dateRange.tabs[0].rows[0].components[0].filterBindings = {
      period: "period",
    };
    expect(() => validateDashboardConfig(dateRange)).toThrow(
      'cannot bind dateRange dimension "period"',
    );
  });

  it("rejects two dimensions bound to the same SQL field", () => {
    const config = validConfig();
    config.tabs[0].rows[0].components[0].filterBindings = {
      region: "value",
      status: "value",
    };

    expect(() => validateDashboardConfig(config)).toThrow(
      'binds multiple dimensions to SQL field "value"',
    );
  });

  it("rejects drilldowns onto date dimensions", () => {
    for (const type of ["dateString", "dateRange"] as const) {
      const config = validConfig();
      config.filters.push({
        id: "day",
        label: "Day",
        type,
        control: { location: "dashboard" },
      });
      config.tabs[0].rows[0].components[0].filterBindings = { region: "region_code" };
      config.actions = [
        {
          id: "drill-day",
          fromChartID: chartA,
          sourceResolution: "clientRow",
          trigger: "manual",
          target: { kind: "tab", tab: "Overview" },
          mappings: [{ sourceField: "day", targetDimensionId: "day" }],
        },
      ];

      expect(() => validateDashboardConfig(config)).toThrow(
        `cannot target ${type} dimension "day"`,
      );
    }
  });

  it("rejects legacy connections, tabJumps, and chart keys", () => {
    const legacyChart = validConfig();
    Object.assign(legacyChart.tabs[0].rows[0].components[0], {
      autoApplyConnections: true,
    });
    expect(() => validateDashboardConfig(legacyChart)).toThrow(
      "legacy autoApplyConnections",
    );

    const legacyConnection = validConfig();
    (legacyConnection as Record<string, unknown>).connections = [
      {
        id: "legacy",
        fromChartID: chartA,
        toChartID: chartA,
        mappings: [],
      },
    ];
    expect(() => validateDashboardConfig(legacyConnection)).toThrow(
      'legacy "connections" is no longer supported',
    );

    const legacyJump = validConfig();
    (legacyJump as Record<string, unknown>).tabJumps = [
      {
        id: "legacy-jump",
        fromChartID: chartA,
        targetTab: "Overview",
        mappings: [],
      },
    ];
    expect(() => validateDashboardConfig(legacyJump)).toThrow(
      'legacy "tabJumps" is no longer supported',
    );
  });

  it("rejects cyclic action graphs", () => {
    const config = validConfig();
    config.tabs[0].rows[0].components.push({
      ...config.tabs[0].rows[0].components[0],
      chartID: chartB,
    });
    config.actions = [
      {
        id: "a-to-b",
        fromChartID: chartA,
        sourceResolution: "tooltipLookup",
        trigger: "manual",
        target: { kind: "chart", chartID: chartB },
        mappings: [{ sourceField: "region_code", targetDimensionId: "region" }],
      },
      {
        id: "b-to-a",
        fromChartID: chartB,
        sourceResolution: "tooltipLookup",
        trigger: "manual",
        target: { kind: "chart", chartID: chartA },
        mappings: [{ sourceField: "region_code", targetDimensionId: "region" }],
      },
    ];

    expect(() => validateDashboardConfig(config)).toThrow(
      "Chart action graph must be acyclic.",
    );
  });

  it("rejects key-delimiter characters in ids, control tabs, and jump targets", () => {
    const badDimension = validConfig();
    badDimension.filters = [{ ...dimensions[0], id: "reg|ion" }];
    expect(() => validateDashboardConfig(badDimension)).toThrow(
      'Filter dimension id "reg|ion" must not contain "|"',
    );

    const badAction = validConfig();
    badAction.actions = [
      {
        id: "drill|one",
        fromChartID: chartA,
        sourceResolution: "clientRow",
        trigger: "manual",
        target: { kind: "tab", tab: "Overview" },
        mappings: [{ sourceField: "region_code", targetDimensionId: "region" }],
      },
    ];
    expect(() => validateDashboardConfig(badAction)).toThrow(
      'Filter action id "drill|one" must not contain "|"',
    );
  });

  it("rejects actions targeting a tab where no chart binds the dimension", () => {
    const config = validConfig();
    config.tabs[0].rows[0].components[0].filterBindings = { status: "status" };
    config.actions = [
      {
        id: "drill-region",
        fromChartID: chartA,
        sourceResolution: "clientRow",
        trigger: "manual",
        target: { kind: "tab", tab: "Overview" },
        mappings: [{ sourceField: "region_code", targetDimensionId: "region" }],
      },
    ];

    expect(() => validateDashboardConfig(config)).toThrow(
      'is not bound by a chart on tab "Overview"',
    );
  });

  it("rejects a defaultValue on a dimension without a control", () => {
    const config = validConfig();
    config.filters = [
      { id: "hidden", label: "Hidden", type: "string", defaultValue: "x" },
    ];
    config.tabs[0].rows[0].components[0].filterBindings = { hidden: "hidden" };

    expect(() => validateDashboardConfig(config)).toThrow(
      'has a defaultValue but no control',
    );
  });

  it("rejects duplicate action IDs", () => {
    const config = validConfig();
    config.actions = [
      {
        id: "shared-id",
        fromChartID: chartA,
        sourceResolution: "clientRow",
        trigger: "manual",
        target: { kind: "tab", tab: "Overview" },
        mappings: [{ sourceField: "status", targetDimensionId: "status" }],
      },
      {
        id: "shared-id",
        fromChartID: chartA,
        sourceResolution: "tooltipLookup",
        trigger: "manual",
        target: { kind: "chart", chartID: chartA },
        mappings: [{ sourceField: "region_code", targetDimensionId: "region" }],
      },
    ];

    expect(() => validateDashboardConfig(config)).toThrow(
      'Filter action id "shared-id" must be non-empty and unique.',
    );
  });

  it("rejects trigger: auto with navigate and navigate on chart targets", () => {
    const autoNav = validConfig();
    autoNav.actions = [
      {
        id: "auto-nav",
        fromChartID: chartA,
        sourceResolution: "clientRow",
        trigger: "auto",
        target: { kind: "tab", tab: "Overview" },
        navigate: { restoreOnReturn: true },
        mappings: [{ sourceField: "region_code", targetDimensionId: "region" }],
      },
    ];
    expect(() => validateDashboardConfig(autoNav)).toThrow(
      'Action "auto-nav" with navigate must use trigger "manual".',
    );

    const chartNav = validConfig();
    chartNav.actions = [
      {
        id: "chart-nav",
        fromChartID: chartA,
        sourceResolution: "tooltipLookup",
        trigger: "manual",
        target: { kind: "chart", chartID: chartA },
        navigate: { restoreOnReturn: true },
        mappings: [{ sourceField: "region_code", targetDimensionId: "region" }],
      },
    ];
    expect(() => validateDashboardConfig(chartNav)).toThrow(
      'Action "chart-nav" has navigate but target kind is not "tab".',
    );
  });

  it("rejects trigger: auto targeting non-multiselect dimension, but accepts trigger: manual", () => {
    const autoSingle = validConfig();
    autoSingle.tabs[0].rows[0].components.push({
      ...autoSingle.tabs[0].rows[0].components[0],
      chartID: chartB,
    });
    autoSingle.actions = [
      {
        id: "auto-single",
        fromChartID: chartA,
        sourceResolution: "clientRow",
        trigger: "auto",
        target: { kind: "chart", chartID: chartB },
        mappings: [{ sourceField: "status", targetDimensionId: "status" }], // status is select
      },
    ];
    expect(() => validateDashboardConfig(autoSingle)).toThrow(
      'Action "auto-single" with trigger "auto" must target a multiselect dimension, received "status".',
    );

    const manualSingle = validConfig();
    manualSingle.tabs[0].rows[0].components.push({
      ...manualSingle.tabs[0].rows[0].components[0],
      chartID: chartB,
    });
    manualSingle.actions = [
      {
        id: "manual-single",
        fromChartID: chartA,
        sourceResolution: "clientRow",
        trigger: "manual",
        target: { kind: "chart", chartID: chartB },
        mappings: [{ sourceField: "status", targetDimensionId: "status" }], // status is select
      },
    ];
    expect(() => validateDashboardConfig(manualSingle)).not.toThrow();
  });

  it("detects cycles in chart targets and non-navigating tab targets, but ignores navigating actions", () => {
    const config = validConfig();
    config.tabs[0].rows[0].components.push({
      ...config.tabs[0].rows[0].components[0],
      chartID: chartB,
    });
    // Cycle with non-navigating tab target: chartA -> chartB via tab target on Overview binding status; chartB -> chartA
    config.actions = [
      {
        id: "a-to-tab",
        fromChartID: chartA,
        sourceResolution: "clientRow",
        trigger: "manual",
        target: { kind: "tab", tab: "Overview" },
        mappings: [{ sourceField: "status", targetDimensionId: "status" }],
      },
      {
        id: "b-to-a",
        fromChartID: chartB,
        sourceResolution: "tooltipLookup",
        trigger: "manual",
        target: { kind: "chart", chartID: chartA },
        mappings: [{ sourceField: "region_code", targetDimensionId: "region" }],
      },
    ];
    expect(() => validateDashboardConfig(config)).toThrow(
      "Chart action graph must be acyclic.",
    );

    // If a-to-tab has navigate, it is excluded from cycle graph -> valid
    config.actions[0].navigate = { restoreOnReturn: true };
    expect(() => validateDashboardConfig(config)).not.toThrow();
  });

  it("rejects invalid sourceResolution", () => {
    const badResolution = validConfig();
    badResolution.actions = [
      {
        id: "bad-res",
        fromChartID: chartA,
        sourceResolution: "invalid" as unknown as ActionSourceResolution,
        trigger: "manual",
        target: { kind: "tab", tab: "Overview" },
        mappings: [{ sourceField: "status", targetDimensionId: "status" }],
      },
    ];
    expect(() => validateDashboardConfig(badResolution)).toThrow(
      'Action "bad-res" must specify sourceResolution ("clientRow" | "tooltipLookup").',
    );
  });

  it.each([
    ["barchartTest", barchartTest],
    ["connectionAcceptance", connectionAcceptance],
    ["cudoTest", cudoTest],
    ["drillTest", drillTest],
    ["multiselectTest", multiselectTest],
    ["productionNumbers", productionNumbers],
  ])("validates existing dashboard config: %s", (_name, config) => {
    expect(() => validateDashboardConfig(config as unknown as DashboardConfig)).not.toThrow();
  });

  it.each([
    ["blkPageConfig", blkPageConfig],
    ["dacodaPageConfig", dacodaPageConfig],
  ])("rejects legacy pre-v2 array-shaped config: %s", (_name, config) => {
    expect(() => validateDashboardConfig(config as unknown as DashboardConfig)).toThrow(
      "Dashboard config must be an object with `filters` and `tabs` arrays.",
    );
  });
});