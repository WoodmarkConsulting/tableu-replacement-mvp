import { create } from "zustand";

export type ConnectionFilterValue = string | number | boolean;
export type ConnectionFilters = Partial<
  Record<TableSchemaKey, Record<string, ConnectionFilterValue[]>>
>;

type ChartConnectionsStore = {
  filtersBySource: Record<string, ConnectionFilters>;
  filtersByChart: ConnectionFilters;
  pendingSourceFilters: {
    sourceChartID: string;
    filters: ConnectionFilters;
  } | null;
  stageSourceFilters: (
    sourceChartID: string,
    filters: ConnectionFilters,
  ) => void;
  applyPendingSourceFilters: () => void;
  clearPendingSourceFilters: () => void;
  setSourceFilters: (sourceChartID: string, filters: ConnectionFilters) => void;
  resetConnections: () => void;
};

function mergeFiltersByChart(
  filtersBySource: Record<string, ConnectionFilters>,
): ConnectionFilters {
  const merged: ConnectionFilters = {};

  for (const sourceFilters of Object.values(filtersBySource)) {
    for (const [chartID, columns] of Object.entries(sourceFilters)) {
      const target = (merged[chartID as TableSchemaKey] ??= {});

      for (const [column, values] of Object.entries(columns)) {
        target[column] = Array.from(
          new Set([...(target[column] ?? []), ...values]),
        );
      }
    }
  }

  return merged;
}

const useChartConnectionsStore = create<ChartConnectionsStore>((set) => ({
  filtersBySource: {},
  filtersByChart: {},
  pendingSourceFilters: null,
  stageSourceFilters: (sourceChartID, filters) =>
    set({ pendingSourceFilters: { sourceChartID, filters } }),
  applyPendingSourceFilters: () =>
    set((state) => {
      if (!state.pendingSourceFilters) {
        return state;
      }

      const { sourceChartID, filters } = state.pendingSourceFilters;
      const filtersBySource = {
        ...state.filtersBySource,
        [sourceChartID]: filters,
      };

      return {
        filtersBySource,
        filtersByChart: mergeFiltersByChart(filtersBySource),
        pendingSourceFilters: null,
      };
    }),
  clearPendingSourceFilters: () => set({ pendingSourceFilters: null }),
  setSourceFilters: (sourceChartID, filters) =>
    set((state) => {
      const filtersBySource = {
        ...state.filtersBySource,
        [sourceChartID]: filters,
      };

      return {
        filtersBySource,
        filtersByChart: mergeFiltersByChart(filtersBySource),
      };
    }),
  resetConnections: () =>
    set({
      filtersBySource: {},
      filtersByChart: {},
      pendingSourceFilters: null,
    }),
}));

export default useChartConnectionsStore;
