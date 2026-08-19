import type { ModuleRegistryKeys } from "@/modules/modulRegistry";
import type { BaseChartProps } from "./baseChart";

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
} & BaseChartProps;

type TabsConfig = {
  trigger: string;
  rows: {
    height?: Range1To100;
    components: TabsComponentConfig[];
  }[];
};
