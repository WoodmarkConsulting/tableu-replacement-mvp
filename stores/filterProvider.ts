import { create } from "zustand";

import {
  contributionKey,
  createControlContribution,
  getControlTarget,
  isEmptyFilterValue,
  isFilterContributionShape,
  matchesDimensionType,
} from "@/lib/filters/contributions";
import { resolveTabJumpContributions } from "@/lib/filters/tabJump";
import { validateFilterDimensions } from "@/lib/filterDimensions";

type CreateFilterStoreArgs = {
  dimensions: FilterDimension[];
  initialActiveTab: string;
  initialContributions?: Record<string, FilterContribution>;
};

const RELATIVE_DATE_PATTERN = /^([+-]?\d+)\s*(day|week|month|year)s?$/i;

const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

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

const buildDefaultContributions = (
  dimensions: FilterDimension[],
): Record<string, FilterContribution> => {
  const contributions: Record<string, FilterContribution> = {};

  for (const dimension of dimensions) {
    if (dimension.defaultValue === undefined) {
      continue;
    }

    const contribution = createControlContribution(
      dimension,
      resolveDefaultValue(dimension),
    );
    if (contribution) {
      contributions[contribution.key] = contribution;
    }
  }

  return contributions;
};

const indexContributions = (
  contributions: FilterContribution[],
): Record<string, FilterContribution> =>
  Object.fromEntries(
    contributions
      .filter((contribution) => !isEmptyFilterValue(contribution.value))
      .map((contribution) => [contribution.key, contribution]),
  );

const removeSourceContributions = (
  contributions: Record<string, FilterContribution>,
  sourceChartID: string,
  actionIds?: Set<string>,
): Record<string, FilterContribution> =>
  Object.fromEntries(
    Object.entries(contributions).filter(
      ([, contribution]) =>
        contribution.source.kind !== "chartSelection" ||
        contribution.source.sourceChartID !== sourceChartID ||
        (actionIds !== undefined &&
          !actionIds.has(contribution.source.actionId)),
    ),
  );

export const controlContributionKey = (
  dimension: FilterDimension,
): string | null => {
  const target = getControlTarget(dimension);

  if (!target) {
    return null;
  }

  return contributionKey(
    { kind: "control", dimensionId: dimension.id },
    target,
    dimension.id,
  );
};

export type TabJumpBreadcrumb = {
  fromTab: string;
  fromChartID: string;
  fromChartTitle?: string;
  targetTab: string;
  appliedKeys: string[];
  previousContributions: Record<string, FilterContribution | undefined>;
  restoreOnReturn: boolean;
};

export type PendingFilterAction = {
  sourceChartID: string;
  contributions: FilterContribution[];
};

export type FilterStoreState = {
  _isInit: boolean;
  dimensions: FilterDimension[];
  draftContributions: Record<string, FilterContribution>;
  appliedContributions: Record<string, FilterContribution>;
  pendingAction: PendingFilterAction | null;
  hasApplied: boolean;
  activeTab: string;
  breadcrumbs: TabJumpBreadcrumb[];
  setDraftFilter: (dimensionId: string, value: FilterValue) => void;
  applyFilters: () => void;
  resetDraft: () => void;
  removeContribution: (key: string) => void;
  clearAll: () => void;
  stagePendingAction: (
    sourceChartID: string,
    contributions: FilterContribution[],
  ) => void;
  applyPendingAction: () => void;
  applyActionContributions: (
    sourceChartID: string,
    contributions: FilterContribution[],
    actionIds?: string[],
  ) => void;
  // Without `sourceChartID` any staged action is dropped; with it only the
  // named chart's staging is dropped, so unmounting a chart cannot discard
  // another chart's staged action.
  clearPendingAction: (sourceChartID?: string) => void;
  clearActionSource: (sourceChartID: string, actionIds?: string[]) => void;
  executeTabJump: (
    jump: TabJumpConfig,
    selectedRows: Record<string, unknown>[],
    fromChartTitle?: string,
  ) => boolean;
  navigateBack: () => void;
  clearBreadcrumbs: () => void;
  setActiveTab: (tab: string) => void;
  hydrateSnapshot: (snapshot: FilterSnapshot) => void;
  initFilterStore: (args: CreateFilterStoreArgs) => void;
  resetFilterStore: () => void;
};

export const isDirty = (state: FilterStoreState): boolean => {
  const draftKeys = Object.keys(state.draftContributions).sort();
  const appliedKeys = Object.keys(state.appliedContributions).sort();
  if (draftKeys.length !== appliedKeys.length) {
    return true;
  }

  return draftKeys.some(
    (key, index) =>
      key !== appliedKeys[index] ||
      JSON.stringify(state.draftContributions[key]) !==
        JSON.stringify(state.appliedContributions[key]),
  );
};

