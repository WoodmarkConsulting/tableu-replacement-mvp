"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { scaleLinear, scaleSqrt, scaleThreshold } from "d3-scale";
import { geoCentroid } from "d3-geo";
import { CustomProjection } from "@visx/geo";
import { Zoom } from "@visx/zoom";
import { feature } from "topojson-client";
import type { FeatureCollection, Feature, Geometry } from "geojson";

import type { MapChartData } from "./chartDataSchema";

countries.registerLocale(enLocale);

// Fallback map height (in svh) used when the wrapper does not provide one.
const MAP_HEIGHT_FALLBACK = 15;

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

function formatValue(value: number): string {
  return Number.isFinite(value) ? numberFormatter.format(value) : "\u2014";
}

function minMax(values: number[]): [number, number] {
  if (values.length === 0) {
    return [0, 1];
  }

  let min = values[0];
  let max = values[0];

  for (const value of values) {
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  return [min, max];
}

function rowKey(entry: MapChartData): string {
  return entry.kind === "region"
    ? `region:${entry.regionCode}`
    : `point:${entry.lat},${entry.lng}`;
}

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

type RegionEntry = { value: number; label?: string };

function getRegionValueMap(chartData: MapChartData[]) {
  const regionValues = new Map<string, RegionEntry>();

  for (const entry of chartData) {
    if (entry.kind !== "region") {
      continue;
    }

    const numericValue = Number(entry.value);

    if (!Number.isFinite(numericValue)) {
      continue;
    }

    // Duplicate region codes are aggregated (summed) rather than overwritten.
    const existing = regionValues.get(entry.regionCode);

    regionValues.set(entry.regionCode, {
      value: (existing?.value ?? 0) + numericValue,
      label: entry.label ?? existing?.label,
    });
  }

  return regionValues;
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
  regionMin,
  regionMax,
  bubbleMin,
  bubbleMax,
  hasRegionValues,
  hasBubbleValues,
  position,
  noDataColor,
}: {
  colorScale: MapChartConfig["choropleth"]["colorScale"] | null;
  bubbleConfig: MapChartConfig["bubbles"] | null;
  regionMin: number;
  regionMax: number;
  bubbleMin: number;
  bubbleMax: number;
  hasRegionValues: boolean;
  hasBubbleValues: boolean;
  position: MapChartConfig["legend"]["position"];
  noDataColor: string;
}) {
  const gradientColors =
    colorScale && colorScale.type === "gradient"
      ? [
          colorScale.gradient?.minColor ?? "#e2e8f0",
          colorScale.gradient?.maxColor ?? "#2563eb",
        ]
      : ["#e2e8f0", "#2563eb"];

  // In "fixed" mode the bubble color carries no value information, so the
  // legend shows a single representative swatch instead of a fake gradient.
  const bubbleGradient =
    bubbleConfig?.color.mode === "value" ? bubbleConfig.color.gradient : undefined;
  const bubbleFixedColor = bubbleConfig?.color.fixedColor ?? "#3b82f6";
  const bubbleIsGradient = Boolean(bubbleGradient);
  const bubbleMinColor = bubbleGradient?.minColor ?? bubbleFixedColor;
  const bubbleMaxColor = bubbleGradient?.maxColor ?? bubbleFixedColor;

  return (
    <div
      className={`absolute z-10 rounded-md border border-slate-200 bg-white/90 p-2 text-xs text-slate-700 shadow-sm backdrop-blur-sm ${getLegendPosition(position)}`}>
      {colorScale && colorScale.type === "gradient" && hasRegionValues && (
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
            <span>{formatValue(regionMin)}</span>
            <span>{formatValue(regionMax)}</span>
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
                  {`\u2265${formatValue(bucket.threshold)}`}
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

      {bubbleConfig?.enabled && hasBubbleValues && (
        <div>
          <div className="mb-1 font-medium">Bubble value</div>
          {bubbleIsGradient ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-block rounded-full"
                style={{
                  width: `${Math.max(6, bubbleConfig.radius.min * 0.9)}px`,
                  height: `${Math.max(6, bubbleConfig.radius.min * 0.9)}px`,
                  backgroundColor: bubbleMinColor,
                }}
              />
              <span
                className="inline-block rounded-full"
                style={{
                  width: `${bubbleConfig.radius.max}px`,
                  height: `${bubbleConfig.radius.max}px`,
                  backgroundColor: bubbleMaxColor,
                }}
              />
              <span className="text-[10px] text-slate-500">
                {formatValue(bubbleMin)} - {formatValue(bubbleMax)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className="inline-block rounded-full"
                style={{
                  width: `${bubbleConfig.radius.max}px`,
                  height: `${bubbleConfig.radius.max}px`,
                  backgroundColor: bubbleFixedColor,
                }}
              />
              <span className="text-[10px] text-slate-500">
                {formatValue(bubbleMin)} - {formatValue(bubbleMax)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MapModule(props: Props) {
  const {
    chartConfig: config,
    chartData,
    height,
    onSelectionChange,
    selectedRows,
  } = props;
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const selectionEnabled = typeof onSelectionChange === "function";

  // Selection is owned by the framework and injected via `selectedRows`; clicks
  // toggle rows through the wrapper (additive), mirroring the lasso flow.
  const selectedKeys = useMemo(
    () => new Set(selectedRows.map(rowKey)),
    [selectedRows],
  );

  const handleRegionSelect = (code: string | null | undefined) => {
    if (!onSelectionChange || !code) {
      return;
    }

    const regionCode = code.toUpperCase();
    // Toggle every region row sharing this code, matching how the line chart
    // selects all rows at a clicked x value.
    const rows = chartData.filter(
      (entry) => entry.kind === "region" && entry.regionCode === regionCode,
    );

    if (rows.length > 0) {
      onSelectionChange(rows, { additive: true });
    }
  };

  const handlePointSelect = (
    entry: Extract<MapChartData, { kind: "point" }>,
  ) => {
    onSelectionChange?.([entry], { additive: true });
  };

  const regionValues = useMemo(() => getRegionValueMap(chartData), [chartData]);
  const regionValueList = useMemo(
    () => [...regionValues.values()].map((entry) => entry.value),
    [regionValues],
  );
  const [regionMin, regionMax] = useMemo(
    () => minMax(regionValueList),
    [regionValueList],
  );

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
  const [pointMin, pointMax] = useMemo(
    () => minMax(pointValues),
    [pointValues],
  );

  const choroplethScale = useMemo(() => {
    if (!config.choropleth.enabled) {
      return null;
    }

    const colorScale = config.choropleth.colorScale;

    if (colorScale.type === "gradient") {
      const gradient = colorScale.gradient;

      if (!gradient) {
        return null;
      }

      if (regionMin === regionMax) {
        return () => gradient.minColor;
      }

      const scale = scaleLinear<string, string>()
        .domain([regionMin, regionMax])
        .range([gradient.minColor, gradient.maxColor])
        .clamp(true);

      return (value: number) => scale(value) ?? gradient.minColor;
    }

    if (colorScale.type === "buckets" && colorScale.buckets?.length) {
      const thresholds = colorScale.buckets.map((bucket) => bucket.threshold);
      const colors = colorScale.buckets.map((bucket) => bucket.color);

      // The first bucket color also covers everything below the first
      // threshold, so genuine low values are never painted with the no-data
      // color. `noDataColor` is reserved for regions without a data row.
      const scale = scaleThreshold<number, string>()
        .domain(thresholds)
        .range([colors[0], ...colors]);

      return (value: number) => scale(value) ?? config.choropleth.noDataColor;
    }

    return null;
  }, [config.choropleth, regionMin, regionMax]);

  const bubbleRadiusScale = useMemo(() => {
    if (!config.bubbles.enabled || pointRows.length === 0) {
      return null;
    }

    if (pointMin === pointMax) {
      const radius = config.bubbles.radius.max;
      return () => radius;
    }

    const scale = scaleSqrt<number, number>()
      .domain([pointMin, pointMax])
      .range([config.bubbles.radius.min, config.bubbles.radius.max])
      .clamp(true);

    return (value: number) => scale(value);
  }, [
    config.bubbles.enabled,
    config.bubbles.radius.min,
    config.bubbles.radius.max,
    pointMin,
    pointMax,
    pointRows.length,
  ]);

  const bubbleColorScale = useMemo(() => {
    if (
      !config.bubbles.enabled ||
      config.bubbles.color.mode !== "value" ||
      pointRows.length === 0
    ) {
      return null;
    }

    const gradient = config.bubbles.color.gradient;

    if (!gradient) {
      const fixed = config.bubbles.color.fixedColor ?? "#3b82f6";
      return () => fixed;
    }

    if (pointMin === pointMax) {
      return () => gradient.minColor;
    }

    const scale = scaleLinear<string, string>()
      .domain([pointMin, pointMax])
      .range([gradient.minColor, gradient.maxColor])
      .clamp(true);

    return (value: number) => scale(value) ?? gradient.minColor;
  }, [config.bubbles, pointMin, pointMax, pointRows.length]);

  const [defaultAtlas, setDefaultAtlas] = useState<unknown>(null);
  const [fetchedGeo, setFetchedGeo] = useState<unknown>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // The bundled world atlas is loaded lazily so it is only fetched/parsed when
  // no custom geography URL is configured.
  useEffect(() => {
    if (config.geography.url) {
      return;
    }

    let active = true;

    import("world-atlas/countries-110m.json")
      .then((module) => {
        if (active) {
          setDefaultAtlas((module as { default?: unknown }).default ?? module);
        }
      })
      .catch(() => {
        if (active) {
          setGeoError("Failed to load the default map geography.");
        }
      });

    return () => {
      active = false;
    };
  }, [config.geography.url]);

  useEffect(() => {
    const url = config.geography.url;
    if (!url) {
      // No custom URL: the default atlas is used and any previously fetched
      // geography is ignored by `geoResult`, so no state reset is needed.
      return;
    }

    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setFetchedGeo(data);
        setGeoError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setFetchedGeo(null);
        setGeoError("Failed to load the map geography.");
      });

    return () => controller.abort();
  }, [config.geography.url]);

  const geoResult = useMemo<{ features: WorldFeature[]; error: string | null }>(() => {
    const geoData = config.geography.url ? fetchedGeo : defaultAtlas;

    if (!geoData || typeof geoData !== "object") {
      return { features: [], error: null };
    }

    const topology = geoData as { objects?: Record<string, unknown> };

    if (
      !topology.objects ||
      typeof topology.objects !== "object" ||
      Object.keys(topology.objects).length === 0
    ) {
      return {
        features: [],
        error: "Map geography is missing topology objects.",
      };
    }

    const object =
      topology.objects.countries ?? Object.values(topology.objects)[0];

    if (!object) {
      return { features: [], error: "Map geography has no usable object." };
    }

    try {
      const collection = feature(
        topology as Parameters<typeof feature>[0],
        object as Parameters<typeof feature>[1],
      ) as unknown as FeatureCollection<Geometry, { name?: string }>;

      return { features: collection.features ?? [], error: null };
    } catch {
      return { features: [], error: "Failed to parse the map geography." };
    }
  }, [config.geography.url, fetchedGeo, defaultAtlas]);

  const geoFeatures = geoResult.features;
  const displayError = geoError ?? geoResult.error;

  // ISO normalization, region lookup, and geographic centroids are computed
  // once per feature per data change and reused by both the fill and label
  // passes.
  const featureMeta = useMemo(() => {
    const map = new Map<
      WorldFeature,
      {
        alpha2: string | null;
        value?: number;
        label?: string;
        centroid: [number, number];
      }
    >();

    for (const geo of geoFeatures) {
      const featureId = geo.id?.toString() ?? "";
      const paddedId = featureId ? featureId.padStart(3, "0") : "";
      const alpha2 = paddedId
        ? countries.numericToAlpha2(paddedId) ?? null
        : null;
      const region = alpha2 ? regionValues.get(alpha2) : undefined;

      map.set(geo, {
        alpha2,
        value: region?.value,
        label: region?.label,
        centroid: geoCentroid(geo as Parameters<typeof geoCentroid>[0]) as [
          number,
          number,
        ],
      });
    }

    return map;
  }, [geoFeatures, regionValues]);

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
              const meta = featureMeta.get(geo);
              const alpha2 = meta?.alpha2 ?? null;
              const regionValue = meta?.value;
              const isSelected =
                alpha2 !== null && selectedKeys.has(`region:${alpha2}`);

              const fill =
                regionValue !== undefined && config.choropleth.enabled
                  ? choroplethScale?.(regionValue) ??
                    config.choropleth.noDataColor
                  : config.choropleth.enabled
                    ? config.choropleth.noDataColor
                    : config.geography.defaultFill;

              const title =
                meta?.label ??
                alpha2 ??
                geo.properties?.name ??
                "Unknown region";

              const selectable = selectionEnabled && regionValue !== undefined;

              return (
                <path
                  key={`${geo.id?.toString() ?? ""}-${index}`}
                  d={path ?? ""}
                  fill={fill}
                  stroke={isSelected ? "#0f172a" : config.geography.stroke}
                  strokeWidth={
                    isSelected
                      ? Math.max(config.geography.strokeWidth, 1.5)
                      : config.geography.strokeWidth
                  }
                  role={selectable ? "button" : undefined}
                  tabIndex={selectable ? 0 : undefined}
                  aria-label={
                    regionValue !== undefined
                      ? `${title}: ${formatValue(regionValue)}`
                      : title
                  }
                  aria-pressed={selectable ? isSelected : undefined}
                  onMouseMove={(event) => {
                    if (regionValue === undefined) {
                      return;
                    }
                    handleTooltip(event, title, regionValue);
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => handleRegionSelect(alpha2)}
                  onKeyDown={(event) => {
                    if (!selectable) {
                      return;
                    }
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleRegionSelect(alpha2);
                    }
                  }}
                  style={{
                    outline: "none",
                    cursor: selectable ? "pointer" : "default",
                  }}
                />
              );
            })}
          </g>

          {/* Labels render in a second pass so they sit above every country
              fill and are never clipped by a neighboring region's path. */}
          {config.regionLabels.show && (
            <g>
              {features.map(({ feature: geo, index }) => {
                const meta = featureMeta.get(geo);
                const regionValue = meta?.value;

                if (!meta || regionValue === undefined) {
                  return null;
                }

                const projectedCentroid = projection(meta.centroid);

                if (!projectedCentroid) {
                  return null;
                }

                return (
                  <text
                    key={`${geo.id?.toString() ?? ""}-${index}-label`}
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
                    {formatValue(regionValue)}
                  </text>
                );
              })}
            </g>
          )}

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
              const key = rowKey(entry);
              const isSelected = selectedKeys.has(key);
              const title = entry.label ?? `${entry.lat}, ${entry.lng}`;

              return (
                <circle
                  key={key}
                  cx={projected[0]}
                  cy={projected[1]}
                  r={radius}
                  fill={bubbleColor}
                  fillOpacity={config.bubbles.opacity}
                  stroke={isSelected ? "#0f172a" : config.bubbles.stroke}
                  strokeWidth={
                    isSelected
                      ? Math.max(config.bubbles.strokeWidth, 2)
                      : config.bubbles.strokeWidth
                  }
                  role={selectionEnabled ? "button" : undefined}
                  tabIndex={selectionEnabled ? 0 : undefined}
                  aria-label={`${title}: ${formatValue(entry.value)}`}
                  aria-pressed={selectionEnabled ? isSelected : undefined}
                  onMouseMove={(event) => {
                    handleTooltip(event, title, entry.value);
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => handlePointSelect(entry)}
                  onKeyDown={(event) => {
                    if (!selectionEnabled) {
                      return;
                    }
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handlePointSelect(entry);
                    }
                  }}
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
      style={{ height: `${height || MAP_HEIGHT_FALLBACK}svh` }}
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
                role="group"
                aria-label="Geographic map"
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
            role="group"
            aria-label="Geographic map"
          >
            {renderMapBody()}
          </svg>
        ))}

      {displayError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-white/90 px-3 py-2 text-xs text-red-700 shadow-sm"
          >
            {displayError}
          </div>
        </div>
      )}

      {config.tooltip.show && tooltip && (
        <div
          className="pointer-events-none absolute z-20 rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-xs text-slate-700 shadow-sm"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y + 12,
          }}
        >
          <div className="font-medium">{tooltip.title}</div>
          <div>{formatValue(tooltip.value)}</div>
        </div>
      )}

      {config.legend.show && (
        <MapLegend
          colorScale={config.choropleth.enabled ? config.choropleth.colorScale : null}
          bubbleConfig={config.bubbles.enabled ? config.bubbles : null}
          regionMin={regionMin}
          regionMax={regionMax}
          bubbleMin={pointMin}
          bubbleMax={pointMax}
          hasRegionValues={regionValueList.length > 0}
          hasBubbleValues={pointValues.length > 0}
          position={config.legend.position}
          noDataColor={config.choropleth.noDataColor}
        />
      )}
    </div>
  );
}

export default MapModule;
