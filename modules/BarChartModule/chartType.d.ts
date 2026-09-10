type BarChartConfig = {
  /**
   * Bar orientation.
   *
   * "vertical":
   *   Categories on the X axis, values on the Y axis (bars stand up).
   *
   * "horizontal":
   *   Categories on the Y axis, values on the X axis (bars lie down).
   *   Recommended for long category labels or many categories.
   */
  orientation: "vertical" | "horizontal";

  /**
   * How multiple series are arranged within each category.
   *
   * "grouped":
   *   Bars sit side by side.
   *
   * "stacked":
   *   Bars are stacked on top of each other.
   *
   * "stacked100":
   *   Bars are stacked and each category is normalized to sum to 100%.
   *
   * "overlay":
   *   Bars share the same slot and overlap using reduced opacity.
   */
  layout: "grouped" | "stacked" | "stacked100" | "overlay";

  /**
   * Category (discrete) axis.
   *
   * Rendered as the X axis when `orientation` is "vertical",
   * and as the Y axis when `orientation` is "horizontal".
   */
  categoryAxis: {
    show: boolean;
    tickLine: boolean;
    axisLine: boolean;
    tickMargin: number;

    /**
     * Rotate tick labels (degrees), e.g. -45 for crowded category axes.
     */
    angle?: number;

    /**
     * Truncate long labels to this many characters, adding an ellipsis.
     */
    maxLabelChars?: number;
  };

  /**
   * Value (measure) axis.
   *
   * Rendered as the Y axis when `orientation` is "vertical",
   * and as the X axis when `orientation` is "horizontal".
   */
  valueAxis: {
    show: boolean;
    tickLine: boolean;
    axisLine: boolean;

    /**
     * Controls how values are displayed.
     *
     * "number":  12500
     * "compact": 12.5K
     * "percent": 45%
     */
    format: "number" | "compact" | "percent";

    /**
     * Pin the value range, or "auto" to let recharts scale automatically.
     */
    domain?: [number, number] | "auto";
  };

  /**
   * Background grid configuration.
   */
  grid: {
    show: boolean;
    horizontal: boolean;
    vertical: boolean;

    /**
     * Optional SVG dash pattern, e.g. "3 3".
     */
    strokeDasharray?: string;
  };

  /**
   * Inline recharts tooltip configuration.
   */
  tooltip: {
    show: boolean;
    cursor: boolean;
  };

  /**
   * Legend configuration.
   */
  legend: {
    show: boolean;
  };

  /**
   * Space around the chart content in pixels.
   */
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };

  /**
   * Bar geometry.
   */
  bars: {
    /**
     * Corner radius applied to each bar.
     */
    radius: number;

    /**
     * Gap between categories (recharts barCategoryGap), e.g. "10%" or 4.
     */
    categoryGap: string | number;

    /**
     * Gap between bars within a category for the "grouped" layout.
     */
    barGap: string | number;
  };

  /**
   * Numeric labels drawn on or near each bar. Off by default.
   */
  valueLabels: {
    show: boolean;
    format: "number" | "compact" | "percent";
    position: "inside" | "outside" | "auto";
  };

  /**
   * Single-series only: color each bar by its category.
   * Ignored when more than one series is configured.
   */
  colorByCategory?: {
    enabled: boolean;

    /**
     * Maps a category to a color.
     * Categories without a mapping fall back to the series fill.
     */
    colors: Record<string, string>;
  };

  /**
   * Conditional bar coloring by value threshold, evaluated per bar.
   * The first matching rule (value >= min and value < max) wins;
   * otherwise the bar falls back to the series fill.
   */
  thresholds?: {
    enabled: boolean;

    /**
     * Which series the thresholds apply to. Defaults to all series.
     */
    seriesIndex?: number;

    rules: {
      min?: number;
      max?: number;
      fill: string;
    }[];
  };

  /**
   * Reorder bars. Omit to keep the API row order.
   */
  sort?: {
    by: "category" | "value";
    direction: "asc" | "desc";

    /**
     * Required when `by` is "value"; selects values[seriesIndex].
     */
    seriesIndex?: number;
  };

  /**
   * One entry per series.
   *
   * The API response contains:
   *
   * {
   *   category: string,
   *   values: [series0, series1, ...]
   * }
   *
   * seriesIndex selects the value from the values array.
   */
  series: {
    /**
     * Zero-based index inside the API response `values` array.
     */
    seriesIndex: number;

    /**
     * Human-readable series name used for tooltip and legend.
     */
    name: string;

    /**
     * Bar fill color, e.g. "var(--chart-1)" or "#2563eb".
     */
    fill: string;

    /**
     * Fill opacity between 0 and 1.
     */
    fillOpacity: number;

    stroke?: string;
    strokeWidth?: number;

    /**
     * Groups bars into a stack for the "stacked" and "stacked100" layouts.
     */
    stackId?: string;
  }[];

  /**
   * Optional target or threshold lines drawn across the value axis.
   */
  referenceLines?: {
    label: string;
    value: number;
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
  }[];

  /**
   * Optional per-category target marker (bullet-chart style).
   * Reads the `target` field from each data row.
   */
  targetBars?: {
    enabled: boolean;

    /**
     * "line": a thin marker line at the target value.
     * "bar":  a thin filled marker at the target value.
     */
    style: "line" | "bar";

    fill: string;

    /**
     * Thickness of the marker in pixels.
     */
    size: number;
  };

  /**
   * Highlight style applied to selected bars.
   */
  selectionStyle?: {
    stroke: string;
    strokeWidth: number;

    /**
     * Dim non-selected bars to this opacity while a selection is active.
     */
    fadeOthersOpacity: number;
  };
};
