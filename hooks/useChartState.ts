import { useState } from "react";

export type ChartFiltersState = {
  [key: string]: string | number | null;
};

const useChartState = (filterConfig: FilterConfig[]) => {
  const [filters, setFilters] = useState<ChartFiltersState>(
    filterConfig.reduce((acc, filter) => {
      acc[filter.key] = filter.value || null;
      return acc;
    }, {} as ChartFiltersState),
  );

  return [filters, setFilters] as const;
};

export default useChartState;
