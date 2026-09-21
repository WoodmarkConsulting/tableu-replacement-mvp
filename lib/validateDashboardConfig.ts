import { assertKeySafe, validateFilterDimensions } from "./filterDimensions";

const enumerableTypes: FilterType[] = ["select", "multiselect", "option"];
// A drilldown must resolve to a value the target control can hold and compare.
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

  const actionIds = new Set<string>();
  const producerCounts = new Map<string, number>();
  for (const dimension of config.filters) {
    if (dimension.control) {
      producerCounts.set(dimension.id, 1);
    }
  }

  const registerAction = (id: string) => {
    if (!id || actionIds.has(id)) {
      throw new Error(`Filter action id "${id}" must be non-empty and unique.`);
    }
    assertKeySafe("Filter action id", id);
    actionIds.add(id);
  };

  for (const jump of config.tabJumps ?? []) {
    registerAction(jump.id);
    if (!charts.has(jump.fromChartID)) {
      throw new Error(
        `Tab jump "${jump.id}" references unknown source chart "${jump.fromChartID}".`,
      );
    }
    if (!tabs.has(jump.targetTab)) {
      throw new Error(
        `Tab jump "${jump.id}" references unknown target tab "${jump.targetTab}".`,
      );
    }
    assertKeySafe(`Target tab of tab jump "${jump.id}"`, jump.targetTab);

    for (const mapping of jump.mappings) {
      const dimension = dimensions.get(mapping.targetDimensionId);
      if (!dimension) {
        throw new Error(
          `Tab jump "${jump.id}" maps unknown dimension "${mapping.targetDimensionId}".`,
        );
      }
      if (undrillableTypes.includes(dimension.type)) {
        throw new Error(
          `Tab jump "${jump.id}" cannot target ${dimension.type} dimension "${dimension.id}".`,
        );
      }
      const reachesChart = (chartsByTab.get(jump.targetTab) ?? []).some(
        (chart) => chart.filterBindings?.[dimension.id] !== undefined,
      );
      if (!reachesChart) {
        throw new Error(
          `Tab jump "${jump.id}" dimension "${dimension.id}" is not bound by a chart on tab "${jump.targetTab}".`,
        );
      }
      producerCounts.set(dimension.id, (producerCounts.get(dimension.id) ?? 0) + 1);
    }
  }

  const graph = new Map<string, string[]>();
  for (const connection of config.connections ?? []) {
    registerAction(connection.id);
    const source = charts.get(connection.fromChartID);
    const target = charts.get(connection.toChartID);
    if (!source || !target) {
      throw new Error(
        `Chart connection "${connection.id}" references an unknown source or target chart.`,
      );
    }

    const legacy = connection as unknown as Record<string, unknown>;
    if ("expectedColumns" in legacy) {
      throw new Error(
        `Chart connection "${connection.id}" uses legacy expectedColumns; use mappings instead.`,
      );
    }
    graph.set(connection.fromChartID, [
      ...(graph.get(connection.fromChartID) ?? []),
      connection.toChartID,
    ]);

    for (const mapping of connection.mappings) {
      const dimension = dimensions.get(mapping.targetDimensionId);
      if (!dimension) {
        throw new Error(
          `Chart connection "${connection.id}" maps unknown dimension "${mapping.targetDimensionId}".`,
        );
      }
      // A selection always resolves to a value set, so the target must be able
      // to hold more than one value.
      if (dimension.type !== "multiselect") {
        throw new Error(
          `Chart connection "${connection.id}" must target a multiselect dimension, received "${dimension.id}".`,
        );
      }
      if (target.filterBindings?.[dimension.id] === undefined) {
        throw new Error(
          `Target chart "${target.chartID}" does not bind dimension "${dimension.id}".`,
        );
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

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (chartID: string) => {
    if (visiting.has(chartID)) {
      throw new Error("Chart connection graph must be acyclic.");
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