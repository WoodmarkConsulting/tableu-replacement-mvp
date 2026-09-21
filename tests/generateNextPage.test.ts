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
          control: { location: "dashboard" },
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
            control: { location: "dashboard" },
          },
          {
            id: "country",
            label: "Country",
            type: "string",
            control: { location: "tab", tab: "Details" },
          },
        ]),
    ).not.toThrow();
  });

  it.each([
    [
      "global dimensions",
      {
        id: "region",
        label: "Region",
        type: "string",
        control: { location: "dashboard" },
      },
      {
        id: "region",
        label: "Other Region",
        type: "string",
        control: { location: "dashboard" },
      },
    ],
    [
      "dimensions on different tabs",
      {
        id: "region",
        label: "Region A",
        type: "string",
        control: { location: "tab", tab: "Tab A" },
      },
      {
        id: "region",
        label: "Region B",
        type: "string",
        control: { location: "tab", tab: "Tab B" },
      },
    ],
    [
      "global and tab dimensions",
      {
        id: "region",
        label: "Region",
        type: "string",
        control: { location: "dashboard" },
      },
      {
        id: "region",
        label: "Tab Region",
        type: "string",
        control: { location: "tab", tab: "Details" },
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
    const sourceChartID =
      "69e28f7b-a25a-4911-ae2c-64b3ab5ca155" as TableSchemaKey;
    const targetChartID =
      "8ea746c9-7d14-4e4a-b5fc-49c805430320" as TableSchemaKey;
    const mockDashboardConfig = {
      reportName: "Battery Health",
      filters: [
        {
          id: "selected_vin",
          label: "Selected VIN",
          type: "multiselect",
        },
      ],
      tabs: [
        {
          trigger: "Overview",
          rows: [
            {
              components: [
                {
                  moduleName: "TableModule",
                  space: 12,
                  chartID: sourceChartID,
                  chartConfig: {},
                },
              ],
            },
          ],
        },
        {
          trigger: "Details",
          rows: [
            {
              components: [
                {
                  moduleName: "TableModule",
                  space: 12,
                  chartID: targetChartID,
                  chartConfig: {},
                  filterBindings: { selected_vin: "vin" },
                },
              ],
            },
          ],
        },
      ],
      connections: [
        {
          id: "vehicle-selection",
          fromChartID: sourceChartID,
          toChartID: targetChartID,
          mappings: [
            { sourceField: "vehicle_id", targetDimensionId: "selected_vin" },
          ],
        },
      ],
      tabJumps: [
        {
          id: "vehicle-details",
          fromChartID: sourceChartID,
          targetTab: "Details",
          mappings: [
            {
              sourceField: "vin",
              targetDimensionId: "selected_vin",
            },
          ],
        },
      ],
    } as unknown as DashboardConfig;

    const code = buildPageBoilerplate("batteryOverview", mockDashboardConfig);

    expect(code.includes("connections: [")).toBe(true);
    expect(code.includes('"vehicle-selection"')).toBe(true);
    expect(code.includes('"vin"')).toBe(true);
    expect(code.includes("tabJumps: [")).toBe(true);
    expect(code.includes('"targetDimensionId": "selected_vin"')).toBe(true);
  });
});
