type TabsConfig = {
  trigger: string;
  rows: {
    height: BaseChartProps["height"];
    components: {
      module: React.ComponentType<BaseChartProps>;
      space: number;
    }[];
  }[];
};
