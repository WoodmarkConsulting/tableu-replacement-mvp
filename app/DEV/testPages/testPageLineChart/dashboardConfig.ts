export const tabsConfig = [
  {
    trigger: "Overview",
    rows: [
      {
        height: 40,
        components: [
          {
            moduleName: "LineChartModule",
            space: 6,
            chartID: "active-users-over-time",
            chartTitle: "Aktive Nutzer über Zeit",
            chartDescription:
              "Wie viele unterschiedliche Nutzer erstellen pro Tag Fleets?",
            enhancedTooltip: true,

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
                show: false,
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
                  name: "Aktive Nutzer",
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
              ],
            },
          },
          {
            moduleName: "LineChartModule",
            space: 6,
            chartID: "cumulative-fleets",
            filterBindings: {
              selected_fleet_creation_date: "fleet_creation_date",
            },
            chartTitle: "Kumulierte Anzahl Fleets",
            chartDescription: "Wie wächst der Bestand über die Zeit?",
            enhancedTooltip: true,
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
                show: false,
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
                  name: "Fleets gesamt",
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
                    enabled: true,
                    color: "var(--chart-2)",
                    opacity: 0.12,
                  },
                },
              ],
            },
          },
        ],
      },
      {
        height: 40,
        components: [
          {
            moduleName: "LineChartModule",
            space: 12,
            chartID: "dtc-table",
            filterBindings: { selected_car: "CarName" },
            chartTitle: "Aktive und gespeicherte DTCs über Zeit",
            chartDescription:
              "Wie entwickeln sich aktive und gespeicherte DTC-Einträge pro Tag?",
            enhancedTooltip: true,
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
                format: "compact",
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
                  name: "Aktive DTCs",
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
                    opacity: 0,
                  },
                },
                {
                  seriesIndex: 1,
                  name: "Gespeicherte DTCs",
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
                    opacity: 0,
                  },
                },
              ],
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
            chartID: "dtc-scatter",
            filterBindings: { selected_last_update: "LastUpdate" },
            chartTitle: "DTC-Verteilung – Standard",
            chartDescription:
              "Standarddarstellung mit automatischen Ticks, Grid, Hover und Legende.",
            enhancedTooltip: true,
            selfFetching: true,
            chartConfig: {
              points: {
                shape: "circle",
              },
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
    ],
  },
  {
    trigger: "TESTTAB",
    rows: [
      {
        height: 40,
        components: [
          {
            moduleName: "LineChartModule",
            space: 6,
            chartID: "active-users-over-time",
            chartTitle: "Aktive Nutzer über Zeit",
            chartDescription:
              "Wie viele unterschiedliche Nutzer erstellen pro Tag Fleets?",
            enhancedTooltip: true,

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
                show: false,
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
                  name: "Aktive Nutzer",
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
              ],
            },
          },
          {
            moduleName: "LineChartModule",
            space: 6,
            chartID: "cumulative-fleets",
            filterBindings: {
              selected_fleet_creation_date: "fleet_creation_date",
            },
            chartTitle: "Kumulierte Anzahl Fleets",
            chartDescription: "Wie wächst der Bestand über die Zeit?",
            enhancedTooltip: true,
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
                show: false,
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
                  name: "Fleets gesamt",
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
                    enabled: true,
                    color: "var(--chart-2)",
                    opacity: 0.12,
                  },
                },
              ],
            },
          },
        ],
      },
      {
        height: 40,
        components: [
          {
            moduleName: "LineChartModule",
            space: 12,
            chartID: "dtc-table",
            filterBindings: { selected_car: "CarName" },
            chartTitle: "Aktive und gespeicherte DTCs über Zeit",
            chartDescription:
              "Wie entwickeln sich aktive und gespeicherte DTC-Einträge pro Tag?",
            enhancedTooltip: true,
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
                format: "compact",
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
                  name: "Aktive DTCs",
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
                    opacity: 0,
                  },
                },
                {
                  seriesIndex: 1,
                  name: "Gespeicherte DTCs",
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
                    opacity: 0,
                  },
                },
              ],
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
            chartID: "dtc-scatter",
            filterBindings: { selected_last_update: "LastUpdate" },
            chartTitle: "DTC-Verteilung – Standard",
            chartDescription:
              "Standarddarstellung mit automatischen Ticks, Grid, Hover und Legende.",
            enhancedTooltip: true,
            selfFetching: true,
            chartConfig: {
              points: {
                shape: "circle",
              },
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
    ],
  },
] as const satisfies TabsConfig[];

export const dashboardConfig: DashboardConfig<typeof tabsConfig> = {
  filters: [
    {
      id: "exampleGLOBALDimension",
      label: "Example GLOBAL Filter",
      control: { location: "dashboard" },
      type: "dateString",
      defaultValue: "",
    },
    {
      id: "exampleFilterDimension",
      label: "Example Filter Dimension",
      control: { location: "tab", tab: "Overview" },
      type: "dateString",
      defaultValue: "",
    },
    {
      id: "selected_fleet_creation_date",
      label: "Selected Fleet Creation Date",
      type: "multiselect",
    },
    {
      id: "selected_car",
      label: "Selected Car",
      type: "multiselect",
    },
    {
      id: "selected_last_update",
      label: "Selected Last Update",
      type: "multiselect",
    },

    // {
    //   id: "exampleFilterDimensionAnalytics",
    //   label: "Example Filter Dimension Analytics",
    //   control: { location: "tab", tab: "Analytics" },
    //   type: "dateString",
    //   defaultValue: "",
    // },
  ],

  tabs: tabsConfig,
  reportName: "Example Report",

  actions: [
    {
      id: "active-users-to-fleets",
      fromChartID: "active-users-over-time",
      target: { kind: "chart", chartID: "cumulative-fleets" },
      sourceResolution: "tooltipLookup",
      trigger: "manual",
      mappings: [
        {
          sourceField: "fleet_creation_date",
          targetDimensionId: "selected_fleet_creation_date",
        },
      ],
    },
    {
      id: "active-users-to-cars",
      fromChartID: "active-users-over-time",
      target: { kind: "chart", chartID: "dtc-table" },
      sourceResolution: "tooltipLookup",
      trigger: "auto",
      mappings: [{ sourceField: "CarName", targetDimensionId: "selected_car" }],
    },
    {
      id: "cars-to-scatter",
      fromChartID: "dtc-table",
      target: { kind: "chart", chartID: "dtc-scatter" },
      sourceResolution: "tooltipLookup",
      trigger: "manual",
      mappings: [
        {
          sourceField: "LastUpdate",
          targetDimensionId: "selected_last_update",
        },
      ],
    },
  ],
};

export const INITIAL_TAB: (typeof tabsConfig)[number]["trigger"] = "Overview";
