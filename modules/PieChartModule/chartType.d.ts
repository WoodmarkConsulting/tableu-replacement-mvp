type PieChartConfig = {
  pie: {
    innerRadius?: number | string;
    outerRadius?: number | string;
    paddingAngle?: number;
    cornerRadius?: number;
    cx?: number | string;
    cy?: number | string;
  };
  margin: { top: number; right: number; bottom: number; left: number };
  tooltip: { show: boolean; cursor: boolean };
  legend: {
    show: boolean;
    position: "top" | "bottom" | "left" | "right";
    content: "name" | "name-value" | "name-percent";
  };
  colors: {
    palette?: string[];
    byName?: Record<string, string>;
    stroke?: string;
    strokeWidth?: number;
  };
  labels: {
    show: boolean;
    position: "inside" | "outside";
    content: "name" | "value" | "percent" | "name-percent" | "name-value";
    leaderLines?: boolean;
    minPercent?: number;
    maxLabelChars?: number;
    numberFormat?: {
      format: "number" | "compact" | "percent" | "currency";
      decimals?: number;
      currency?: string;
      locale?: string;
      prefix?: string;
      suffix?: string;
      useGrouping?: boolean;
    };
  };
  centerLabel?: {
    show: boolean;
    mode: "total" | "selected" | "custom";
    label?: string;
    value?: string;
    numberFormat?: {
      format: "number" | "compact" | "percent" | "currency";
      decimals?: number;
      currency?: string;
      locale?: string;
      prefix?: string;
      suffix?: string;
    };
  };
  groupOthers?: {
    enabled: boolean;
    mode: "topN" | "threshold";
    value: number;
    label?: string;
    color?: string;
  };
  sort?: {
    by: "value" | "name" | "none";
    direction: "asc" | "desc";
  };
  maxSlices?: number;
  selectionStyle?: {
    fadeOthersOpacity: number;
    stroke?: string;
    strokeWidth?: number;
  };
};