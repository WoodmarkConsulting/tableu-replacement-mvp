import { create } from "zustand";

type CreateFilterStoreArgs = {
  dimensions: FilterDimension[];
  initialActiveTab: string;
  initialValues?: Record<string, FilterValue>;
};

export const globalKey = (dimensionId: string) => `global:${dimensionId}`;

export const tabKey = (tabId: string, dimensionId: string) =>
  `tab:${tabId}:${dimensionId}`;

// Relative date tokens usable as `defaultValue` for `dateString`/`dateRange`
// filters, e.g. "today", "-3 months", "+1 week". Resolved to a concrete
// YYYY-MM-DD at store init so downstream code keeps handling ISO date strings.
const RELATIVE_DATE_PATTERN = /^([+-]?\d+)\s*(day|week|month|year)s?$/i;

const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Returns the resolved ISO date for a relative token, or null when the string
// is not a relative token (e.g. an explicit "2026-01-01" date literal).
export const resolveRelativeDate = (
  token: string,
  now: Date = new Date(),
): string | null => {
  const trimmed = token.trim().toLowerCase();

  if (trimmed === "today" || trimmed === "now") {
    return toIsoDate(now);
  }

  const match = RELATIVE_DATE_PATTERN.exec(trimmed);

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (unit) {
    case "day":
      date.setDate(date.getDate() + amount);
      break;
    case "week":
      date.setDate(date.getDate() + amount * 7);
      break;
    case "month":
      date.setMonth(date.getMonth() + amount);
      break;
    case "year":
      date.setFullYear(date.getFullYear() + amount);
      break;
  }

  return toIsoDate(date);
};

const resolveDateToken = (value: string): string =>
  resolveRelativeDate(value) ?? value;

// Resolves relative date tokens in a dimension's default value. Non-date types
// and explicit date literals pass through unchanged.
const resolveDefaultValue = (dimension: FilterDimension): FilterValue => {
  const { type, defaultValue } = dimension;

  if (type === "dateString" && typeof defaultValue === "string") {
    return resolveDateToken(defaultValue);
  }

  if (
    type === "dateRange" &&
    defaultValue &&
    typeof defaultValue === "object" &&
    !Array.isArray(defaultValue)
  ) {
    return {
      from:
        typeof defaultValue.from === "string"
          ? resolveDateToken(defaultValue.from)
          : defaultValue.from,
      to:
        typeof defaultValue.to === "string"
          ? resolveDateToken(defaultValue.to)
          : defaultValue.to,
    };
  }

  return defaultValue as FilterValue;
};

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
      values[key] = resolveDefaultValue(dimension);
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
