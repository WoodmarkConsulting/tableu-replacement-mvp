type ChartConfigs = import("@/modules/modulRegistry").ChartConfigs;
type SelectionMode = import("./filters").SelectionMode;

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
  // Present only when the chart is configured as a drill source.
  selectionMode?: SelectionMode;
  onSelectionChange?: (rows: D[]) => void;
}
