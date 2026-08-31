"use client";
import ChartPageWrapper from "@/components/ChartPageWrapper";
import { useShallow } from "zustand/shallow";

import { useLayoutEffect } from "react";

import { DashboardShell } from "@/components/DashboardShell";
import { FilterValue } from "@/types/filters";
import useFiltersStore from "@/stores/filterProvider";

const TestPage = () => {
  const { initFilterStore, resetFilterStore } = useFiltersStore(
    useShallow((s) => ({
      initFilterStore: s.initFilterStore,
      resetFilterStore: s.resetFilterStore,
    })),
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
      trigger: "Analytics",
      rows: [
        {
          height: 40,
          components: [
            {
              moduleName: "LineChartModule",
              space: 6,

              chartID: "dummy-line-chart",
              chartTitle: "Fleet activity",
              chartDescription:
                "Dummy sample data for the Analytics test page.",
              mockData: [
                { x: 1714521600000, y: [120, 8] },
                { x: 1714608000000, y: [150, 10] },
                { x: 1714694400000, y: [180, 13] },
                { x: 1714780800000, y: [200, 16] },
                { x: 1714867200000, y: [170, 15] },
                { x: 1714953600000, y: [240, 21] },
                { x: 1715040000000, y: [280, 22] },
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
  ] as const satisfies TabsConfig[];

  const dashboardConfig: DashboardConfig<typeof tabsConfig> = {
    filters: [
      {
        id: "exampleGLOBALDimension",
        label: "Example GLOBAL Filter",
        scope: "global",
        type: "dateString",
        defaultValue: "",
      },
      {
        id: "exampleFilterDimension",
        label: "Example Filter Dimension",
        scope: "tab",
        type: "dateString",
        defaultValue: "",
        tab: "Overview",
      },
      {
        id: "exampleFilterDimensionAnalytics",
        label: "Example Filter Dimension Analytics",
        scope: "tab",
        type: "dateString",
        defaultValue: "",
        tab: "Analytics",
      },
    ],

    tabs: tabsConfig,
    reportName: "Example Report",
  };

  const globalFilters: PagesConfig["globalFilters"] = [
    {
      key: "exampleFilterFrom",
      label: "Example Filter From",
      type: "dateString",
      value: "",
    },
    {
      key: "exampleFilterTo",
      label: "Example Filter To",
      type: "dateString",
      value: "",
    },
  ];

  useLayoutEffect(() => {
    initFilterStore({
      dimensions: dashboardConfig.filters,
      initialActiveTab: dashboardConfig.tabs[0]?.trigger ?? "",
      initialValues: globalFilters.reduce(
        (acc, filter) => {
          acc[filter.key] = filter.value;
          return acc;
        },
        {} as Record<string, FilterValue>,
      ),
    });

    return () => {
      resetFilterStore();
    };

    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ChartPageWrapper>
      {/* <FilterProvider
        dimensions={dashboardConfig.filters}
        initialActiveTab={dashboardConfig.tabs[0]?.trigger ?? ""}> */}
      <DashboardShell config={dashboardConfig} />
      {/* </FilterProvider> */}
    </ChartPageWrapper>
  );
};

export default TestPage;
