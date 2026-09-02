type ChartConfigs = import("@/modules/modulRegistry").ChartConfigs;
type BaseChartPropsSelectionMode = import("./filters").SelectionMode;

type ChartDataTemplate = object;

type FilterTypes = "dateString" | "number" | "string";

type FilterConfig = {
  key: string;
  value: string | null;
  type: FilterTypes;
  label?: string;
};

type BaseChartProps<C extends ChartConfigs = ChartConfigs> = {
  chartTitle?: string;
  chartDescription: string;
  chartID: string;
  enhancedTooltip?: boolean;
  // TODO: Remove or update the filterConfig for the Chartspecifiy Filtersection
  // filterConfig: FilterConfig[];
  chartConfig: C;
};

interface ChartWrapperInjectedProps<
  D extends ChartDataTemplate,
  C extends ChartConfigs = ChartConfigs,
> extends BaseChartProps<C> {
  height: number;
  chartData: D[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  onSelectionChange?: (rows: D[]) => void;
}
