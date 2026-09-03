type FilterType = "string" | "number" | "dateString" | "dateRange" | "select";

type FilterScope = "global" | "tab";

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

type FilterSnapshot = {
  values: Record<string, FilterValue>;
  activeTab: string;
};
