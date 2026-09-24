import { describe, expect, it } from "vitest";

import {
  ACTION_VALUE_LIMIT,
  canExecuteAction,
  resolveActionContributions,
} from "../lib/filters/actions";
import { contributionKey } from "../lib/filters/contributions";

const chartA = "69e28f7b-a25a-4911-ae2c-64b3ab5ca155" as TableSchemaKey;
const chartB = "8ea746c9-7d14-4e4a-b5fc-49c805430320" as TableSchemaKey;

const dimensions: FilterDimension[] = [
  {
    id: "region",
    label: "Region",
    type: "multiselect",
  },
  {
    id: "status",
    label: "Status",
    type: "select",
  },
  {
    id: "count",
    label: "Count",
    type: "number",
  },
  {
    id: "date",
    label: "Date",
    type: "dateString",
  },
];

describe("actions resolver", () => {
  it("resolves clientRow from top-level keys and values.<column> nesting", () => {
    const flatAction: ChartAction = {
      id: "act-flat",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "region_code", targetDimensionId: "region" }],
    };

    const flatRows = [
      { region_code: "EU", extra: 1 },
      { region_code: "US", extra: 2 },
    ];

    const flatContribs = resolveActionContributions(dimensions, flatAction, flatRows);
    expect(flatContribs).not.toBeNull();
    expect(flatContribs![0].value).toEqual(["EU", "US"]);
    expect(flatContribs![0].source.kind).toBe("chartSelection");
    expect(flatContribs![0].target).toEqual({ kind: "chart", chartID: chartB });

    // Nested values.<col>
    const nestedAction: ChartAction = {
      id: "act-nested",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "tab", tab: "Overview" },
      navigate: { restoreOnReturn: true },
      mappings: [{ sourceField: "values.region_code", targetDimensionId: "region" }],
    };

    const nestedRows = [
      { values: { region_code: "APAC" } },
      { values: { region_code: "EU" } },
    ];

    const nestedContribs = resolveActionContributions(dimensions, nestedAction, nestedRows);
    expect(nestedContribs).not.toBeNull();
    expect(nestedContribs![0].value).toEqual(["APAC", "EU"]);
    expect(nestedContribs![0].source.kind).toBe("tabJump");
    expect(nestedContribs![0].target).toEqual({ kind: "tab", tab: "Overview" });
  });

  it("resolves tooltipLookup from arrays and scalars", () => {
    const tooltipAction: ChartAction = {
      id: "act-tt",
      fromChartID: chartA,
      sourceResolution: "tooltipLookup",
      trigger: "auto",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "regions", targetDimensionId: "region" }],
    };

    const rows = [
      { regions: ["US", "EU"] },
      { regions: "APAC" },
    ];

    const contribs = resolveActionContributions(dimensions, tooltipAction, rows);
    expect(contribs).not.toBeNull();
    expect(contribs![0].value).toEqual(["APAC", "EU", "US"]);
  });

  it("guarantees deterministic sorted values regardless of row input order", () => {
    const action: ChartAction = {
      id: "act-sort",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "region_code", targetDimensionId: "region" }],
    };

    const order1 = [{ region_code: "US" }, { region_code: "APAC" }, { region_code: "EU" }];
    const order2 = [{ region_code: "EU" }, { region_code: "US" }, { region_code: "APAC" }];

    const res1 = resolveActionContributions(dimensions, action, order1);
    const res2 = resolveActionContributions(dimensions, action, order2);

    expect(res1).toEqual(res2);
    expect(res1![0].value).toEqual(["APAC", "EU", "US"]);
  });

  it("rejects non-primitive fields with nonPrimitiveField", () => {
    const action: ChartAction = {
      id: "act-obj",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "complex", targetDimensionId: "region" }],
    };

    const rows = [{ complex: { nested: true } }];
    expect(canExecuteAction(dimensions, action, rows)).toEqual({
      ok: false,
      reason: "nonPrimitiveField",
    });
    expect(resolveActionContributions(dimensions, action, rows)).toBeNull();
  });

  it("rejects multiple values targeting a single-select dimension", () => {
    const action: ChartAction = {
      id: "act-single",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "status", targetDimensionId: "status" }],
    };

    const multiRows = [{ status: "open" }, { status: "closed" }];
    expect(canExecuteAction(dimensions, action, multiRows)).toEqual({
      ok: false,
      reason: "multipleValuesForSingleSelect",
    });
    expect(resolveActionContributions(dimensions, action, multiRows)).toBeNull();

    const singleRow = [{ status: "open" }, { status: "open" }];
    expect(canExecuteAction(dimensions, action, singleRow)).toEqual({ ok: true });
    const contribs = resolveActionContributions(dimensions, action, singleRow);
    expect(contribs).not.toBeNull();
    expect(contribs![0].value).toBe("open");
  });

  it("handles numeric dimensions properly", () => {
    const action: ChartAction = {
      id: "act-num",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "count", targetDimensionId: "count" }],
    };

    const validRows = [{ count: 42 }];
    expect(canExecuteAction(dimensions, action, validRows)).toEqual({ ok: true });
    expect(resolveActionContributions(dimensions, action, validRows)![0].value).toBe(42);

    const invalidRows = [{ count: "not-a-number" }];
    expect(canExecuteAction(dimensions, action, invalidRows)).toEqual({
      ok: false,
      reason: "nonPrimitiveField",
    });
    expect(resolveActionContributions(dimensions, action, invalidRows)).toBeNull();
  });

  it("enforces default and custom maxDistinctValues caps", () => {
    const defaultCapAction: ChartAction = {
      id: "act-cap",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "val", targetDimensionId: "region" }],
    };

    const manyRows = Array.from({ length: ACTION_VALUE_LIMIT + 1 }, (_, i) => ({
      val: `val-${i}`,
    }));

    expect(canExecuteAction(dimensions, defaultCapAction, manyRows)).toEqual({
      ok: false,
      reason: "valueLimitExceeded",
    });
    expect(resolveActionContributions(dimensions, defaultCapAction, manyRows)).toBeNull();

    // Custom limit
    const customCapAction: ChartAction = {
      ...defaultCapAction,
      maxDistinctValues: 10,
    };
    const elevenRows = Array.from({ length: 11 }, (_, i) => ({ val: `val-${i}` }));
    expect(canExecuteAction(dimensions, customCapAction, elevenRows)).toEqual({
      ok: false,
      reason: "valueLimitExceeded",
    });
    expect(resolveActionContributions(dimensions, customCapAction, elevenRows)).toBeNull();
  });

  it("returns noSelection on empty rows", () => {
    const action: ChartAction = {
      id: "act-empty",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "region_code", targetDimensionId: "region" }],
    };

    expect(canExecuteAction(dimensions, action, [])).toEqual({
      ok: false,
      reason: "noSelection",
    });
    expect(resolveActionContributions(dimensions, action, [])).toBeNull();
  });

  it("returns undrillableDimension when targeting dateString or dateRange", () => {
    const action: ChartAction = {
      id: "act-date",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "date_val", targetDimensionId: "date" }],
    };

    const rows = [{ date_val: "2026-01-01" }];
    expect(canExecuteAction(dimensions, action, rows)).toEqual({
      ok: false,
      reason: "undrillableDimension",
    });
    expect(resolveActionContributions(dimensions, action, rows)).toBeNull();
  });

  it("returns unknownDimension when target dimension does not exist", () => {
    const action: ChartAction = {
      id: "act-unknown",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "region_code", targetDimensionId: "nonexistent" }],
    };

    const rows = [{ region_code: "EU" }];
    expect(canExecuteAction(dimensions, action, rows)).toEqual({
      ok: false,
      reason: "unknownDimension",
    });
    expect(resolveActionContributions(dimensions, action, rows)).toBeNull();
  });

  it("strictly maintains canExecuteAction.ok === false <=> resolveActionContributions === null", () => {
    const action: ChartAction = {
      id: "act-eq",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "chart", chartID: chartB },
      mappings: [{ sourceField: "status", targetDimensionId: "status" }],
    };

    const testCases: Record<string, unknown>[][] = [
      [], // noSelection
      [{ status: "open" }], // ok
      [{ status: "open" }, { status: "closed" }], // multipleValuesForSingleSelect
      [{ status: { invalid: 1 } }], // nonPrimitiveField
    ];

    for (const testRows of testCases) {
      const gate = canExecuteAction(dimensions, action, testRows);
      const res = resolveActionContributions(dimensions, action, testRows);
      if (gate.ok) {
        expect(res).not.toBeNull();
      } else {
        expect(res).toBeNull();
      }
    }
  });

  it("resolves a dashboard-wide target contribution", () => {
    const action: ChartAction = {
      id: "act-dashboard",
      fromChartID: chartA,
      sourceResolution: "clientRow",
      trigger: "manual",
      target: { kind: "dashboard" },
      mappings: [{ sourceField: "region_code", targetDimensionId: "region" }],
    };

    const rows = [{ region_code: "EU" }, { region_code: "US" }];
    const contribs = resolveActionContributions(dimensions, action, rows);

    expect(contribs).not.toBeNull();
    expect(contribs![0].value).toEqual(["EU", "US"]);
    expect(contribs![0].source.kind).toBe("chartSelection");
    expect(contribs![0].target).toEqual({ kind: "dashboard" });
    expect(contribs![0].key).toBe(
      contributionKey(contribs![0].source, contribs![0].target, "region"),
    );
  });
});
