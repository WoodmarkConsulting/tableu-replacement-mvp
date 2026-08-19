import type { ChartConfigs } from "@/modules/modulRegistry";

export type ChartDataTemplate = object;

export type FilterTypes = "dateString" | "number" | "string";

export type FilterConfig = {
  key: string;
  value: string | null;
  type: FilterTypes;
};

export type BaseChartProps<
  C extends ChartConfigs = ChartConfigs,
> = {
  chartTitle?: string;
  chartDescription: string;
  chartID: string;
  filterConfig: FilterConfig[];
  chartConfig: C;
};

export interface ChartWrapperInjectedProps<
  D extends ChartDataTemplate,
  C extends ChartConfigs = ChartConfigs,
> extends BaseChartProps<C> {
  height: number;
  chartData: D[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
}
