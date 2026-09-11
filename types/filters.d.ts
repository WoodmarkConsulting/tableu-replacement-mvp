type FilterType =
  | "string"
  | "number"
  | "dateString"
  | "dateRange"
  | "select"
  | "multiselect";

type FilterScope = "global" | "tab";

type FilterOption = {
  label: string;
  value: string;
};

type DateRangeValue = {
  from: string | null;
  to: string | null;
};

type FilterValue = string | number | null | DateRangeValue | string[];

type FilterDimension<Tconf extends TabsConfig[] = TabsConfig[]> = {
  id: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  // Names a SQL file at pagesConfig/sql/filterOptions/<optionsSource>.sql that
  // returns rows with `value` (and optional `label`). Overrides static options.
  optionsSource?: string;
  // For `dateString`/`dateRange`, may be a relative token resolved at load:
  // "today"/"now", or "<+/-N> <day|week|month|year>[s]" (e.g. "-3 months").
  // Any other string is treated as an explicit YYYY-MM-DD literal.
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

type FilterSnapshot = {
  values: Record<string, FilterValue>;
  activeTab: string;
};
