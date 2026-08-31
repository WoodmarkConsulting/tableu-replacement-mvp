import type { ChartConfigs } from "@/modules/modulRegistry";
import type { SelectionMode } from "./filters";

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
  // Present only when the chart is configured as a drill source.
  selectionMode?: SelectionMode;
  onSelectionChange?: (rows: D[]) => void;
}
