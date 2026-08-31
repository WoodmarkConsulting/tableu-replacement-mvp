import type { ChartFiltersState } from "@/hooks/useChartState";
import { create } from "zustand";

type SetFilterCallback = (
  currentFilters: ChartFiltersState,
) => ChartFiltersState;

export type GlobalFilterState = {
  globalFilters: ChartFiltersState;
  globalFilterConfig: PagesConfig["globalFilters"];

  changeFilterByKey: (key: string, value: string | number | null) => void;
  setFilter: (callback: SetFilterCallback) => ChartFiltersState;

  setGlobalFilterConfig: (config: PagesConfig["globalFilters"]) => void;
};

const useGlobalFilters = create<GlobalFilterState>((set, get) => {
  const changeFilterByKey: GlobalFilterState["changeFilterByKey"] = (
    key,
    value,
  ) => {
    set((state) => ({
      globalFilters: {
        ...state.globalFilters,
        [key]: value,
      },
    }));
  };

  const setGlobalFilterConfig: GlobalFilterState["setGlobalFilterConfig"] = (
    config,
  ) =>
    set(() => ({
      globalFilterConfig: config,
    }));

  const setFilter: GlobalFilterState["setFilter"] = (callback) => {
    set((state) => {
      return {
        globalFilters: callback(state.globalFilters),
      };
    });

    return get().globalFilters;
  };

  return {
    globalFilters: {},
    globalFilterConfig: [],

    // actions
    changeFilterByKey,
    setFilter,

    //init
    setGlobalFilterConfig,
  };
});

export default useGlobalFilters;
