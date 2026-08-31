import type { ModuleRegistryKeys } from "@/modules/modulRegistry";
import type { BaseChartProps } from "./baseChart";
import type { DrillConfig, FilterDimension, FilterLayout } from "./filters";

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
  drill?: DrillConfig;
} & BaseChartProps;

type TabsConfig = {
  trigger: string;
  rows: {
    height?: Range1To100;
    components: TabsComponentConfig[];
  }[];
};

type DashboardConfig = {
  reportName: string;
  filterLayout: FilterLayout;
  filters: FilterDimension[];
  tabs: TabsConfig[];
};
