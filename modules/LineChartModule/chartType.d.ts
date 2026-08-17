type LineChartConfig = {
  /**
   * Configuration of the X axis.
   *
   * The API must return the X value as a number.
   * For dates, use a Unix timestamp in milliseconds.
   */
  xAxis: {
    show: boolean;
    tickLine: boolean;
    axisLine: boolean;
    tickMargin: number;

    /**
     * Controls how numeric X values are displayed.
     *
     * "number":
     *   Displays the number directly.
     *
     * "date-month-day":
     *   Expects a Unix timestamp in milliseconds.
     *   Example output: "08-16"
     *
     * "date-day-month":
     *   Expects a Unix timestamp in milliseconds.
     *   Example output: "16.08"
     */
    format: "number" | "date-month-day" | "date-day-month";
  };

  /**
   * Configuration of the Y axis.
   */
  yAxis: {
    show: boolean;
    tickLine: boolean;
    axisLine: boolean;

    /**
     * Controls how Y values are displayed.
     *
     * "number":
     *   Example: 12500
     *
     * "compact":
     *   Example: 12.5K
     *
     * "percent":
     *   Example: 45%
     */
    format: "number" | "compact" | "percent";
  };

  /**
   * Background grid configuration.
   */
  grid: {
    show: boolean;
    horizontal: boolean;
    vertical: boolean;

    /**
     * Optional SVG dash pattern.
     * Example: "3 3"
     */
    strokeDasharray?: string;
  };

  /**
   * Tooltip configuration.
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
   * One entry represents one Y series.
   *
   * The API response contains:
   *
   * {
   *   x: number,
   *   y: [series0, series1, series2, ...]
   * }
   *
   * seriesIndex selects the value from the y array.
   *
   * Example:
   * seriesIndex: 0 -> y[0]
   * seriesIndex: 1 -> y[1]
   */
  lines: {
    /**
     * Zero-based index inside the API response y array.
     */
    seriesIndex: number;

    /**
     * Human-readable series name.
     * Used for tooltip and legend.
     */
    name: string;

    /**
     * Shape of the line.
     */
    curve: "linear" | "monotone" | "step" | "stepBefore" | "stepAfter";

    /**
     * Main line color.
     *
     * Examples:
     * "var(--chart-1)"
     * "#2563eb"
     */
    stroke: string;

    /**
     * Line width in pixels.
     */
    strokeWidth: number;

    /**
     * Optional dashed line pattern.
     * Example: "5 5"
     */
    strokeDasharray?: string;

    /**
     * Connect the line across null values.
     */
    connectNulls: boolean;

    /**
     * Normal data point configuration.
     */
    dots: {
      show: boolean;
      radius: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
    };

    /**
     * Data point displayed while hovering.
     */
    activeDot: {
      show: boolean;
      radius: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
    };

    /**
     * Fill the area below the line.
     */
    fill: {
      enabled: boolean;
      color: string;

      /**
       * Value between 0 and 1.
       */
      opacity: number;
    };
  }[];
};
