import React from "react";
          import ChartPageWrapper from "@/components/ChartPageWrapper";
          import { TapsWrapper } from "@/components/TapsWrapper";
          import { TabsConfig } from "@/types/tabs";

          export default function DacoDa() {
            const tabsConfig: TabsConfig[] = [
  {
    "trigger": "Overview",
    "rows": [
      {
        "height": 12,
        "components": [
          {
            "moduleName": "LineChartModule",
            "space": 3,
            "chartID": "123456as",
            "chartTitle": "Fleet activity",
            "chartDescription": "This chart shows the activity of fleets over time.",
            "filterConfig": [
              {
                "key": "from",
                "value": null,
                "type": "dateString"
              },
              {
                "key": "to",
                "value": null,
                "type": "dateString"
              }
            ],
            "chartConfig": {
              "dataConfig": {
                "fleets_created": {
                  "label": "Fleets created",
                  "color": "var(--chart-1)"
                },
                "processing_started": {
                  "label": "Processing started",
                  "color": "var(--chart-2)"
                }
              },
              "xAxis": {
                "dataKey": "event_date",
                "show": true,
                "tickLine": false,
                "axisLine": false,
                "tickMargin": 8,
                "format": "date-month-day"
              },
              "yAxis": {
                "show": true,
                "tickLine": false,
                "axisLine": false
              },
              "grid": {
                "show": true,
                "horizontal": true,
                "vertical": false,
                "strokeDasharray": "3 3"
              },
              "tooltip": {
                "show": true,
                "cursor": false
              },
              "legend": {
                "show": true
              },
              "margin": {
                "top": 8,
                "right": 12,
                "bottom": 8,
                "left": 12
              },
              "lines": [
                {
                  "dataKey": "fleets_created",
                  "name": "Fleets created",
                  "curve": "monotone",
                  "stroke": "var(--color-fleets_created)",
                  "strokeWidth": 2,
                  "connectNulls": false,
                  "dots": {
                    "show": false,
                    "radius": 4,
                    "fill": "var(--color-fleets_created)",
                    "stroke": "var(--color-fleets_created)",
                    "strokeWidth": 1
                  },
                  "activeDot": {
                    "show": true,
                    "radius": 6,
                    "fill": "var(--color-fleets_created)",
                    "stroke": "white",
                    "strokeWidth": 2
                  },
                  "fill": {
                    "enabled": false,
                    "color": "var(--color-fleets_created)",
                    "opacity": 0.2
                  }
                },
                {
                  "dataKey": "processing_started",
                  "name": "Processing started",
                  "curve": "step",
                  "stroke": "var(--color-processing_started)",
                  "strokeWidth": 2,
                  "connectNulls": false,
                  "dots": {
                    "show": true,
                    "radius": 3,
                    "fill": "var(--color-processing_started)",
                    "stroke": "white",
                    "strokeWidth": 1
                  },
                  "activeDot": {
                    "show": true,
                    "radius": 6,
                    "fill": "var(--color-processing_started)",
                    "stroke": "white",
                    "strokeWidth": 2
                  },
                  "fill": {
                    "enabled": true,
                    "color": "var(--color-processing_started)",
                    "opacity": 0.15
                  }
                }
              ]
            },
            "chartDataTemplate": {
              "event_date": "2026-02-02",
              "fleets_created": 2,
              "processing_started": 0
            }
          }
        ]
      }
    ]
  }
];

            return (
              <ChartPageWrapper>
                <TapsWrapper tabsConfig={tabsConfig} />
              </ChartPageWrapper>
            );
          }