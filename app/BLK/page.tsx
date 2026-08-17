import React from "react";
import ChartPageWrapper from "@/components/ChartPageWrapper";
import { TapsWrapper } from "@/components/TapsWrapper";
import { TabsConfig } from "@/types/tabs";

export default function BLK() {
  const tabsConfig: TabsConfig[] = [
    {
      trigger: "overview",
      rows: [
        {
          height: 20,
          components: [
            {
              moduleName: "LineChartModule",
              space: 12,
              chartID: "8fa17fc4-60ee-4114-a9dc-6ea6295f7ea7",
              chartTitle: "Aktive Announcements pro Woche",
              chartDescription:
                "Zeigt, wie viele Announcements je Woche aktiv waren.",
              filterConfig: [
                {
                  key: "from",
                  value: null,
                  type: "dateString",
                },
                {
                  key: "to",
                  value: null,
                  type: "dateString",
                },
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
                  cursor: false,
                },
                legend: {
                  show: false,
                },
                margin: {
                  top: 8,
                  right: 4,
                  bottom: 8,
                  left: 0,
                },
                lines: [
                  {
                    seriesIndex: 0,
                    name: "Aktive Announcements",
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
                      enabled: false,
                      color: "var(--chart-1)",
                      opacity: 0.2,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ];

  return (
    <ChartPageWrapper>
      <TapsWrapper tabsConfig={tabsConfig} />
    </ChartPageWrapper>
  );
}
