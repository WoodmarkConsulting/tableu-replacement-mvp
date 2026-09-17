import { describe, it, expect } from "vitest";
import { validateFilterDimensions } from "../lib/filterDimensions";
import { buildPageBoilerplate } from "../scripts/pages/generateNextPage";

describe("dashboard filter dimension validation", () => {
  it("rejects an empty dimension id", () => {
    expect(() =>
      validateFilterDimensions([
        {
          id: " ",
          label: "Region",
          type: "string",
          scope: "global",
        },
      ]),
    ).toThrow("Filter dimension id must be a non-empty string.");
  });

  it("accepts dashboard-wide unique dimension ids", () => {
    expect(() =>
      validateFilterDimensions([
          {
            id: "region",
            label: "Region",
            type: "string",
            scope: "global",
          },
          {
            id: "country",
            label: "Country",
            type: "string",
            scope: "tab",
            tab: "Details",
          },
        ]),
    ).not.toThrow();
  });

  it.each([
    [
      "global dimensions",
      { id: "region", label: "Region", type: "string", scope: "global" },
      {
        id: "region",
        label: "Other Region",
        type: "string",
        scope: "global",
      },
    ],
    [
      "dimensions on different tabs",
      {
        id: "region",
        label: "Region A",
        type: "string",
        scope: "tab",
        tab: "Tab A",
      },
      {
        id: "region",
        label: "Region B",
        type: "string",
        scope: "tab",
        tab: "Tab B",
      },
    ],
    [
      "global and tab dimensions",
      { id: "region", label: "Region", type: "string", scope: "global" },
      {
        id: "region",
        label: "Tab Region",
        type: "string",
        scope: "tab",
        tab: "Details",
      },
    ],
  ])("rejects duplicate ids across %s", (_case, first, second) => {
    expect(() =>
      validateFilterDimensions([first, second] as FilterDimension[]),
    ).toThrow(
      'Filter dimension id "region" must be unique within a dashboard.',
    );
  });
});

describe("generateNextPage boilerplate", () => {
  it("includes connections and tabJumps in generated page boilerplate", () => {
    const mockDashboardConfig: DashboardConfig = {
      reportName: "Battery Health",
      filterLayout: "sidebar",
      filters: [],
      tabs: [
        {
          trigger: "Overview",
          rows: [],
        },
      ],
      connections: [
        {
          fromChartID: "123456as",
          toChartID: "123456as",
          expectedColumns: ["vehicle_id"],
        },
      ],
      tabJumps: [
        {
          fromChartID: "123456as",
          targetTab: "Details",
          mappings: [
            {
              sourceField: "vin",
              targetDimensionId: "selected_vin",
            },
          ],
        },
      ],
    };

    const code = buildPageBoilerplate("batteryOverview", mockDashboardConfig);

    expect(code.includes("connections: [")).toBe(true);
    expect(code.includes('"expectedColumns"')).toBe(true);
    expect(code.includes('"vin"')).toBe(true);
    expect(code.includes("tabJumps: [")).toBe(true);
    expect(code.includes('"targetDimensionId": "selected_vin"')).toBe(true);
  });
});
