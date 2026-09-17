import { create } from "zustand";

import { validateFilterDimensions } from "@/lib/filterDimensions";

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

export type TabJumpBreadcrumb = {
  fromTab: string;
  fromChartID: string;
  fromChartTitle?: string;
  targetTab: string;
  appliedKeys: string[]; // List of tab:<tab>:<dimId> keys injected by the drill
  previousValues: Record<string, FilterValue | undefined>; // Snapshot of values prior to drill for clean rollback
  restoreOnReturn: boolean;
};

const isPrimitive = (v: unknown): v is string | number | boolean =>
  typeof v === "string" || typeof v === "number" || typeof v === "boolean";

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
  breadcrumbs: TabJumpBreadcrumb[];
  setDraftFilter: (key: string, value: FilterValue) => void;
  applyFilters: () => void;
  resetDraft: () => void;
  clearDimension: (key: string) => void;
  clearAll: () => void;
  applySelection: (
    entries: Record<string, FilterValue>,
    navigateTo?: string,
  ) => void;
  executeTabJump: (
    jump: TabJumpConfig,
    selectedRows: Record<string, unknown>[],
    fromChartTitle?: string,
  ) => boolean;
  navigateBack: () => void;
  clearBreadcrumbs: () => void;
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

const commitSelectionMerge = (
  state: FilterStoreState,
  entries: Record<string, FilterValue>,
  navigateTo?: string,
  extra?: Partial<FilterStoreState>,
): Partial<FilterStoreState> => {
  const nextDraft = { ...state.draftValues, ...entries };
  const nextApplied = { ...state.appliedValues, ...entries };

  return {
    draftValues: nextDraft,
    appliedValues: nextApplied,
    hasApplied: true,
    ...(navigateTo ? { activeTab: navigateTo } : {}),
    ...extra,
  };
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

    validateFilterDimensions(dimensions);

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
      breadcrumbs: [],
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

      let nextBreadcrumbs = state.breadcrumbs;
      if (state.breadcrumbs.length > 0) {
        const topBreadcrumb = state.breadcrumbs[state.breadcrumbs.length - 1];
        const hasRemainingKey = topBreadcrumb.appliedKeys.some(
          (k) => nextApplied[k] !== undefined,
        );
        if (!hasRemainingKey) {
          nextBreadcrumbs = state.breadcrumbs.slice(0, -1);
        }
      }

      return {
        draftValues: nextDraft,
        appliedValues: nextApplied,
        breadcrumbs: nextBreadcrumbs,
      };
    });

  const clearAll: FilterStoreState["clearAll"] = () =>
    // Keep hasApplied so charts show "no filters" results, not the idle prompt.
    set(() => ({ draftValues: {}, appliedValues: {}, breadcrumbs: [] }));

  const applySelection: FilterStoreState["applySelection"] = (
    entries,
    navigateTo,
  ) => {
    set((state) => commitSelectionMerge(state, entries, navigateTo));
  };

  const executeTabJump: FilterStoreState["executeTabJump"] = (
    jump,
    selectedRows,
    fromChartTitle,
  ) => {
    if (!selectedRows || selectedRows.length === 0) {
      return false;
    }

    const state = get();
    const entries: Record<string, FilterValue> = {};
    const previousValues: Record<string, FilterValue | undefined> = {};

    for (const mapping of jump.mappings) {
      const raw = selectedRows.map((r) => r[mapping.sourceField]);
      if (raw.every((v) => v === undefined)) {
        return false;
      }
      if (raw.some((v) => v != null && !isPrimitive(v))) {
        return false;
      }

      const uniqueValues = Array.from(
        new Set(raw.filter((v) => v != null)),
      ) as (string | number | boolean)[];

      if (uniqueValues.length === 0) {
        return false;
      }

      const targetDim = state.dimensions.find(
        (d) =>
          d.id === mapping.targetDimensionId &&
          d.scope === "tab" &&
          d.tab === jump.targetTab,
      );

      if (!targetDim) {
        return false;
      }

      if (targetDim.type === "dateString" || targetDim.type === "dateRange") {
        return false;
      }

      let mappedValue: FilterValue;

      if (targetDim.type === "multiselect") {
        mappedValue = uniqueValues.map(String);
      } else {
        if (uniqueValues.length > 1) {
          return false;
        }

        const singleVal = uniqueValues[0];
        if (targetDim.type === "number") {
          mappedValue =
            typeof singleVal === "number" ? singleVal : Number(singleVal);
          if (isNaN(mappedValue)) {
            return false;
          }
        } else {
          mappedValue = String(singleVal);
        }
      }

      const key = tabKey(jump.targetTab, mapping.targetDimensionId);
      entries[key] = mappedValue;
      previousValues[key] = state.appliedValues[key];
    }

    const newBreadcrumb: TabJumpBreadcrumb = {
      fromTab: state.activeTab,
      fromChartID: jump.fromChartID,
      fromChartTitle,
      targetTab: jump.targetTab,
      appliedKeys: Object.keys(entries),
      previousValues,
      restoreOnReturn: jump.restoreOnReturn ?? true,
    };

    set((s) =>
      commitSelectionMerge(s, entries, jump.targetTab, {
        breadcrumbs: [...s.breadcrumbs, newBreadcrumb],
      }),
    );

    return true;
  };

  const navigateBack: FilterStoreState["navigateBack"] = () => {
    set((state) => {
      if (state.breadcrumbs.length === 0) {
        return {};
      }

      const nextBreadcrumbs = [...state.breadcrumbs];
      const popped = nextBreadcrumbs.pop()!;
      const nextDraft = { ...state.draftValues };
      const nextApplied = { ...state.appliedValues };

      if (popped.restoreOnReturn !== false) {
        for (const key of popped.appliedKeys) {
          const prev = popped.previousValues[key];
          if (prev !== undefined) {
            nextDraft[key] = prev;
            nextApplied[key] = prev;
          } else {
            delete nextDraft[key];
            delete nextApplied[key];
          }
        }
      }

      return {
        draftValues: nextDraft,
        appliedValues: nextApplied,
        activeTab: popped.fromTab,
        breadcrumbs: nextBreadcrumbs,
      };
    });
  };

  const clearBreadcrumbs: FilterStoreState["clearBreadcrumbs"] = () =>
    set(() => ({ breadcrumbs: [] }));

  const setActiveTab: FilterStoreState["setActiveTab"] = (tab) =>
    set((state) => {
      const activeBreadcrumb =
        state.breadcrumbs[state.breadcrumbs.length - 1];
      const shouldClear =
        activeBreadcrumb && tab !== activeBreadcrumb.targetTab;

      return {
        activeTab: tab,
        ...(shouldClear ? { breadcrumbs: [] } : {}),
      };
    });

  const resetFilterStore: FilterStoreState["resetFilterStore"] = () => {
    set({
      _isInit: false,
      dimensions: [],
      draftValues: {},
      appliedValues: {},
      hasApplied: false,
      activeTab: "",
      breadcrumbs: [],
    });
  };

  return {
    _isInit: false,
    dimensions: [],
    draftValues: {},
    appliedValues: {},
    hasApplied: false,
    activeTab: "",
    breadcrumbs: [],

    //actions
    setDraftFilter,
    applyFilters,
    resetDraft,
    clearDimension,
    clearAll,
    applySelection,
    executeTabJump,
    navigateBack,
    clearBreadcrumbs,
    setActiveTab,
    initFilterStore,
    resetFilterStore,
  };
});

export default useFiltersStore;
