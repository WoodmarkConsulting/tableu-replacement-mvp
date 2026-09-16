type ScatterPlotChartConfig = {
  xAxis?: {
    label?: string;
    format?: "number" | "compact" | "percent";
    decimals?: number;
    suffix?: string;
    tickCount?: number;
    showTicks?: boolean;
    domain?: {
      min?: number;
      max?: number;
    };
  };
  yAxis?: {
    label?: string;
    format?: "number" | "compact" | "percent";
    decimals?: number;
    suffix?: string;
    tickCount?: number;
    showTicks?: boolean;
    domain?: {
      min?: number;
      max?: number;
    };
  };
  pointLimit?: {
    default?: number;
    max?: number;
  };
  points?: {
    shape?: "point" | "circle";
    radiusPixels?: number;
    opacity?: number;
  };
  raster?: {
    dotRadiusPixels?: number;
    opacity?: number;
  };
  grid?: "both" | "x" | "y" | "none";
  hoverTooltip?: boolean;
  legend?:
    | boolean
    | {
        position?: "left" | "center" | "right";
      };
  referenceLines?: {
    axis: "x" | "y";
    value: number;
    label?: string;
    color?: string;
  }[];
  referenceAreas?: {
    axis: "x" | "y";
    from: number;
    to: number;
    label?: string;
    color?: string;
  }[];
  colorMapping?: {
    values: {
      value: number;
      color?: string;
      label?: string;
    }[];
    defaultColor?: string;
  };
};
