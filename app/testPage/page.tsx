"use client";
import ChartPageWrapper from "@/components/ChartPageWrapper";
import { useShallow } from "zustand/shallow";

import { useLayoutEffect } from "react";
import useFiltersStore from "@/stores/filterProvider";
import { DashboardShell } from "@/components/DashboardShell";
import { FilterValue } from "@/types/filters";

const TestPage = () => {
  const { initFilterStore } = useFiltersStore(
    useShallow((s) => ({ initFilterStore: s.initFilterStore })),
  );

  const tabsConfig = [
    {
      trigger: "Overview",
      rows: [
        {
          height: 40,
          components: [
            {
              moduleName: "LineChartModule",
              space: 12,
              chartID: "dummy-line-chart",
              chartTitle: "Fleet activity",
              chartDescription: "Dummy sample data for the test page.",
              mockData: [
                { x: 1714521600000, y: [12, 8] },
                { x: 1714608000000, y: [15, 10] },
                { x: 1714694400000, y: [18, 13] },
                { x: 1714780800000, y: [20, 16] },
                { x: 1714867200000, y: [17, 15] },
                { x: 1714953600000, y: [24, 21] },
                { x: 1715040000000, y: [28, 22] },
              ],
              chartConfig: {
                xAxis: {
                  show: true,
                  tickLine: false,
                  axisLine: false,
                  tickMargin: 8,
                  format: "date-day-month",
                },
                yAxis: {
                  show: true,
                  tickLine: false,
                  axisLine: false,
                  format: "number",
                },
                grid: {
                  show: true,
                  horizontal: true,
                  vertical: false,
                  strokeDasharray: "3 3",
                },
                tooltip: {
                  show: true,
                  cursor: true,
                },
                legend: {
                  show: true,
                },
                margin: {
                  top: 8,
                  right: 16,
                  bottom: 8,
                  left: 0,
                },
                lines: [
                  {
                    seriesIndex: 0,
                    name: "Created",
                    curve: "monotone",
                    stroke: "var(--chart-1)",
                    strokeWidth: 2,
                    connectNulls: false,
                    dots: {
                      show: false,
                      radius: 3,
                      fill: "var(--chart-1)",
                      stroke: "var(--chart-1)",
                      strokeWidth: 1,
                    },
                    activeDot: {
                      show: true,
                      radius: 5,
                      fill: "var(--chart-1)",
                      stroke: "white",
                      strokeWidth: 2,
                    },
                    fill: {
                      enabled: true,
                      color: "var(--chart-1)",
                      opacity: 0.12,
                    },
                  },
                  {
                    seriesIndex: 1,
                    name: "Completed",
                    curve: "monotone",
                    stroke: "var(--chart-2)",
                    strokeWidth: 2,
                    connectNulls: false,
                    dots: {
                      show: false,
                      radius: 3,
                      fill: "var(--chart-2)",
                      stroke: "var(--chart-2)",
                      strokeWidth: 1,
                    },
                    activeDot: {
                      show: true,
                      radius: 5,
                      fill: "var(--chart-2)",
                      stroke: "white",
                      strokeWidth: 2,
                    },
                    fill: {
                      enabled: false,
                      color: "var(--chart-2)",
                      opacity: 0.12,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      trigger: "Maps",
      rows: [
        {
          height: 40,
          components: [
            {
              moduleName: "MapModule",
              space: 12,
              chartID: "dummy-map-chart",
              chartTitle: "Regional coverage",
              chartDescription: "Dummy map data for the test page.",
              mockData: [
                {
                  kind: "region",
                  regionCode: "US",
                  value: 82,
                  label: "United States",
                },
                {
                  kind: "region",
                  regionCode: "DE",
                  value: 64,
                  label: "Germany",
                },
                {
                  kind: "region",
                  regionCode: "FR",
                  value: 58,
                  label: "France",
                },
                { kind: "region", regionCode: "JP", value: 76, label: "Japan" },
                {
                  kind: "region",
                  regionCode: "BR",
                  value: 45,
                  label: "Brazil",
                },
                {
                  kind: "point",
                  lat: 40.7128,
                  lng: -74.006,
                  value: 14,
                  label: "New York",
                },
                {
                  kind: "point",
                  lat: 51.5074,
                  lng: -0.1278,
                  value: 19,
                  label: "London",
                },
                {
                  kind: "point",
                  lat: 35.6762,
                  lng: 139.6503,
                  value: 16,
                  label: "Tokyo",
                },
              ],
              chartConfig: {
                projection: {
                  type: "geoMercator",
                  center: [0, 20],
                  scale: 130,
                },
                zoom: {
                  enabled: true,
                  min: 1,
                  max: 8,
                  initial: 1,
                },
                geography: {
                  stroke: "#cbd5e1",
                  strokeWidth: 0.7,
                  defaultFill: "#e2e8f0",
                },
                choropleth: {
                  enabled: true,
                  colorScale: {
                    type: "gradient",
                    gradient: {
                      minColor: "#dbeafe",
                      maxColor: "#2563eb",
                    },
                  },
                  noDataColor: "#f1f5f9",
                },
                bubbles: {
                  enabled: true,
                  radius: {
                    min: 6,
                    max: 18,
                  },
                  color: {
                    mode: "value",
                    gradient: {
                      minColor: "#fbbf24",
                      maxColor: "#f97316",
                    },
                  },
                  stroke: "white",
                  strokeWidth: 1,
                  opacity: 0.8,
                },
                tooltip: {
                  show: true,
                },
                regionLabels: {
                  show: true,
                  color: "#0f172a",
                  fontSize: 10,
                  fontWeight: 600,
                },
                legend: {
                  show: true,
                  position: "top-right",
                },
              },
            },
          ],
        },
      ],
    },
  ] as const satisfies TabsConfig[];

  const dashboardConfig: DashboardConfig<typeof tabsConfig> = {
    filters: [
      {
        id: "exampleFilterDimension",
        label: "Example Filter Dimension",
        scope: "global",
        type: "dateString",
        defaultValue: "",
      },
    ],

    tabs: tabsConfig,
    reportName: "Example Report",
  };

  useLayoutEffect(() => {
    initFilterStore({
      dimensions: dashboardConfig.filters,
      initialActiveTab: dashboardConfig.tabs[0]?.trigger ?? "",
      initialValues: dashboardConfig.filters.reduce(
        (acc, filter) => {
          acc[filter.key] = filter.defaultValue;
          return acc;
        },
        {} as Record<string, FilterValue>,
      ),
    });

    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ChartPageWrapper>
      <DashboardShell config={dashboardConfig} />
    </ChartPageWrapper>
  );
};

export default TestPage;
