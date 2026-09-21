import { assertKeySafe, validateFilterDimensions } from "./filterDimensions";

const enumerableTypes: FilterType[] = ["select", "multiselect", "option"];
// A drilldown or action must resolve to a value the target control can hold and compare.
const undrillableTypes: FilterType[] = ["dateString", "dateRange"];

export function validateDashboardConfig(config: DashboardConfig): void {
  if (!Array.isArray(config?.filters) || !Array.isArray(config?.tabs)) {
    throw new Error(
      "Dashboard config must be an object with `filters` and `tabs` arrays.",
    );
  }

  validateFilterDimensions(config.filters);

  const tabs = new Set(config.tabs.map((tab) => tab.trigger));
  const charts = new Map<string, TabsComponentConfig>();
  const chartsByTab = new Map<string, TabsComponentConfig[]>();
  const dimensions = new Map(
    config.filters.map((dimension) => [dimension.id, dimension]),
  );

  for (const tab of config.tabs) {
    const tabCharts = tab.rows.flatMap((row) => row.components);
    chartsByTab.set(tab.trigger, tabCharts);
    for (const chart of tabCharts) {
      charts.set(chart.chartID, chart);
    }
  }

  for (const dimension of config.filters) {
    if (
      dimension.control?.location === "tab" &&
      !tabs.has(dimension.control.tab)
    ) {
      throw new Error(
        `Filter dimension "${dimension.id}" references unknown control tab "${dimension.control.tab}".`,
      );
    }
    if (dimension.defaultValue !== undefined && !dimension.control) {
      throw new Error(
        `Filter dimension "${dimension.id}" has a defaultValue but no control.`,
      );
    }
  }

  for (const chart of charts.values()) {
    const sqlFields = new Set<string>();
    for (const [dimensionId, sqlField] of Object.entries(
      chart.filterBindings ?? {},
    )) {
      const dimension = dimensions.get(dimensionId);
      if (!dimension) {
        throw new Error(
          `Chart "${chart.chartID}" binds unknown filter dimension "${dimensionId}".`,
        );
      }
      if (sqlFields.has(sqlField)) {
        throw new Error(
          `Chart "${chart.chartID}" binds multiple dimensions to SQL field "${sqlField}".`,
        );
      }
      if (dimension.type === "dateRange") {
        throw new Error(
          `Chart "${chart.chartID}" cannot bind dateRange dimension "${dimensionId}" to one SQL field.`,
        );
      }
      sqlFields.add(sqlField);
    }

    if ("autoApplyConnections" in chart) {
      throw new Error(
        `Chart "${chart.chartID}" uses legacy autoApplyConnections; set apply on each connection instead.`,
      );
    }
  }

  const raw = config as Record<string, unknown>;
  if ("connections" in raw) {
    throw new Error(
      `Dashboard "${config.reportName}": legacy "connections" is no longer supported. Use "actions" instead.`,
    );
  }

  if ("tabJumps" in raw) {
    throw new Error(
      `Dashboard "${config.reportName}": legacy "tabJumps" is no longer supported. Use "actions" instead.`,
    );
  }

  const actions = config.actions ?? [];

  const actionIds = new Set<string>();
  const producerCounts = new Map<string, number>();
  for (const dimension of config.filters) {
    if (dimension.control) {
      producerCounts.set(dimension.id, 1);
    }
  }

  for (const action of actions) {
    if (!action.id || actionIds.has(action.id)) {
      throw new Error(`Filter action id "${action.id}" must be non-empty and unique.`);
    }
    assertKeySafe("Filter action id", action.id);
    actionIds.add(action.id);

    if (
      action.sourceResolution !== "clientRow" &&
      action.sourceResolution !== "tooltipLookup"
    ) {
      throw new Error(
        `Action "${action.id}" must specify sourceResolution ("clientRow" | "tooltipLookup").`,
      );
    }

    if (!charts.has(action.fromChartID)) {
      throw new Error(
        `Action "${action.id}" references unknown source chart "${action.fromChartID}".`,
      );
    }

    if (action.navigate) {
      if (action.trigger === "auto") {
        throw new Error(`Action "${action.id}" with navigate must use trigger "manual".`);
      }
      if (action.target.kind !== "tab") {
        throw new Error(`Action "${action.id}" has navigate but target kind is not "tab".`);
      }
    }

    if (action.maxDistinctValues !== undefined) {
      if (typeof action.maxDistinctValues !== "number" || action.maxDistinctValues <= 0) {
        throw new Error(`Action "${action.id}" maxDistinctValues must be a positive number.`);
      }
    }

    if (action.target.kind === "chart") {
      const targetChart = charts.get(action.target.chartID);
      if (!targetChart) {
        throw new Error(
          `Action "${action.id}" references unknown target chart "${action.target.chartID}".`,
        );
      }
    } else if (action.target.kind === "tab") {
      if (!tabs.has(action.target.tab)) {
        throw new Error(
          `Action "${action.id}" references unknown target tab "${action.target.tab}".`,
        );
      }
      assertKeySafe(`Target tab of action "${action.id}"`, action.target.tab);
    } else {
      throw new Error(
        `Action "${action.id}" has invalid target kind "${(action.target as Record<string, unknown>)?.kind}".`,
      );
    }

    if (!Array.isArray(action.mappings) || action.mappings.length === 0) {
      throw new Error(`Action "${action.id}" must specify at least one mapping.`);
    }

    for (const mapping of action.mappings) {
      const dimension = dimensions.get(mapping.targetDimensionId);
      if (!dimension) {
        throw new Error(
          `Action "${action.id}" maps unknown dimension "${mapping.targetDimensionId}".`,
        );
      }

      if (undrillableTypes.includes(dimension.type)) {
        throw new Error(
          `Action "${action.id}" cannot target ${dimension.type} dimension "${dimension.id}".`,
        );
      }

      if ((action.trigger ?? "manual") === "auto" && dimension.type !== "multiselect") {
        throw new Error(
          `Action "${action.id}" with trigger "auto" must target a multiselect dimension, received "${dimension.id}".`,
        );
      }

      if (action.target.kind === "chart") {
        const targetChart = charts.get(action.target.chartID)!;
        if (targetChart.filterBindings?.[dimension.id] === undefined) {
          throw new Error(
            `Target chart "${targetChart.chartID}" does not bind dimension "${dimension.id}".`,
          );
        }
      } else if (action.target.kind === "tab") {
        const reachesChart = (chartsByTab.get(action.target.tab) ?? []).some(
          (chart) => chart.filterBindings?.[dimension.id] !== undefined,
        );
        if (!reachesChart) {
          throw new Error(
            `Action "${action.id}" dimension "${dimension.id}" is not bound by a chart on tab "${action.target.tab}".`,
          );
        }
      }

      producerCounts.set(dimension.id, (producerCounts.get(dimension.id) ?? 0) + 1);
    }
  }

  for (const dimension of config.filters) {
    if (
      !enumerableTypes.includes(dimension.type) &&
      (producerCounts.get(dimension.id) ?? 0) > 1
    ) {
      throw new Error(
        `Non-enumerable dimension "${dimension.id}" has more than one producer anywhere in the dashboard; only enumerable dimensions can compose.`,
      );
    }
  }

  const graph = new Map<string, string[]>();
  for (const action of actions) {
    if (action.navigate) {
      continue;
    }
    if (action.target.kind === "chart") {
      graph.set(action.fromChartID, [
        ...(graph.get(action.fromChartID) ?? []),
        action.target.chartID,
      ]);
    } else if (action.target.kind === "tab") {
      const targetCharts = (chartsByTab.get(action.target.tab) ?? []).filter((chart) =>
        action.mappings.some(
          (mapping) => chart.filterBindings?.[mapping.targetDimensionId] !== undefined,
        ),
      );
      for (const targetChart of targetCharts) {
        graph.set(action.fromChartID, [
          ...(graph.get(action.fromChartID) ?? []),
          targetChart.chartID,
        ]);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (chartID: string) => {
    if (visiting.has(chartID)) {
      throw new Error("Chart action graph must be acyclic.");
    }
    if (visited.has(chartID)) {
      return;
    }
    visiting.add(chartID);
    for (const target of graph.get(chartID) ?? []) {
      visit(target);
    }
    visiting.delete(chartID);
    visited.add(chartID);
  };
  for (const chartID of graph.keys()) {
    visit(chartID);
  }
}