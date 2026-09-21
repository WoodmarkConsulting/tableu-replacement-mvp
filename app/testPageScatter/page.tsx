"use client";

import { useLayoutEffect } from "react";
import { useShallow } from "zustand/shallow";

import { DashboardShell } from "@/components/DashboardShell";
import useFilterStore from "@/stores/filterProvider";

const INITIAL_TAB = "Scatterplot";

export default function TestPageScatter() {
  const { initFilterStore, resetFilterStore } = useFilterStore(
    useShallow((state) => ({
      initFilterStore: state.initFilterStore,
      resetFilterStore: state.resetFilterStore,
    })),
  );

  const tabsConfig = [
    {
      trigger: INITIAL_TAB,
      rows: [
        {
          height: 58,
          components: [
            {
              moduleName: "ScatterPlotModule",
              space: 12,
              chartID: "dtc-scatter",
              chartTitle: "DTC-Verteilung – Standard",
              chartDescription:
                "Standarddarstellung mit automatischen Ticks, Grid, Hover und Legende.",
              enhancedTooltip: true,
              selfFetching: true,
              chartConfig: {
                xAxis: {
                  label: "Kilometerstand",
                },
                yAxis: {
                  label: "Häufigkeit",
                },
                colorMapping: {
                  values: [
                    {
                      value: -1,
                      label: "Aktiv",
                    },
                    {
                      value: 0,
                      label: "Inaktiv",
                    },
                  ],
                },
              },
            },
          ],
        },
        {
          height: 58,
          components: [
            {
              moduleName: "ScatterPlotModule",
              space: 12,
              chartID: "dtc-scatter-full",
              chartTitle: "DTC-Verteilung – Vollkonfiguration",
              chartDescription:
                "Detailansicht mit konfigurierter Domain, Referenzen und Legendenposition.",
              enhancedTooltip: true,
              selfFetching: true,
              chartConfig: {
                xAxis: {
                  label: "Kilometerstand",
                  format: "compact",
                  decimals: 1,
                  suffix: "km",
                  tickCount: 6,
                  showTicks: true,
                  domain: {
                    min: 0,
                    max: 500_000,
                  },
                },
                yAxis: {
                  label: "Häufigkeit",
                  format: "number",
                  decimals: 0,
                  tickCount: 6,
                  showTicks: true,
                  domain: {
                    min: 0,
                    max: 50,
                  },
                },
                pointLimit: {
                  default: 500_000,
                  max: 5_000_000,
                },
                points: {
                  radiusPixels: 2,
                  opacity: 1,
                },
                raster: {
                  dotRadiusPixels: 2,
                  opacity: 0.8,
                },
                grid: "both",
                hoverTooltip: true,
                legend: {
                  position: "right",
                },
                referenceAreas: [
                  {
                    axis: "x",
                    from: 0,
                    to: 150_000,
                    label: "Niedriger Kilometerstand",
                    color: "rgba(14, 116, 144, 0.08)",
                  },
                ],
                referenceLines: [
                  {
                    axis: "x",
                    value: 100_000,
                    label: "100.000 km",
                    color: "#0e7490",
                  },
                  {
                    axis: "y",
                    value: 10,
                    label: "Häufigkeit 10",
                    color: "#b45309",
                  },
                ],
                colorMapping: {
                  values: [
                    {
                      value: -1,
                      color: "#dc2626",
                      label: "Aktiv",
                    },
                    {
                      value: 0,
                      color: "#2563eb",
                      label: "Inaktiv",
                    },
                  ],
                  defaultColor: "#64748b",
                },
              },
            },
          ],
        },
      ],
    },
  ] as const satisfies TabsConfig[];

  const dashboardConfig: DashboardConfig<typeof tabsConfig> = {
    reportName: "Scatterplot-Test",
    filters: [],
    tabs: tabsConfig,
  };

  useLayoutEffect(() => {
    initFilterStore({
      dimensions: [],
      initialActiveTab: INITIAL_TAB,
    });

    return resetFilterStore;
  }, [initFilterStore, resetFilterStore]);

  return <DashboardShell config={dashboardConfig} />;
}
