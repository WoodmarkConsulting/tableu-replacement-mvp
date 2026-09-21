type FilterType =
  | "string"
  | "number"
  | "dateString"
  | "dateRange"
  | "select"
  | "multiselect"
  | "option";

type FilterOption = {
  label: string;
  value: string;
};

type DateRangeValue = {
  from: string | null;
  to: string | null;
};

type FilterValue = string | number | null | DateRangeValue | string[];

type CompositionRule = "intersect" | "union";

type CompositionRules = {
  sameSourceKind?: CompositionRule;
  crossSourceKind?: CompositionRule;
};

type FilterTarget =
  | { kind: "dashboard" }
  | { kind: "tab"; tab: string }
  | { kind: "chart"; chartID: TableSchemaKey };

type FilterSource =
  | { kind: "control"; dimensionId: string }
  | {
      kind: "tabJump";
      actionId: string;
      sourceChartID: TableSchemaKey;
    }
  | {
      kind: "chartSelection";
      actionId: string;
      sourceChartID: TableSchemaKey;
    };

type FilterContribution = {
  key: string;
  dimensionId: string;
  source: FilterSource;
  target: FilterTarget;
  value: FilterValue;
};

type FilterDimension<Tconf extends TabsConfig[] = TabsConfig[]> = {
  // Stable identifier that must be unique across the complete dashboard.
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
  control?:
    | { location: "dashboard" }
    | { location: "tab"; tab: Tconf[number]["trigger"] };
  composition?: CompositionRules;
};

type FilterSnapshotV1 = {
  version?: 1;
  values: Record<string, FilterValue>;
  activeTab: string;
};

type FilterSnapshotV2 = {
  version: 2;
  contributions: Record<string, FilterContribution>;
  activeTab: string;
};

type FilterSnapshot = FilterSnapshotV1 | FilterSnapshotV2;
