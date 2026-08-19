declare module "react-simple-maps" {
  import type * as React from "react";

  type GeographyLike = {
    id?: string | number;
    rsmKey?: string;
    properties?: {
      name?: string;
    };
  };

  type GeographiesArgs = {
    geographies: GeographyLike[];
  };

  export const ComposableMap: React.ComponentType<{
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    className?: string;
    children?: React.ReactNode;
  }>;

  export const Geographies: React.ComponentType<{
    geography: unknown;
    children?: (args: GeographiesArgs) => React.ReactNode;
  }>;

  export const Geography: React.ComponentType<{
    geography: GeographyLike;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    onMouseMove?: (event: React.MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: () => void;
    style?: Record<string, unknown>;
    [key: string]: unknown;
  }>;

  export const Marker: React.ComponentType<{
    coordinates: [number, number];
    children?: React.ReactNode;
  }>;

  export const ZoomableGroup: React.ComponentType<{
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    children?: React.ReactNode;
  }>;
}
