export type FilterType =
  | "string"
  | "number"
  | "dateString"
  | "dateRange"
  | "select";

export type FilterScope = "global" | "tab";

export type FilterLayout = "sidebar" | "top";

export type SelectionMode = "single" | "multi";

export type FilterOption = {
  label: string;
  value: string;
};

export type DateRangeValue = {
  from: string | null;
  to: string | null;
};

export type FilterValue = string | number | null | DateRangeValue;

export type FilterDimension = {
  id: string;
  label: string;
  type: FilterType;
  scope: FilterScope;
  // Required when scope is "tab": the tab trigger this dimension belongs to.
  tab?: string;
  // Options for type "select".
  options?: FilterOption[];
  defaultValue?: FilterValue;
};

export type DrillConfig = {
  // When set, navigate to this tab after applying the selection (cross-tab drill).
  // When omitted, the selection filters in place (same-page or global cross-filter).
  targetTab?: string;
  selectionMode: SelectionMode;
  // Maps a selection key emitted by the module to a target filter dimension id.
  selectionBindings: Record<string, string>;
};

export type FilterSnapshot = {
  values: Record<string, FilterValue>;
  activeTab: string;
};
