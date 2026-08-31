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
  // Draft layer: edited by controls, not yet committed to queries.
  // Keyed by `global:<dimId>` or `tab:<tabId>:<dimId>`.
  draftValues: Record<string, FilterValue>;
  // Applied layer: drives queries + chips. Committed via applyFilters().
  appliedValues: Record<string, FilterValue>;
  // Gate: false until the first Apply (or snapshot hydration). Blocks fetching.
  hasApplied: boolean;
  activeTab: string;
  setDraftFilter: (key: string, value: FilterValue) => void;
  applyFilters: () => void;
  resetDraft: () => void;
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

// Shallow inequality of draft vs applied — true when there are pending edits.
export const isDirty = (state: FilterStoreState): boolean => {
  const { draftValues, appliedValues } = state;
  const keys = new Set([
    ...Object.keys(draftValues),
    ...Object.keys(appliedValues),
  ]);

  for (const key of keys) {
    if (draftValues[key] !== appliedValues[key]) {
      return true;
    }
  }

  return false;
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

    const seeded = {
      ...buildDefaultValues(dimensions),
      ...(initialValues ?? {}),
    };

    set({
      _isInit: true,
      dimensions,
      // Seed both layers, but leave hasApplied false so open != fetch.
      draftValues: { ...seeded },
      appliedValues: { ...seeded },
      hasApplied: false,
      activeTab: initialActiveTab,
    });
  };

  const setDraftFilter: FilterStoreState["setDraftFilter"] = (key, value) =>
    set((state) => ({ draftValues: { ...state.draftValues, [key]: value } }));

  const applyFilters: FilterStoreState["applyFilters"] = () =>
    set((state) => ({
      appliedValues: { ...state.draftValues },
      hasApplied: true,
    }));

  const resetDraft: FilterStoreState["resetDraft"] = () =>
    set((state) => ({ draftValues: { ...state.appliedValues } }));

  const clearDimension: FilterStoreState["clearDimension"] = (key) =>
    set((state) => {
      const nextDraft = { ...state.draftValues };
      const nextApplied = { ...state.appliedValues };
      delete nextDraft[key];
      delete nextApplied[key];
      return { draftValues: nextDraft, appliedValues: nextApplied };
    });

  const clearAll: FilterStoreState["clearAll"] = () =>
    // Keep hasApplied so charts show "no filters" results, not the idle prompt.
    set(() => ({ draftValues: {}, appliedValues: {} }));

  const applySelection: FilterStoreState["applySelection"] = (
    entries,
    navigateTo,
  ) => {
    set((state) => {
      // Drill is an explicit, immediate cross-filter: write to both layers so
      // it re-queries without an Apply press and without clobbering pending
      // edits on other dimensions.
      const nextDraft = { ...state.draftValues, ...entries };
      const nextApplied = { ...state.appliedValues, ...entries };

      return navigateTo
        ? {
            draftValues: nextDraft,
            appliedValues: nextApplied,
            hasApplied: true,
            activeTab: navigateTo,
          }
        : {
            draftValues: nextDraft,
            appliedValues: nextApplied,
            hasApplied: true,
          };
    });
  };

  const setActiveTab: FilterStoreState["setActiveTab"] = (tab) =>
    set(() => ({ activeTab: tab }));

  const resetFilterStore: FilterStoreState["resetFilterStore"] = () => {
    set({
      _isInit: false,
      dimensions: [],
      draftValues: {},
      appliedValues: {},
      hasApplied: false,
      activeTab: "",
    });
  };

  return {
    _isInit: false,
    dimensions: [],
    draftValues: {},
    appliedValues: {},
    hasApplied: false,
    activeTab: "",

    //actions
    setDraftFilter,
    applyFilters,
    resetDraft,
    clearDimension,
    clearAll,
    applySelection,
    setActiveTab,
    initFilterStore,
    resetFilterStore,
  };
});

export default useFiltersStore;
