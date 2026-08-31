"use client";

import { createContext, useContext, useState } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

import type { FilterDimension, FilterValue } from "@/types/filters";

export const globalKey = (dimensionId: string) => `global:${dimensionId}`;

export const tabKey = (tabId: string, dimensionId: string) =>
  `tab:${tabId}:${dimensionId}`;

export type FilterState = {
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
};

type CreateFilterStoreArgs = {
  dimensions: FilterDimension[];
  initialActiveTab: string;
  initialValues?: Record<string, FilterValue>;
};

type FilterStore = ReturnType<typeof createFilterStore>;

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

const createFilterStore = ({
  dimensions,
  initialActiveTab,
  initialValues,
}: CreateFilterStoreArgs) =>
  createStore<FilterState>((set) => ({
    dimensions,
    values: { ...buildDefaultValues(dimensions), ...(initialValues ?? {}) },
    activeTab: initialActiveTab,
    setFilter: (key, value) =>
      set((state) => ({ values: { ...state.values, [key]: value } })),
    clearDimension: (key) =>
      set((state) => {
        const next = { ...state.values };
        delete next[key];
        return { values: next };
      }),
    clearAll: () => set({ values: {} }),
    applySelection: (entries, navigateTo) =>
      set((state) => {
        const next = { ...state.values, ...entries };

        return navigateTo
          ? { values: next, activeTab: navigateTo }
          : { values: next };
      }),
    setActiveTab: (tab) => set({ activeTab: tab }),
  }));

const FilterStoreContext = createContext<FilterStore | null>(null);

type FilterProviderProps = CreateFilterStoreArgs & {
  children: React.ReactNode;
};

export function FilterProvider({
  children,
  dimensions,
  initialActiveTab,
  initialValues,
}: FilterProviderProps) {
  const [store] = useState<FilterStore>(() =>
    createFilterStore({ dimensions, initialActiveTab, initialValues }),
  );

  return (
    <FilterStoreContext.Provider value={store}>
      {children}
    </FilterStoreContext.Provider>
  );
}

export function useFilterStore<T>(selector: (state: FilterState) => T): T {
  const store = useContext(FilterStoreContext);

  if (!store) {
    throw new Error("useFilterStore must be used within a FilterProvider");
  }

  return useStore(store, selector);
}

export function useFilterStoreApi(): FilterStore {
  const store = useContext(FilterStoreContext);

  if (!store) {
    throw new Error("useFilterStoreApi must be used within a FilterProvider");
  }

  return store;
}
