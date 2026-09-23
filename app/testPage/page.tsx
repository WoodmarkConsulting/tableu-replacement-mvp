"use client";
import ChartPageWrapper from "@/components/ChartPageWrapper";
import { useShallow } from "zustand/shallow";

import { useLayoutEffect } from "react";
import useFiltersStore from "@/stores/filterProvider";
import { DashboardShell } from "@/components/DashboardShell";

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
          height: 35,
          components: [
            {
              moduleName: "MapModule",
              space: 12,
              chartID: "dummy-map-chart",
              chartTitle: "Regional coverage",
              chartDescription: "Dummy map data for the test page.",
              enhancedTooltip: true,
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
        {
          height: 35,
          components: [
            {
              moduleName: "MapModule",
              space: 12,
              chartID: "dummy-map-chart-ranges",
              chartTitle: "Regional volume (ranges)",
              chartDescription:
                "Dummy map data bucketed into five value ranges.",
              mockData: [
                {
                  kind: "region",
                  regionCode: "US",
                  value: 50,
                  label: "United States",
                },
                {
                  kind: "region",
                  regionCode: "DE",
                  value: 500,
                  label: "Germany",
                },
                {
                  kind: "region",
                  regionCode: "FR",
                  value: 5000,
                  label: "France",
                },
                {
                  kind: "region",
                  regionCode: "JP",
                  value: 50000,
                  label: "Japan",
                },
                {
                  kind: "region",
                  regionCode: "BR",
                  value: 500000,
                  label: "Brazil",
                },
                {
                  kind: "region",
                  regionCode: "CA",
                  value: 750,
                  label: "Canada",
                },
                {
                  kind: "region",
                  regionCode: "AU",
                  value: 25000,
                  label: "Australia",
                },
                {
                  kind: "region",
                  regionCode: "IN",
                  value: 300000,
                  label: "India",
                },
                {
                  kind: "region",
                  regionCode: "CN",
                  value: 8000,
                  label: "China",
                },
                {
                  kind: "region",
                  regionCode: "GB",
                  value: 90,
                  label: "United Kingdom",
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
                    type: "buckets",
                    buckets: [
                      { threshold: 0, color: "#eff6ff" },
                      { threshold: 100, color: "#bfdbfe" },
                      { threshold: 1000, color: "#93c5fd" },
                      { threshold: 10000, color: "#60a5fa" },
                      { threshold: 100000, color: "#2563eb" },
                    ],
                  },
                  noDataColor: "#f1f5f9",
                },
                bubbles: {
                  enabled: false,
                  radius: {
                    min: 6,
                    max: 18,
                  },
                  color: {
                    mode: "fixed",
                    fixedColor: "#3b82f6",
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
        {
          height: 35,
          components: [
            {
              moduleName: "MapModule",
              space: 12,
              chartID: "dummy-map-linked",
              filterBindings: { selected_region: "regionCode" },
              chartTitle: "Linked regions",
              chartDescription:
                "Filtered by the regions selected on 'Regional coverage'. Right-click that map and choose 'Filtern'.",
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
                      minColor: "#dcfce7",
                      maxColor: "#16a34a",
                    },
                  },
                  noDataColor: "#f1f5f9",
                },
                bubbles: {
                  enabled: false,
                  radius: {
                    min: 6,
                    max: 18,
                  },
                  color: {
                    mode: "fixed",
                    fixedColor: "#16a34a",
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
    {
      trigger: "Pie Charts",
      rows: [
        {
          height: 52,
          components: [
            {
              moduleName: "PieChartModule",
              space: 6,
              chartID: "dtc-scatter",
              chartTitle: "Revenue share",
              chartDescription:
                "Full pie without center KPI, using category color overrides.",
              mockData: [
                { name: "Enterprise", value: 46 },
                { name: "Mid-market", value: 29 },
                { name: "Small business", value: 17 },
                { name: "Public sector", value: 8 },
              ],
              chartConfig: {
                pie: {
                  innerRadius: 0,
                  outerRadius: "78%",
                  paddingAngle: 2,
                  cornerRadius: 3,
                },
                margin: { top: 16, right: 24, bottom: 16, left: 24 },
                tooltip: { show: true, cursor: false },
                legend: {
                  show: true,
                  position: "bottom",
                  content: "name-percent",
                },
                colors: {
                  palette: [
                    "var(--chart-1)",
                    "var(--chart-2)",
                    "var(--chart-3)",
                    "var(--chart-4)",
                  ],
                  byName: {
                    Enterprise: "#0f766e",
                    "Public sector": "#dc2626",
                  },
                },
                labels: {
                  show: true,
                  position: "outside",
                  content: "name-percent",
                  leaderLines: true,
                  minPercent: 0.05,
                  maxLabelChars: 18,
                  numberFormat: {
                    format: "percent",
                    decimals: 0,
                    locale: "en-US",
                  },
                },
                sort: { by: "value", direction: "desc" },
                maxSlices: 12,
                selectionStyle: {
                  fadeOthersOpacity: 0.3,
                  stroke: "var(--foreground)",
                  strokeWidth: 2,
                },
              },
            },
            {
              moduleName: "PieChartModule",
              space: 6,
              chartID: "dtc-scatter-full",
              chartTitle: "Orders by channel",
              chartDescription:
                "Donut with selected-value KPI and grouped long-tail channels.",
              mockData: [
                { name: "Direct", value: 380 },
                { name: "Partner", value: 270 },
                { name: "Marketplace", value: 190 },
                { name: "Referral", value: 85 },
                { name: "Events", value: 44 },
                { name: "Other campaigns", value: 31 },
              ],
              chartConfig: {
                pie: {
                  innerRadius: "56%",
                  outerRadius: "80%",
                  paddingAngle: 2,
                  cornerRadius: 4,
                },
                margin: { top: 16, right: 24, bottom: 16, left: 24 },
                tooltip: { show: true, cursor: false },
                legend: {
                  show: true,
                  position: "right",
                  content: "name-value",
                },
                colors: {
                  palette: ["#0891b2", "#eab308", "#16a34a", "#2563eb"],
                },
                labels: {
                  show: false,
                  position: "inside",
                  content: "value",
                  leaderLines: false,
                  minPercent: 0.08,
                  numberFormat: {
                    format: "number",
                    decimals: 0,
                    locale: "en-US",
                    useGrouping: true,
                  },
                },
                centerLabel: {
                  show: true,
                  mode: "selected",
                  label: "Orders",
                  numberFormat: {
                    format: "number",
                    decimals: 0,
                    locale: "en-US",
                  },
                },
                groupOthers: {
                  enabled: true,
                  mode: "topN",
                  value: 4,
                  label: "Other",
                  color: "#94a3b8",
                },
                sort: { by: "value", direction: "desc" },
                maxSlices: 8,
                selectionStyle: {
                  fadeOthersOpacity: 0.3,
                  stroke: "var(--foreground)",
                  strokeWidth: 2,
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
        control: { location: "dashboard" },
        type: "dateString",
        defaultValue: "",
      },
      {
        id: "selected_region",
        label: "Selected Region",
        type: "multiselect",
      },
    ],

    tabs: tabsConfig,
    reportName: "Example Report",

    actions: [
      {
        id: "map-regions",
        fromChartID: "dummy-map-chart",
        target: { kind: "chart", chartID: "dummy-map-linked" },
        sourceResolution: "tooltipLookup",
        trigger: "manual",
        mappings: [
          { sourceField: "regionCode", targetDimensionId: "selected_region" },
        ],
      },
    ],
  };

  useLayoutEffect(() => {
    initFilterStore({
      dimensions: dashboardConfig.filters,
      initialActiveTab: dashboardConfig.tabs[0]?.trigger ?? "",
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
