type TableChartConfig = {
  /**
   * Column-group definitions enabling fold/unfold. Optional.
   *
   * A group renders collapsed by default: its member columns are hidden and, if
   * `summaryColumnId` is set, that single column is shown in their place. Expanding the
   * group reveals all member columns. Groups are independent of hierarchy (row expansion).
   */
  columnGroups?: {
    id: string;
    header: string;
    /** Column ids that belong to this group. */
    memberColumnIds: string[];
    /** Shown when folded; must be one of memberColumnIds. Omit to show nothing when folded. */
    summaryColumnId?: string;
    /** Initial state. Default "folded". */
    defaultState: "folded" | "unfolded";
  }[];

  /** Leaf columns, left-to-right in render order. */
  columns: {
    /** Stable column id; also the default value key. */
    id: string;
    /** Key read from row.values. Defaults to `id` when omitted. */
    valueKey?: string;
    header: string;
    /** Controls cell rendering + formatting + default alignment. */
    type: "string" | "number" | "percent" | "currency" | "date" | "boolean";
    align?: "left" | "center" | "right";
    /** Number/date formatting hints. All numeric formatting uses the fixed de-DE locale. */
    format?: {
      /** Minimum fraction digits for numeric types. */
      minFractionDigits?: number;
      /** Maximum fraction digits for numeric types. */
      maxFractionDigits?: number;
      /** ISO currency code when type === "currency", e.g. "EUR". */
      currency?: string;
      /** "number" (default) or "compact" for large numbers. */
      notation?: "number" | "compact";
      /** date-fns-style pattern when type === "date"; value is a ms timestamp. */
      datePattern?: string;
      /**
       * How a `percent` value is scaled. "fraction" (default) treats 0.31 as 31%;
       * "value" treats 31 as 31%. Ignored for non-percent types.
       */
      percentScale?: "fraction" | "value";
    };
    /** Boolean rendering (type === "boolean"). Default renders a check/cross icon. */
    boolean?: {
      /** "icon" (check/cross) or "text". Default "icon". */
      display?: "icon" | "text";
      /** Text shown for true when display === "text". Default "Ja". */
      trueLabel?: string;
      /** Text shown for false when display === "text". Default "Nein". */
      falseLabel?: string;
    };
    /** Enable click-to-sort on this column's header. */
    sortable?: boolean;
    /**
     * Per-column filter control in the header/filter row. Only rendered when the
     * dashboard's `filtering.perColumn` is enabled. Default false.
     */
    filterable?: boolean;
    /** Wrap long cell content to multiple lines. Default false (truncate + hover title). */
    wrap?: boolean;
    /** Initial visibility. User can toggle later via the column menu unless locked. */
    hidden?: boolean;
    /** Prevent the user from hiding/showing this column. */
    lockVisibility?: boolean;
    /** Fixed/preferred width in px. */
    width?: number;
    /** Footer aggregate for this column when `footer.show` is enabled. Default "none". */
    footerAggregate?: "sum" | "avg" | "min" | "max" | "count" | "none";
    /** Databar rendering for numeric columns. */
    dataBar?: {
      enabled: boolean;
      /** Explicit domain; when omitted the module derives it from the column's values. */
      min?: number;
      max?: number;
      /** Include descendant rows when auto-deriving the domain. Default true. */
      includeChildrenInDomain?: boolean;
      /** Bar fill for positive values. */
      positiveColor: string;
      /** Bar fill for negative values (diverging). Defaults to positiveColor. */
      negativeColor?: string;
      /** Also print the formatted value on top of the bar. Default true. */
      showValue: boolean;
      /** Bar corner radius in px. */
      radius?: number;
      /** Bar height as a fraction of the cell (0-1). Default fills the cell. */
      heightRatio?: number;
    };
  }[];

  /** Expandable row hierarchy. */
  hierarchy: {
    enabled: boolean;
    /** Column that hosts the expand chevron + indentation. Defaults to the first column. */
    expandColumnId?: string;
    /** Depth expanded on first render. 0 = only top level. Default 0. */
    defaultExpandedDepth: number;
    /** Indentation per depth level in px. Default 16. */
    indentSize: number;
    /** Show a running aggregate on parent rows for numeric columns. Off by default. */
    showParentAggregates?: boolean;
    /** Aggregation used when showParentAggregates is on. */
    aggregate?: "sum" | "avg" | "min" | "max" | "count";
  };

  /** Column-visibility menu (the "hide" UI). */
  columnMenu: {
    show: boolean;
    /** Menu button label. Default "Spalten". */
    label?: string;
  };

  /** Sorting behavior. With hierarchy enabled, siblings sort within their parent. */
  sorting: {
    enabled: boolean;
    /** Initial sort. */
    defaultSort?: { columnId: string; direction: "asc" | "desc" };
  };

  /** Client-side filtering. Both layers are independent and config-gated. */
  filtering: {
    /** Global quick-search box across all visible columns. Default false. */
    globalSearch: boolean;
    /** Enable per-column filter controls (each column opts in via `filterable`). Default false. */
    perColumn: boolean;
    /** Placeholder for the global search box. Default "Suchen...". */
    searchPlaceholder?: string;
  };

  /** Grand-total footer row (aggregates across all filtered rows). */
  footer: {
    show: boolean;
    /** Label rendered in the first/label column of the footer. Default "Gesamt". */
    label?: string;
  };

  /** Client-side pagination of top-level rows. */
  pagination: {
    enabled: boolean;
    pageSize: number;
  };

  /** Presentation. */
  appearance: {
    density: "comfortable" | "compact";
    stickyHeader: boolean;
    /** Freeze the first column while scrolling horizontally. Default false. */
    stickyFirstColumn: boolean;
    zebraStripes: boolean;
    /** Text shown for null/empty cells. Default "-". */
    emptyPlaceholder?: string;
  };
};
