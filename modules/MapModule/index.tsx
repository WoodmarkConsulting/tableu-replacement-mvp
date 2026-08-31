"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { scaleLinear, scaleSqrt, scaleThreshold } from "d3-scale";
import { geoCentroid } from "d3-geo";
import { CustomProjection } from "@visx/geo";
import { Zoom } from "@visx/zoom";
import { feature } from "topojson-client";
import type { FeatureCollection, Feature, Geometry } from "geojson";

import worldAtlas from "world-atlas/countries-110m.json";

import type { MapChartData } from "./chartDataSchema";

countries.registerLocale(enLocale);

type WorldFeature = Feature<Geometry, { name?: string }>;

type ProjectionPresetName =
  | "mercator"
  | "naturalEarth"
  | "equalEarth"
  | "orthographic";

const PROJECTION_PRESET: Record<
  MapChartConfig["projection"]["type"],
  ProjectionPresetName
> = {
  geoMercator: "mercator",
  geoNaturalEarth1: "naturalEarth",
  geoEqualEarth: "equalEarth",
  geoOrthographic: "orthographic",
};

type Props = ChartWrapperInjectedProps<MapChartData, MapChartConfig>;

type TooltipState = {
  title: string;
  value: number;
  x: number;
  y: number;
};

function getRegionValueMap(chartData: MapChartData[]) {
  const regionValues = new Map<string, number>();

  for (const entry of chartData) {
    if (entry.kind !== "region") {
      continue;
    }

    const code = entry.regionCode.toUpperCase();
    const numericValue = Number(entry.value);

    if (!Number.isFinite(numericValue)) {
      continue;
    }

    regionValues.set(code, numericValue);
  }

  return regionValues;
}

function getColorForScale(
  value: number,
  min: number,
  max: number,
  minColor: string,
  maxColor: string,
): string {
  if (!Number.isFinite(value) || min === max) {
    return minColor;
  }

  const colorScale = scaleLinear<string, string>()
    .domain([min, max])
    .range([minColor, maxColor])
    .clamp(true);

  return colorScale(value) ?? minColor;
}

function getBucketColor(
  value: number,
  colorScale: MapChartConfig["choropleth"]["colorScale"],
  noDataColor: string,
): string {
  if (colorScale.type !== "buckets" || !colorScale.buckets?.length) {
    return noDataColor;
  }

  const thresholds = colorScale.buckets.map((bucket) => bucket.threshold);
  const colors = colorScale.buckets.map((bucket) => bucket.color);
  const thresholdScale = scaleThreshold<number, string>()
    .domain(thresholds)
    .range([noDataColor, ...colors]);

  return thresholdScale(value) ?? noDataColor;
}

function getLegendPosition(position: MapChartConfig["legend"]["position"]) {
  switch (position) {
    case "bottom-left":
      return "left-3 bottom-3";
    case "bottom-right":
      return "right-3 bottom-3";
    case "top-left":
      return "left-3 top-3";
    case "top-right":
    default:
      return "right-3 top-3";
  }
}

