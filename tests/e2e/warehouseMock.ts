import type { Page } from "@playwright/test";

// Stubs the warehouse-backed API routes so the dashboard's filter/connection
// behaviour can be asserted without a Databricks connection, and records every
// request payload the client sends.

export const CHART = {
  bar: "3342fe24-5ed3-4560-b6e8-b6cdfcc776e1",
  tableOverview: "b6875c8c-e334-4ffe-9fd0-847f038a5e65",
  tableDetail: "c15177ce-4ac1-415a-8504-50c4ab244950",
} as const;

export const ECUS = ["ECU-Alpha", "ECU-Beta", "ECU-Gamma"] as const;
export const COUNTRIES = ["Deutschland", "Frankreich"] as const;

type ChartFilters = Record<string, string | number | boolean | null>;

export type ChartCall = { chartID: string; filters: ChartFilters };
export type TooltipCall = {
  chartID: string;
  dataPoints: Record<string, unknown>[];
};

export type WarehouseMock = {
  chartCalls: ChartCall[];
  tooltipCalls: TooltipCall[];
  callsFor: (chartID: string) => ChartCall[];
  lastFilters: (chartID: string) => ChartFilters | undefined;
  reset: () => void;
};

const optionRows = (values: readonly string[]) =>
  values.map((value) => ({ value, label: value }));

const selectedEcus = (filters: ChartFilters): string[] => {
  const raw = filters.ecu_nm;

  return typeof raw === "string" && raw.length > 0
    ? raw.split(",")
    : [...ECUS];
};

const barRows = (filters: ChartFilters) => {
  // A country filter changes the numbers so the effect is visible in a headed run.
  const factor = filters.sales_country ? 0.5 : 1;

  return ECUS.map((category, index) => ({
    category,
    values: [Math.round((3000 - index * 700) * factor)],
  }));
};

const tableRows = (filters: ChartFilters) =>
  selectedEcus(filters).map((ecu, index) => ({
    id: `${ecu}-${index}`,
    parentId: null,
    values: {
      ecu_nm: ecu,
      ms_cd: `G0${index + 1}`,
      ms_nm: `Modellreihe ${index + 1}`,
      sales_area_nm:
        typeof filters.sales_country === "string" && filters.sales_country
          ? filters.sales_country.split(",")[0]
          : COUNTRIES[0],
      plant_letter_cd: "W",
      veh_total: 1500 - index * 250,
    },
  }));

const tooltipStream = (dataPoints: Record<string, unknown>[]): string => {
  const rows = dataPoints.map((point, index) => ({
    ECU: point.category,
    Fahrzeugreihe: `G0${index + 1}, G0${index + 2}`,
    Produktionsanzahl: 1500 - index * 250,
  }));

  return [
    JSON.stringify({ type: "batch", batchIndex: 0, dataPoint: rows }),
    JSON.stringify({
      type: "done",
      completedBatches: 1,
      failedBatches: 0,
      totalBatches: 1,
    }),
    "",
  ].join("\n");
};

export async function mockWarehouse(page: Page): Promise<WarehouseMock> {
  const chartCalls: ChartCall[] = [];
  const tooltipCalls: TooltipCall[] = [];

  await page.route("**/api/filters/options/**", async (route) => {
    const source = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        source === "connectionSalesCountry"
          ? optionRows(COUNTRIES)
          : optionRows(ECUS),
      ),
    });
  });

  await page.route("**/api/data/chart/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith("/api/data/chart/tooltip")) {
      const body = JSON.parse(request.postData() ?? "{}") as TooltipCall;
      tooltipCalls.push(body);

      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body: tooltipStream(body.dataPoints ?? []),
      });

      return;
    }

    const chartID = url.pathname.split("/").pop() ?? "";
    const { filters = {} } = JSON.parse(request.postData() ?? "{}") as {
      filters?: ChartFilters;
    };
    chartCalls.push({ chartID, filters });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        chartID === CHART.bar ? barRows(filters) : tableRows(filters),
      ),
    });
  });

  return {
    chartCalls,
    tooltipCalls,
    callsFor: (chartID) =>
      chartCalls.filter((call) => call.chartID === chartID),
    lastFilters: (chartID) =>
      chartCalls.filter((call) => call.chartID === chartID).at(-1)?.filters,
    reset: () => {
      chartCalls.length = 0;
      tooltipCalls.length = 0;
    },
  };
}
