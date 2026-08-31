import type { FilterDimension, FilterValue } from "@/types/filters";
import { create } from "zustand";

type CreateFilterStoreArgs = {
  dimensions: FilterDimension[];
  initialActiveTab: string;
  initialValues?: Record<string, FilterValue>;
};

export const globalKey = (dimensionId: string) => `global:${dimensionId}`;

export const tabKey = (tabId: string, dimensionId: string) =>
  `tab:${tabId}:${dimensionId}`;

const buildDefaultValues = (
  dimensions: FilterDimension[],
): Record<string, FilterValue> => {
  const values: Record<string, FilterValue> = {};

  for (const dimension of dimensions) {
    if (dimension.defaultValue === undefined) {
      continue;
    }

    const key =
      dimension.scope === "global"
        ? globalKey(dimension.id)
        : dimension.tab
          ? tabKey(dimension.tab, dimension.id)
          : null;

    if (key) {
      values[key] = dimension.defaultValue;
    }
  }

  return values;
};

export type FilterStoreState = {
  // initialisation
  _isInit: boolean;

  // Static dimension definitions for this dashboard.
  dimensions: FilterDimension[];
  // Values keyed by `global:<dimId>` or `tab:<tabId>:<dimId>`.
  values: Record<string, FilterValue>;
  activeTab: string;
  setFilter: (key: string, value: FilterValue) => void;
  clearDimension: (key: string) => void;
  clearAll: () => void;
  applySelection: (
    entries: Record<string, FilterValue>,
    navigateTo?: string,
  ) => void;
  setActiveTab: (tab: string) => void;
  initFilterStore: (args: CreateFilterStoreArgs) => void;
  resetFilterStore: () => void;
};

const useFiltersStore = create<FilterStoreState>((set, get) => {
  const initFilterStore: FilterStoreState["initFilterStore"] = ({
    dimensions,
    initialActiveTab,
    initialValues,
  }) => {
    if (get()._isInit) {
      return;
    }

    set({
      _isInit: true,
      dimensions,
      values: { ...buildDefaultValues(dimensions), ...(initialValues ?? {}) },
      activeTab: initialActiveTab,
    });
  };

  const setFilter: FilterStoreState["setFilter"] = (key, value) =>
    set((state) => ({ values: { ...state.values, [key]: value } }));

  const clearDimension: FilterStoreState["clearDimension"] = (key) =>
    set((state) => {
      const newValues = { ...state.values };
      delete newValues[key];
      return { values: newValues };
    });

  const clearAll: FilterStoreState["clearAll"] = () =>
    set(() => ({ values: {} }));

  const applySelection: FilterStoreState["applySelection"] = (
    entries,
    navigateTo,
  ) => {
    set((state) => {
      const next = { ...state.values, ...entries };

      return navigateTo
        ? { values: next, activeTab: navigateTo }
        : { values: next };
    });
  };

  const setActiveTab: FilterStoreState["setActiveTab"] = (tab) =>
    set(() => ({ activeTab: tab }));

  const resetFilterStore: FilterStoreState["resetFilterStore"] = () => {
    set({
      _isInit: false,
      dimensions: [],
      values: {},
      activeTab: "",
    });
  };

  return {
    _isInit: false,
    dimensions: [],
    values: {},
    activeTab: "",

    //actions
    setFilter,
    clearDimension,
    clearAll,
    applySelection,
    setActiveTab,
    initFilterStore,
    resetFilterStore,
  };
});

export default useFiltersStore;