const useFiltersStore = create<FilterStoreState>((set, get) => ({
  _isInit: false,
  dimensions: [],
  draftContributions: {},
  appliedContributions: {},
  pendingAction: null,
  hasApplied: false,
  activeTab: "",
  breadcrumbs: [],

  setDraftFilter: (dimensionId, value) =>
    set((state) => {
      const dimension = state.dimensions.find(
        (candidate) => candidate.id === dimensionId,
      );
      if (!dimension) {
        return state;
      }

      const key = controlContributionKey(dimension);
      if (!key) {
        return state;
      }

      const draftContributions = { ...state.draftContributions };
      const contribution = createControlContribution(dimension, value);
      if (contribution) {
        draftContributions[key] = contribution;
      } else {
        delete draftContributions[key];
      }

      return { draftContributions };
    }),

  applyFilters: () =>
    set((state) => ({
      appliedContributions: { ...state.draftContributions },
      hasApplied: true,
    })),

  resetDraft: () =>
    set((state) => ({
      draftContributions: { ...state.appliedContributions },
    })),

  removeContribution: (key) =>
    set((state) => {
      const draftContributions = { ...state.draftContributions };
      const appliedContributions = { ...state.appliedContributions };
      delete draftContributions[key];
      delete appliedContributions[key];

      let breadcrumbs = state.breadcrumbs;
      const top = breadcrumbs.at(-1);
      if (
        top &&
        !top.appliedKeys.some((appliedKey) =>
          Object.hasOwn(appliedContributions, appliedKey),
        )
      ) {
        breadcrumbs = breadcrumbs.slice(0, -1);
      }

      return { draftContributions, appliedContributions, breadcrumbs };
    }),

  // Returns to the seeded defaults and the idle state instead of querying every
  // chart unfiltered.
  clearAll: () =>
    set((state) => {
      const seeded = buildDefaultContributions(state.dimensions);

      return {
        draftContributions: seeded,
        appliedContributions: seeded,
        pendingAction: null,
        hasApplied: false,
        breadcrumbs: [],
      };
    }),

  stagePendingAction: (sourceChartID, contributions) =>
    set({ pendingAction: { sourceChartID, contributions } }),

  applyPendingAction: () =>
    set((state) => {
      if (!state.pendingAction) {
        return state;
      }

      const { sourceChartID, contributions } = state.pendingAction;
      const next = indexContributions(contributions);
      const actionIds = new Set(
        contributions.flatMap((contribution) =>
          "actionId" in contribution.source
            ? [contribution.source.actionId]
            : [],
        ),
      );
      return {
        draftContributions: {
          ...removeSourceContributions(
            state.draftContributions,
            sourceChartID,
            actionIds,
          ),
          ...next,
        },
        appliedContributions: {
          ...removeSourceContributions(
            state.appliedContributions,
            sourceChartID,
            actionIds,
          ),
          ...next,
        },
        pendingAction: null,
        hasApplied: true,
      };
    }),

  applyActionContributions: (
    sourceChartID,
    contributions,
    explicitActionIds,
  ) =>
    set((state) => {
      const next = indexContributions(contributions);
      const actionIds = new Set(
        explicitActionIds ??
          contributions.flatMap((contribution) =>
            "actionId" in contribution.source
              ? [contribution.source.actionId]
              : [],
          ),
      );
      return {
        draftContributions: {
          ...removeSourceContributions(
            state.draftContributions,
            sourceChartID,
            actionIds,
          ),
          ...next,
        },
        appliedContributions: {
          ...removeSourceContributions(
            state.appliedContributions,
            sourceChartID,
            actionIds,
          ),
          ...next,
        },
        pendingAction: state.pendingAction,
        hasApplied: true,
      };
    }),

  clearPendingAction: (sourceChartID) =>
    set((state) =>
      sourceChartID === undefined ||
      state.pendingAction?.sourceChartID === sourceChartID
        ? { pendingAction: null }
        : state,
    ),

  clearActionSource: (sourceChartID, explicitActionIds) =>
    set((state) => ({
      draftContributions: removeSourceContributions(
        state.draftContributions,
        sourceChartID,
        explicitActionIds ? new Set(explicitActionIds) : undefined,
      ),
      appliedContributions: removeSourceContributions(
        state.appliedContributions,
        sourceChartID,
        explicitActionIds ? new Set(explicitActionIds) : undefined,
      ),
      pendingAction:
        state.pendingAction?.sourceChartID === sourceChartID
          ? null
          : state.pendingAction,
    })),

  executeTabJump: (jump, selectedRows, fromChartTitle) => {
    const state = get();
    const nextContributions = resolveTabJumpContributions(
      state.dimensions,
      jump,
      selectedRows,
    );

    if (!nextContributions) {
      return false;
    }

    const previousContributions: Record<
      string,
      FilterContribution | undefined
    > = {};
    for (const contribution of nextContributions) {
      previousContributions[contribution.key] =
        state.appliedContributions[contribution.key];
    }

    const indexed = indexContributions(nextContributions);
    const breadcrumb: TabJumpBreadcrumb = {
      fromTab: state.activeTab,
      fromChartID: jump.fromChartID,
      fromChartTitle,
      targetTab: jump.targetTab,
      appliedKeys: Object.keys(indexed),
      previousContributions,
      restoreOnReturn: jump.restoreOnReturn ?? true,
    };

    set((current) => ({
      draftContributions: { ...current.draftContributions, ...indexed },
      appliedContributions: { ...current.appliedContributions, ...indexed },
      activeTab: jump.targetTab,
      hasApplied: true,
      breadcrumbs: [...current.breadcrumbs, breadcrumb],
    }));
    return true;
  },

  navigateBack: () =>
    set((state) => {
      const breadcrumb = state.breadcrumbs.at(-1);
      if (!breadcrumb) {
        return state;
      }

      const draftContributions = { ...state.draftContributions };
      const appliedContributions = { ...state.appliedContributions };
      if (breadcrumb.restoreOnReturn) {
        for (const key of breadcrumb.appliedKeys) {
          const previous = breadcrumb.previousContributions[key];
          if (previous) {
            draftContributions[key] = previous;
            appliedContributions[key] = previous;
          } else {
            delete draftContributions[key];
            delete appliedContributions[key];
          }
        }
      }

      return {
        draftContributions,
        appliedContributions,
        activeTab: breadcrumb.fromTab,
        breadcrumbs: state.breadcrumbs.slice(0, -1),
      };
    }),

  clearBreadcrumbs: () => set({ breadcrumbs: [] }),

  setActiveTab: (tab) =>
    set((state) => {
      const breadcrumb = state.breadcrumbs.at(-1);
      return {
        activeTab: tab,
        ...(breadcrumb && tab !== breadcrumb.targetTab
          ? { breadcrumbs: [] }
          : {}),
      };
    }),

  hydrateSnapshot: (snapshot) =>
    set((state) => {
      const dimensionsById = new Map(
        state.dimensions.map((dimension) => [dimension.id, dimension]),
      );
      const contributions: Record<string, FilterContribution> = {};

      if (snapshot.version === 2) {
        if (
          !snapshot.contributions ||
          typeof snapshot.contributions !== "object" ||
          Array.isArray(snapshot.contributions)
        ) {
          return state;
        }

        for (const [entryKey, entry] of Object.entries(
          snapshot.contributions,
        )) {
          if (isEmptyFilterValue((entry as FilterContribution)?.value)) {
            continue;
          }

          const dimension = isFilterContributionShape(entry)
            ? dimensionsById.get(entry.dimensionId)
            : undefined;

          // One bad entry invalidates the whole snapshot: a partially applied
          // filter set would silently show the wrong data.
          if (
            !dimension ||
            entryKey !== (entry as FilterContribution).key ||
            !matchesDimensionType(
              dimension,
              (entry as FilterContribution).value,
            )
          ) {
            return state;
          }

          contributions[entryKey] = entry as FilterContribution;
        }
      } else {
        if (
          !snapshot.values ||
          typeof snapshot.values !== "object" ||
          Array.isArray(snapshot.values)
        ) {
          return state;
        }

        for (const [legacyKey, value] of Object.entries(snapshot.values)) {
          const [scope, tabOrId, ...idParts] = legacyKey.split(":");
          const dimensionId =
            scope === "tab"
              ? idParts.join(":")
              : [tabOrId, ...idParts].join(":");
          const dimension = state.dimensions.find(
            (candidate) => candidate.id === dimensionId,
          );
          if (!dimension || isEmptyFilterValue(value)) {
            continue;
          }

          const source: FilterSource = { kind: "control", dimensionId };
          const target: FilterTarget =
            scope === "tab"
              ? { kind: "tab", tab: tabOrId }
              : { kind: "dashboard" };
          const key = contributionKey(source, target, dimensionId);
          contributions[key] = {
            key,
            dimensionId,
            source,
            target,
            value,
          };
        }
      }

      return {
        draftContributions: contributions,
        appliedContributions: contributions,
        activeTab: snapshot.activeTab || state.activeTab,
        hasApplied: true,
      };
    }),

  initFilterStore: ({
    dimensions,
    initialActiveTab,
    initialContributions,
  }) => {
    if (get()._isInit) {
      return;
    }

    validateFilterDimensions(dimensions);
    const seeded = {
      ...buildDefaultContributions(dimensions),
      ...(initialContributions ?? {}),
    };
    set({
      _isInit: true,
      dimensions,
      draftContributions: seeded,
      appliedContributions: seeded,
      pendingAction: null,
      hasApplied: false,
      activeTab: initialActiveTab,
      breadcrumbs: [],
    });
  },

  resetFilterStore: () =>
    set({
      _isInit: false,
      dimensions: [],
      draftContributions: {},
      appliedContributions: {},
      pendingAction: null,
      hasApplied: false,
      activeTab: "",
      breadcrumbs: [],
    }),
}));

export default useFiltersStore;
