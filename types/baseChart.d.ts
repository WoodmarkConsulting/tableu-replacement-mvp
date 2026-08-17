import type { ChartConfigs } from "@/modules/modulRegistry";
type FilterTypes = "dateString" | "number" | "string";

type FilterConfig = {
  key: string;
  value: string | null;
  type: FilterTypes;
};

type BaseChartProps = {
  chartTitle?: string;
  chartDescription: string;
  chartID: string;
  filterConfig: FilterConfig[];
  chartConfig: ChartConfigs;
};

export interface ChartWrapperInjectedProps<
  D extends ChartDataTemplate,
> extends BaseChartProps {
  height: number;
  chartData: D[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
}
