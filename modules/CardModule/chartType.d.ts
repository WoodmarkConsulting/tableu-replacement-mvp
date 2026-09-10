type CardChartConfig = {
  /**
   * Controls how the numeric value is rendered.
   *
   * "number":   12500
   * "compact":  12.5K
   * "percent":  45%
   * "currency": €12,500
   */
  format: "number" | "compact" | "percent" | "currency";

  /**
   * Number of fraction digits to display.
   * Defaults to 0 when omitted.
   */
  decimals?: number;

  /**
   * ISO currency code used when `format` is "currency".
   * Defaults to "EUR" when omitted.
   */
  currency?: string;

  /**
   * BCP 47 locale used for number formatting.
   * Defaults to "de-DE" when omitted.
   */
  locale?: string;

  /**
   * Optional text rendered immediately before the value.
   */
  prefix?: string;

  /**
   * Optional text rendered immediately after the value.
   */
  suffix?: string;

  /**
   * Overrides the label coming from the data row.
   * When omitted, the row's `label` is used.
   */
  label?: string;

  /**
   * Horizontal alignment of the label and value.
   * Defaults to "center" when omitted.
   */
  align?: "start" | "center" | "end";
};
