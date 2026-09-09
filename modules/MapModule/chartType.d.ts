type MapChartConfig = {
  projection: {
    type:
      | "geoEqualEarth"
      | "geoMercator"
      | "geoNaturalEarth1"
      | "geoOrthographic";
    center: [number, number];
    scale: number;
  };
  zoom: {
    enabled: boolean;
    min: number;
    max: number;
    initial: number;
  };
  geography: {
    url?: string;
    stroke: string;
    strokeWidth: number;
    defaultFill: string;
  };
  choropleth: {
    enabled: boolean;
    colorScale: {
      type: "gradient" | "buckets";
      gradient?: {
        minColor: string;
        maxColor: string;
      };
      buckets?: {
        threshold: number;
        color: string;
      }[];
    };
    noDataColor: string;
  };
  bubbles: {
    enabled: boolean;
    radius: {
      min: number;
      max: number;
    };
    color: {
      mode: "fixed" | "value";
      fixedColor?: string;
      gradient?: {
        minColor: string;
        maxColor: string;
      };
    };
    stroke: string;
    strokeWidth: number;
    opacity: number;
  };
  tooltip: {
    show: boolean;
  };
  regionLabels: {
    show: boolean;
    color: string;
    fontSize: number;
    fontWeight?: number | string;
    // Exponent (0–1) controlling how much labels grow with zoom. 0 keeps a
    // constant on-screen size, 1 scales linearly with zoom. Defaults to 0.5.
    zoomScaleFactor?: number;
  };
  legend: {
    show: boolean;
    position: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  };
};