function MapLegend({
  colorScale,
  bubbleConfig,
  regionValues,
  bubbleValues,
  position,
  noDataColor,
}: {
  colorScale: MapChartConfig["choropleth"]["colorScale"] | null;
  bubbleConfig: MapChartConfig["bubbles"] | null;
  regionValues: number[];
  bubbleValues: number[];
  position: MapChartConfig["legend"]["position"];
  noDataColor: string;
}) {
  const minRegionValue = regionValues.length > 0 ? Math.min(...regionValues) : 0;
  const maxRegionValue = regionValues.length > 0 ? Math.max(...regionValues) : 1;
  const minBubbleValue = bubbleValues.length > 0 ? Math.min(...bubbleValues) : 0;
  const maxBubbleValue = bubbleValues.length > 0 ? Math.max(...bubbleValues) : 1;

  const gradientColors =
    colorScale && colorScale.type === "gradient"
      ? [
          colorScale.gradient?.minColor ?? "#e2e8f0",
          colorScale.gradient?.maxColor ?? "#2563eb",
        ]
      : ["#e2e8f0", "#2563eb"];

  return (
    <div
      className={`absolute z-10 rounded-md border border-slate-200 bg-white/90 p-2 text-xs text-slate-700 shadow-sm backdrop-blur-sm ${getLegendPosition(position)}`}>
      {colorScale && colorScale.type === "gradient" && (
        <div className="mb-2">
          <div className="mb-1 font-medium">Value</div>
          <div
            className="h-2 rounded-full"
            style={{
              width: 112,
              background: `linear-gradient(90deg, ${gradientColors[0]}, ${gradientColors[1]})`,
            }}
          />
          <div className="mt-1 flex w-28 justify-between">
            <span>{minRegionValue}</span>
            <span>{maxRegionValue}</span>
          </div>
        </div>
      )}

      {colorScale && colorScale.type === "buckets" && (
        <div className="mb-2">
          <div className="mb-1 font-medium">Value</div>
          <div className="flex flex-col gap-1">
            {(colorScale.buckets ?? []).map((bucket, index) => (
              <div key={`${bucket.threshold}-${index}`} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: bucket.color }}
                />
                <span>
                  {`\u2265${bucket.threshold}`}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: noDataColor }}
              />
              <span>No data</span>
            </div>
          </div>
        </div>
      )}

      {bubbleConfig?.enabled && (
        <div>
          <div className="mb-1 font-medium">Bubble size</div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block rounded-full bg-slate-400"
              style={{
                width: `${Math.max(6, bubbleConfig.radius.min * 0.9)}px`,
                height: `${Math.max(6, bubbleConfig.radius.min * 0.9)}px`,
              }}
            />
            <span
              className="inline-block rounded-full bg-slate-500"
              style={{
                width: `${bubbleConfig.radius.max}px`,
                height: `${bubbleConfig.radius.max}px`,
              }}
            />
            <span className="text-[10px] text-slate-500">
              {minBubbleValue} - {maxBubbleValue}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function MapModule(props: Props) {
  const { chartConfig: config, chartData, height, onSelectionChange } = props;
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const selectionEnabled = typeof onSelectionChange === "function";

  const handleRegionSelect = (code: string | null | undefined) => {
    if (!onSelectionChange || !code) {
      return;
    }

    const upper = code.toUpperCase();
    const rows = chartData.filter(
      (entry) =>
        entry.kind === "region" && entry.regionCode.toUpperCase() === upper,
    );

    if (rows.length > 0) {
      onSelectionChange(rows);
    }
  };

  const handlePointSelect = (
    entry: Extract<MapChartData, { kind: "point" }>,
  ) => {
    if (!onSelectionChange) {
      return;
    }

    onSelectionChange([entry]);
  };

  const regionValues = useMemo(() => getRegionValueMap(chartData), [chartData]);
  const regionValueList = useMemo(() => [...regionValues.values()], [regionValues]);

  const pointRows = useMemo(
    () =>
      chartData.filter(
        (entry): entry is Extract<MapChartData, { kind: "point" }> =>
          entry.kind === "point",
      ),
    [chartData],
  );

  const pointValues = useMemo(
    () => pointRows.map((entry) => entry.value),
    [pointRows],
  );

  const choroplethScale = useMemo(() => {
    if (!config.choropleth.enabled) {
      return null;
    }

    if (config.choropleth.colorScale.type === "gradient") {
      const gradient = config.choropleth.colorScale.gradient;

      if (!gradient) {
        return null;
      }

      const min = regionValueList.length > 0 ? Math.min(...regionValueList) : 0;
      const max = regionValueList.length > 0 ? Math.max(...regionValueList) : 1;

      return (value: number) =>
        getColorForScale(value, min, max, gradient.minColor, gradient.maxColor);
    }

    if (config.choropleth.colorScale.type === "buckets") {
      return (value: number) =>
        getBucketColor(value, config.choropleth.colorScale, config.choropleth.noDataColor);
    }

    return null;
  }, [config, regionValueList]);

  const bubbleRadiusScale = useMemo(() => {
    if (!config.bubbles.enabled || pointValues.length === 0) {
      return null;
    }

    const min = Math.min(...pointValues);
    const max = Math.max(...pointValues);

    if (min === max) {
      return () => config.bubbles.radius.max;
    }

    return scaleSqrt<number, number>()
      .domain([min, max])
      .range([config.bubbles.radius.min, config.bubbles.radius.max])
      .clamp(true);
  }, [config, pointValues]);

  const bubbleColorScale = useMemo(() => {
    if (!config.bubbles.enabled || config.bubbles.color.mode !== "value") {
      return null;
    }

    if (pointValues.length === 0) {
      return null;
    }

    const min = Math.min(...pointValues);
    const max = Math.max(...pointValues);

    const gradient = config.bubbles.color.gradient;
    if (!gradient) {
      return () => config.bubbles.color.fixedColor ?? "#3b82f6";
    }

    return (value: number) =>
      getColorForScale(value, min, max, gradient.minColor, gradient.maxColor);
  }, [config, pointValues]);

  const [fetchedGeo, setFetchedGeo] = useState<unknown>(null);

  useEffect(() => {
    const url = config.geography.url;
    if (!url) {
      return;
    }

    let active = true;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (active) {
          setFetchedGeo(data);
        }
      })
      .catch(() => {
        if (active) {
          setFetchedGeo(null);
        }
      });

    return () => {
      active = false;
    };
  }, [config.geography.url]);

  const geoFeatures = useMemo<WorldFeature[]>(() => {
    const geoData = config.geography.url ? fetchedGeo : worldAtlas;
    if (!geoData) {
      return [];
    }

    const topology = geoData as { objects: Record<string, object> };
    const object =
      topology.objects.countries ?? Object.values(topology.objects)[0];

    if (!object) {
      return [];
    }

    const collection = feature(
      topology as Parameters<typeof feature>[0],
      object as Parameters<typeof feature>[1],
    ) as unknown as FeatureCollection<Geometry, { name?: string }>;

    return collection.features ?? [];
  }, [config.geography.url, fetchedGeo]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const update = () =>
      setSize({ width: element.clientWidth, height: element.clientHeight });

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const handleTooltip = (
    event: React.MouseEvent<SVGPathElement | SVGCircleElement>,
    title: string,
    value: number,
  ) => {
    if (!config.tooltip.show) {
      return;
    }

    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();

    setTooltip({
      title,
      value,
      x: bounds ? event.clientX - bounds.left : 20,
      y: bounds ? event.clientY - bounds.top : 20,
    });
  };

  const renderMapBody = () => (
    <CustomProjection<WorldFeature>
      data={geoFeatures}
      projection={PROJECTION_PRESET[config.projection.type]}
      scale={config.projection.scale}
      center={config.projection.center}
      translate={[size.width / 2, size.height / 2]}
    >
      {({ features, projection }) => (
        <>
          <g>
            {features.map(({ feature: geo, path, index }) => {
              const featureId = geo.id?.toString() ?? "";
              const paddedId = featureId ? featureId.padStart(3, "0") : "";
              const normalized = paddedId
                ? countries.numericToAlpha2(paddedId)
                : null;
              const regionValue = normalized
                ? regionValues.get(normalized.toUpperCase())
                : undefined;

              const fill =
                regionValue !== undefined && config.choropleth.enabled
                  ? choroplethScale?.(regionValue) ??
                    config.choropleth.noDataColor
                  : config.choropleth.enabled
                    ? config.choropleth.noDataColor
                    : config.geography.defaultFill;

              const title =
                normalized ?? geo.properties?.name ?? "Unknown region";

              const showLabel =
                config.regionLabels.show && regionValue !== undefined;
              const centroid = showLabel
                ? (geoCentroid(geo as never) as [number, number])
                : null;
              const projectedCentroid = centroid
                ? projection(centroid)
                : null;

              return (
                <Fragment key={`${featureId}-${index}`}>
                  <path
                    d={path ?? ""}
                    fill={fill}
                    stroke={config.geography.stroke}
                    strokeWidth={config.geography.strokeWidth}
                    onMouseMove={(event) => {
                      if (regionValue === undefined) {
                        return;
                      }
                      handleTooltip(event, title, regionValue);
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => handleRegionSelect(normalized)}
                    style={{
                      outline: "none",
                      cursor: selectionEnabled ? "pointer" : "default",
                    }}
                  />
                  {showLabel && projectedCentroid && (
                    <text
                      x={projectedCentroid[0]}
                      y={projectedCentroid[1]}
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{
                        pointerEvents: "none",
                        fill: config.regionLabels.color,
                        fontSize: config.regionLabels.fontSize,
                        fontWeight: config.regionLabels.fontWeight,
                      }}
                    >
                      {regionValue}
                    </text>
                  )}
                </Fragment>
              );
            })}
          </g>

          {config.bubbles.enabled &&
            pointRows.map((entry) => {
              const projected = projection([entry.lng, entry.lat]);
              if (!projected) {
                return null;
              }

              const radius = bubbleRadiusScale
                ? bubbleRadiusScale(entry.value)
                : config.bubbles.radius.min;
              const bubbleColor =
                config.bubbles.color.mode === "value" && bubbleColorScale
                  ? bubbleColorScale(entry.value)
                  : config.bubbles.color.fixedColor ?? "#3b82f6";

              return (
                <circle
                  key={`${entry.lat}-${entry.lng}-${entry.label ?? "point"}`}
                  cx={projected[0]}
                  cy={projected[1]}
                  r={radius}
                  fill={bubbleColor}
                  fillOpacity={config.bubbles.opacity}
                  stroke={config.bubbles.stroke}
                  strokeWidth={config.bubbles.strokeWidth}
                  onMouseMove={(event) => {
                    handleTooltip(
                      event,
                      entry.label ?? `${entry.lat}, ${entry.lng}`,
                      entry.value,
                    );
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => handlePointSelect(entry)}
                  style={{ cursor: selectionEnabled ? "pointer" : "default" }}
                />
              );
            })}
        </>
      )}
    </CustomProjection>
  );

  const initialZoom = config.zoom.initial > 0 ? config.zoom.initial : 1;
  const canRender = size.width > 0 && size.height > 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50"
      style={{ height: `${height || 15}svh` }}
    >
      {canRender &&
        (config.zoom.enabled ? (
          <Zoom<SVGSVGElement>
            width={size.width}
            height={size.height}
            scaleXMin={config.zoom.min}
            scaleXMax={config.zoom.max}
            scaleYMin={config.zoom.min}
            scaleYMax={config.zoom.max}
            initialTransformMatrix={{
              scaleX: initialZoom,
              scaleY: initialZoom,
              translateX: ((1 - initialZoom) * size.width) / 2,
              translateY: ((1 - initialZoom) * size.height) / 2,
              skewX: 0,
              skewY: 0,
            }}
          >
            {(zoom) => (
              <svg
                ref={zoom.containerRef}
                width={size.width}
                height={size.height}
                className="h-full w-full"
                style={{
                  cursor: zoom.isDragging ? "grabbing" : "grab",
                  touchAction: "none",
                }}
              >
                <g transform={zoom.toString()}>{renderMapBody()}</g>
              </svg>
            )}
          </Zoom>
        ) : (
          <svg
            width={size.width}
            height={size.height}
            className="h-full w-full"
          >
            {renderMapBody()}
          </svg>
        ))}

      {config.tooltip.show && tooltip && (
        <div
          className="pointer-events-none absolute z-20 rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-xs text-slate-700 shadow-sm"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y + 12,
          }}
        >
          <div className="font-medium">{tooltip.title}</div>
          <div>{tooltip.value}</div>
        </div>
      )}

      {config.legend.show && (
        <MapLegend
          colorScale={config.choropleth.enabled ? config.choropleth.colorScale : null}
          bubbleConfig={config.bubbles.enabled ? config.bubbles : null}
          regionValues={regionValueList}
          bubbleValues={pointValues}
          position={config.legend.position}
          noDataColor={config.choropleth.noDataColor}
        />
      )}
    </div>
  );
}

export default MapModule;
