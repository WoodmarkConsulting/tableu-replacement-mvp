import { describe, it, expect } from "vitest";
import { buildPageBoilerplate } from "../scripts/pages/generateNextPage";

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
