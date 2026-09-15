type ModuleRegistryKeys = import("@/modules/modulRegistry").ModuleRegistryKeys;

type Enumerate<
  N extends number,
  Acc extends number[] = [],
> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;

type Range1To100 = Exclude<Enumerate<101>, 0>;

type TabsComponentConfig = {
  moduleName: ModuleRegistryKeys;
  space: number;
  mockData?: unknown[];
  // Maps a filter dimension id to the SQL named parameter used by this chart.
  filterBindings?: Record<string, string>;
} & BaseChartProps;

type TabsConfig = {
  trigger: string;
  rows: {
    height?: Range1To100;
    components: TabsComponentConfig[];
  }[];
};

type ChartConnection<Tconf extends TabsConfig[] = TabsConfig[]> = {
  [ToChartID in TableSchemaKey]: {
    fromChartID: Tconf[number]["rows"][number]["components"][number]["chartID"];
    toChartID: ToChartID;
    expectedColumns: TableColumnNames<ToChartID>[];
  };
}[TableSchemaKey];

type TabJumpMapping = {
  // Column from selected chart data (client-side selectedRows).
  // Must resolve to a primitive (string | number | boolean) on every selected row.
  sourceField: string;
  // Target filter dimension ID on the target tab
  targetDimensionId: string;
};

type TabJumpConfig<Tconf extends TabsConfig[] = TabsConfig[]> = {
  fromChartID: Tconf[number]["rows"][number]["components"][number]["chartID"];
  targetTab: Tconf[number]["trigger"];
  label?: string; // Optional context menu label, e.g. "Details in [Tab] ansehen"
  mappings: TabJumpMapping[];
  // If true (default), restores the target tab's previous filter values when
  // returning via the breadcrumb. Named for what it does: restore, not clear.
  restoreOnReturn?: boolean;
};

type DashboardConfig<T extends TabsConfig[] = TabsConfig[]> = {
  reportName: string;
  filterLayout: "sidebar" | "top";
  filters: FilterDimension<T>[];
  tabs: T;
  connections?: ChartConnection<T>[];
  tabJumps?: TabJumpConfig<T>[];
};
