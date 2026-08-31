type FilterType = "string" | "number" | "dateString" | "dateRange" | "select";

type FilterScope = "global" | "tab";

export type SelectionMode = "single" | "multi";

type FilterOption = {
  label: string;
  value: string;
};

type DateRangeValue = {
  from: string | null;
  to: string | null;
};

type FilterValue = string | number | null | DateRangeValue;

type FilterDimension<Tconf extends TabsConfig[] = TabsConfig[]> = {
  id: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  defaultValue?: FilterValue;
} & (
  | {
      scope: "global";
      tab?: never;
    }
  | {
      scope: "tab";
      tab: Tconf[number]["trigger"];
    }
);

type DrillConfig = {
  // When set, navigate to this tab after applying the selection (cross-tab drill).
  // When omitted, the selection filters in place (same-page or global cross-filter).
  targetTab?: string;
  selectionMode: SelectionMode;
  // Maps a selection key emitted by the module to a target filter dimension id.
  selectionBindings: Record<string, string>;
};

type FilterSnapshot = {
  values: Record<string, FilterValue>;
  activeTab: string;
};
