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
  selfFetching?: boolean;
  // Maps a filter dimension id to a field in this chart's JSON SQL input.
  filterBindings?: Record<string, string>;
} & BaseChartProps;

type TabsConfig = {
  trigger: string;
  rows: {
    height?: Range1To100;
    components: TabsComponentConfig[];
  }[];
};

type FilterActionMapping = {
  // Where the mapped value is read from. Meaning depends on the action's
  // sourceResolution:
  // - "clientRow": a field on each selected row. Top-level keys and
  //   `values.<column>` are both accepted. Every present value must be a
  //   primitive (string | number | boolean).
  // - "tooltipLookup": an exact column alias returned by the source
  //   `.tooltip.sql`. The alias may be a primitive or an array of primitives.
  sourceField: string;
  // Target filter dimension ID on the target chart or tab.
  targetDimensionId: string;
};

type ActionTrigger = "manual" | "auto";
type ActionSourceResolution = "clientRow" | "tooltipLookup";

type ActionTarget<Tconf extends TabsConfig[] = TabsConfig[]> =
  | { kind: "chart"; chartID: Tconf[number]["rows"][number]["components"][number]["chartID"] }
  | { kind: "tab"; tab: Tconf[number]["trigger"] }
  // Applies the contribution dashboard-wide (every chart on every tab). Cannot navigate.
  | { kind: "dashboard" };

type ChartAction<Tconf extends TabsConfig[] = TabsConfig[]> = {
  id: string;
  fromChartID: Tconf[number]["rows"][number]["components"][number]["chartID"];
  label?: string; // Optional context menu / tooltip label; ignored for trigger "auto"
  trigger?: ActionTrigger; // Default: "manual"
  // Required. There is no safe default: "clientRow" silently yields nothing for
  // modules whose rows do not expose the field as a top-level primitive.
  sourceResolution: ActionSourceResolution;
  target: ActionTarget<Tconf>;
  // Only valid when target.kind === "tab". The tab is target.tab; it is never
  // repeated here, so the two can not diverge.
  navigate?: { restoreOnReturn?: boolean }; // restoreOnReturn default: true
  // Guard against lasso selections producing multi-thousand-value IN lists.
  maxDistinctValues?: number; // Default: ACTION_VALUE_LIMIT (500)
  mappings: FilterActionMapping[];
};

type DashboardConfig<T extends TabsConfig[] = TabsConfig[]> = {
  reportName: string;
  filters: FilterDimension<T>[];
  tabs: T;
  actions?: ChartAction<T>[];
};
