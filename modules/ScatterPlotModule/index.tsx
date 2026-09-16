"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  COORDINATE_SYSTEM,
  OrthographicController,
  OrthographicView,
  OrthographicViewport,
  type OrthographicViewState,
  type PickingInfo,
} from "@deck.gl/core";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import useTooltipStore from "@/stores/tooltip";
import type { ChartQueryValue } from "@/app/api/utils/types";

import type { ScatterPlotData } from "./chartDataSchema";
import { SCATTER_POINT_PALETTE } from "./colors";
import { shouldHandleScatterControllerEvent } from "./scatterInteraction";
import {
  fetchScatterData,
  type ScatterBounds,
  type ScatterPointsResponse,
  type ScatterResponse,
} from "./scatterTransport";

type Props = ChartWrapperInjectedProps<ScatterPlotData, ScatterPlotChartConfig>;

type PlotSize = {
  width: number;
  height: number;
};

type DataBounds = ScatterBounds;

type RgbaColor = [number, number, number, number];
type AxisConfig = NonNullable<ScatterPlotChartConfig["xAxis"]>;

const MAX_POINT_LIMIT = 5_000_000;
const MAX_VIEW_HISTORY = 50;
const WHEEL_STEP_DELAY_MS = 250;
const EMPTY_COLOR_VALUES: number[] = [];
const GERMAN_INTEGER_FORMATTER = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});

type MiddlePanState = {
  pointerId: number;
  recorded: boolean;
  start: LassoPoint;
  viewState: OrthographicViewState;
};

type LoadedPointCoverage = {
  bounds: DataBounds;
  key: string;
  response: ScatterPointsResponse;
};

const ORTHOGRAPHIC_VIEW = new OrthographicView({
  id: "scatter-plot",
  flipY: false,
});

class CtrlWheelOrthographicController extends OrthographicController {
  override handleEvent(
    event: Parameters<OrthographicController["handleEvent"]>[0],
  ): boolean {
    return shouldHandleScatterControllerEvent(event)
      ? super.handleEvent(event)
      : false;
  }
}

const WHEEL_ZOOM_CONTROLLER = {
  type: CtrlWheelOrthographicController,
  scrollZoom: true,
  dragPan: false,
  dragRotate: false,
  doubleClickZoom: false,
  doubleClickDragZoom: false,
  touchZoom: false,
  keyboard: false,
} as const;
const DEFAULT_COLOR: RgbaColor = [37, 99, 235, 255];
const SELECTION_COLOR: RgbaColor = [245, 158, 11, 255];
const CIRCLE_LINE_WIDTH_PIXELS = 1;

function getDataBounds(data: readonly ScatterPlotData[]): DataBounds | null {
  if (data.length === 0) {
    return null;
  }

  let xMin = data[0].x;
  let xMax = data[0].x;
  let yMin = data[0].y;
  let yMax = data[0].y;

  for (const point of data) {
    xMin = Math.min(xMin, point.x);
    xMax = Math.max(xMax, point.x);
    yMin = Math.min(yMin, point.y);
    yMax = Math.max(yMax, point.y);
  }

  if (xMin === xMax) {
    xMin -= 0.5;
    xMax += 0.5;
  }

  if (yMin === yMax) {
    yMin -= 0.5;
    yMax += 0.5;
  }

  return { xMin, xMax, yMin, yMax };
}

function applyConfiguredDomain(
  bounds: DataBounds,
  xAxis: AxisConfig | undefined,
  yAxis: AxisConfig | undefined,
): DataBounds {
  const configured = {
    xMin: xAxis?.domain?.min ?? bounds.xMin,
    xMax: xAxis?.domain?.max ?? bounds.xMax,
    yMin: yAxis?.domain?.min ?? bounds.yMin,
    yMax: yAxis?.domain?.max ?? bounds.yMax,
  };

  return {
    xMin: configured.xMin < configured.xMax ? configured.xMin : bounds.xMin,
    xMax: configured.xMin < configured.xMax ? configured.xMax : bounds.xMax,
    yMin: configured.yMin < configured.yMax ? configured.yMin : bounds.yMin,
    yMax: configured.yMin < configured.yMax ? configured.yMax : bounds.yMax,
  };
}

function getExplicitDomainBounds(
  xAxis: AxisConfig | undefined,
  yAxis: AxisConfig | undefined,
): DataBounds | null {
  const xMin = xAxis?.domain?.min;
  const xMax = xAxis?.domain?.max;
  const yMin = yAxis?.domain?.min;
  const yMax = yAxis?.domain?.max;

  if (
    !Number.isFinite(xMin) ||
    !Number.isFinite(xMax) ||
    !Number.isFinite(yMin) ||
    !Number.isFinite(yMax) ||
    xMin! >= xMax! ||
    yMin! >= yMax!
  ) {
    return null;
  }

  return { xMin: xMin!, xMax: xMax!, yMin: yMin!, yMax: yMax! };
}

function boundsAreEqual(first: DataBounds, second: DataBounds) {
  return (
    first.xMin === second.xMin &&
    first.xMax === second.xMax &&
    first.yMin === second.yMin &&
    first.yMax === second.yMax
  );
}

function boundsContain(container: DataBounds, target: DataBounds) {
  const xTolerance = Math.max(container.xMax - container.xMin, 1) * 1e-6;
  const yTolerance = Math.max(container.yMax - container.yMin, 1) * 1e-6;

  return (
    target.xMin >= container.xMin - xTolerance &&
    target.xMax <= container.xMax + xTolerance &&
    target.yMin >= container.yMin - yTolerance &&
    target.yMax <= container.yMax + yTolerance
  );
}

function countPointsInBounds(
  response: ScatterPointsResponse,
  bounds: DataBounds,
) {
  let count = 0;

  for (let index = 0; index < response.pointCount; index += 1) {
    const x = response.positions[index * 2];
    const y = response.positions[index * 2 + 1];

    if (
      x >= bounds.xMin &&
      x <= bounds.xMax &&
      y >= bounds.yMin &&
      y <= bounds.yMax
    ) {
      count += 1;
    }
  }

  return count;
}

function fitBounds(
  bounds: DataBounds,
  size: PlotSize,
  paddingPixels = 0,
): OrthographicViewState {
  const xRange = bounds.xMax - bounds.xMin;
  const yRange = bounds.yMax - bounds.yMin;
  const horizontalPadding = Math.min(
    Math.max(paddingPixels, 0),
    Math.max((size.width - 1) / 2, 0),
  );
  const verticalPadding = Math.min(
    Math.max(paddingPixels, 0),
    Math.max((size.height - 1) / 2, 0),
  );
  const usableWidth = Math.max(size.width - horizontalPadding * 2, 1);
  const usableHeight = Math.max(size.height - verticalPadding * 2, 1);

  return {
    target: [bounds.xMin + xRange / 2, bounds.yMin + yRange / 2, 0],
    zoomX: Math.log2(usableWidth / xRange),
    zoomY: Math.log2(usableHeight / yRange),
    minZoom: -30,
    maxZoom: 30,
  };
}

function createViewport(
  viewState: OrthographicViewState,
  size: PlotSize,
): OrthographicViewport {
  return new OrthographicViewport({
    ...viewState,
    id: "scatter-plot",
    width: size.width,
    height: size.height,
    flipY: false,
  });
}

function getViewportBounds(
  viewState: OrthographicViewState,
  size: PlotSize,
): DataBounds {
  const viewport = createViewport(viewState, size);
  const firstCorner = viewport.unproject([0, 0]);
  const secondCorner = viewport.unproject([size.width, size.height]);

  return {
    xMin: Math.min(firstCorner[0], secondCorner[0]),
    xMax: Math.max(firstCorner[0], secondCorner[0]),
    yMin: Math.min(firstCorner[1], secondCorner[1]),
    yMax: Math.max(firstCorner[1], secondCorner[1]),
  };
}

function getZoomLevel(viewState: OrthographicViewState): number {
  if (typeof viewState.zoomX === "number") {
    return viewState.zoomX;
  }

  if (typeof viewState.zoom === "number") {
    return viewState.zoom;
  }

  return Array.isArray(viewState.zoom) ? viewState.zoom[0] : 0;
}

function getTickValues(min: number, max: number, requestedCount: number) {
  const count = Math.min(Math.max(Math.round(requestedCount), 2), 10);
  const roughStep = (max - min) / Math.max(count - 1, 1);

  if (!Number.isFinite(roughStep) || roughStep <= 0) {
    return [];
  }

  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;
  const multiplier =
    normalizedStep <= 1.5
      ? 1
      : normalizedStep <= 3
        ? 2
        : normalizedStep <= 7.5
          ? 5
          : 10;
  const step = multiplier * magnitude;
  const firstTick = Math.ceil(min / step) * step;
  const ticks: number[] = [];

  for (let value = firstTick; value <= max + step * 1e-9; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }

  return ticks;
}

function getAxisPercent(value: number, min: number, max: number) {
  return ((value - min) / (max - min)) * 100;
}

function getRemotePoint(
  response: ScatterPointsResponse,
  index: number,
  colorValues: number[],
): ScatterPlotData | null {
  if (index < 0 || index >= response.pointCount) {
    return null;
  }

  const colorIndex = response.colorIndexes[index];

  return {
    id: response.ids[index],
    x: response.positions[index * 2],
    y: response.positions[index * 2 + 1],
    color:
      colorIndex < colorValues.length ? colorValues[colorIndex] : undefined,
  };
}

function parseColor(value: string | undefined): RgbaColor {
  if (!value) {
    return DEFAULT_COLOR;
  }

  const hex = value.trim().replace(/^#/, "");

  if (!/^[\da-f]{3}([\da-f]{3})?([\da-f]{2})?$/i.test(hex)) {
    return DEFAULT_COLOR;
  }

  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : hex;

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
    normalized.length === 8 ? Number.parseInt(normalized.slice(6, 8), 16) : 255,
  ];
}

function isPointInPolygon(point: LassoPoint, polygon: LassoPoint[]): boolean {
  let isInside = false;

  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex++
  ) {
    const current = polygon[currentIndex];
    const previous = polygon[previousIndex];
    const crossesHorizontalRay =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x;

    if (crossesHorizontalRay) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function shapeContains(shape: LassoShape, point: LassoPoint): boolean {
  if (shape.kind === "polygon") {
    return isPointInPolygon(point, shape.points);
  }

  const minX = Math.min(shape.start.x, shape.end.x);
  const maxX = Math.max(shape.start.x, shape.end.x);
  const minY = Math.min(shape.start.y, shape.end.y);
  const maxY = Math.max(shape.start.y, shape.end.y);

  return (
    point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
  );
}

function formatValue(value: number, axis: AxisConfig | undefined): string {
  const decimals = Math.min(Math.max(axis?.decimals ?? 1, 0), 6);
  const format = axis?.format ?? "compact";
  let formatted: string;

  if (format === "compact") {
    formatted = new Intl.NumberFormat("de-DE", {
      notation: "compact",
      maximumFractionDigits: decimals,
    }).format(value);
  } else if (format === "percent") {
    formatted = new Intl.NumberFormat("de-DE", {
      style: "percent",
      maximumFractionDigits: decimals,
    }).format(value);
  } else {
    formatted = new Intl.NumberFormat("de-DE", {
      maximumFractionDigits: decimals,
    }).format(value);
  }

  return axis?.suffix ? `${formatted} ${axis.suffix}` : formatted;
}

function getLegendAlignmentClass(position: "left" | "center" | "right") {
  switch (position) {
    case "left":
      return "justify-start";
    case "right":
      return "justify-end";
    default:
      return "justify-center";
  }
}

function ScatterPlotModule({
  chartConfig,
  chartData,
  height,
  chartID,
  enhancedTooltip,
  selectedRows,
  onSelectionChange,
  lasso,
  selfFetching,
  filterParams,
}: Props) {
  const plotRef = useRef<HTMLDivElement>(null);
  const fittedDataRef = useRef<readonly ScatterPlotData[] | null>(null);
  const hasFittedRemoteRef = useRef(false);
  const fullRemoteBoundsRef = useRef<DataBounds | null>(null);
  const fetchedFilterKeyRef = useRef<string | null>(null);
  const completedRequestKeyRef = useRef<string | null>(null);
  const viewportFetchEnabledRef = useRef(true);
  const loadedPointCoverageRef = useRef<LoadedPointCoverage | null>(null);
  const selectionChangeRef = useRef(onSelectionChange);
  const middlePanRef = useRef<MiddlePanState | null>(null);
  const viewHistoryRef = useRef<DataBounds[]>([]);
  const wheelHistoryTimerRef = useRef<number | null>(null);
  const zoomChangeRef = useRef(lasso.onZoomChange);
  const [plotSize, setPlotSize] = useState<PlotSize>({ width: 0, height: 0 });
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);
  const [viewState, setViewState] = useState<OrthographicViewState>({
    target: [0, 0, 0],
    zoom: 0,
    minZoom: -30,
    maxZoom: 30,
  });

  const xAxis = chartConfig.xAxis;
  const yAxis = chartConfig.yAxis;
  const pointShape = chartConfig.points?.shape ?? "point";
  const pointRadiusPixels = Math.max(
    chartConfig.points?.radiusPixels ?? 1.5,
    0.1,
  );
  const rasterRadiusPixels = Math.max(
    chartConfig.raster?.dotRadiusPixels ?? 1,
    0.1,
  );
  const fitPaddingPixels = Math.ceil(
    Math.max(pointRadiusPixels + 3, rasterRadiusPixels + 1),
  );
  const pointOpacity = Math.min(
    Math.max(chartConfig.points?.opacity ?? 1, 0),
    1,
  );
  const rasterOpacity = Math.min(
    Math.max(chartConfig.raster?.opacity ?? 0.8, 0),
    1,
  );
  const pointLimitMax = Math.min(
    chartConfig.pointLimit?.max ?? MAX_POINT_LIMIT,
    MAX_POINT_LIMIT,
  );
  const [pointLimit, setPointLimit] = useState(() =>
    Math.min(
      Math.max(chartConfig.pointLimit?.default ?? 500_000, 1),
      pointLimitMax,
    ),
  );
  const [remoteData, setRemoteData] = useState<ScatterResponse | null>(null);
  const [hiddenColorValues, setHiddenColorValues] = useState<Set<number>>(
    () => new Set(),
  );
  const [localVisiblePointCount, setLocalVisiblePointCount] = useState<
    number | null
  >(null);
  const [pointModeBaseZoom, setPointModeBaseZoom] = useState<number | null>(
    null,
  );
  const [remoteStatus, setRemoteStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const isRemoteLoading = selfFetching && remoteStatus === "loading";
  const showTooltipOnClick = useTooltipStore(
    (state) => state.showTooltipOnClick,
  );
  const { onInteractionLockChange } = lasso;

  const clearViewHistory = useCallback(() => {
    viewHistoryRef.current = [];

    if (wheelHistoryTimerRef.current !== null) {
      window.clearTimeout(wheelHistoryTimerRef.current);
      wheelHistoryTimerRef.current = null;
    }
  }, []);

  const pushViewHistory = useCallback((bounds: DataBounds) => {
    const history = viewHistoryRef.current;
    const previous = history.at(-1);

    if (!previous || !boundsAreEqual(previous, bounds)) {
      viewHistoryRef.current = [
        ...history.slice(-(MAX_VIEW_HISTORY - 1)),
        bounds,
      ];
    }

    zoomChangeRef.current(true);
  }, []);

  const filterKey = JSON.stringify(filterParams);
  const stableFilterParams = useMemo(
    () => JSON.parse(filterKey) as Record<string, ChartQueryValue>,
    [filterKey],
  );
  const colorValues = useMemo(
    () =>
      chartConfig.colorMapping?.values
        .slice(0, 255)
        .map((entry) => entry.value) ?? [],
    [chartConfig.colorMapping?.values],
  );
  const colors = useMemo(
    () =>
      chartConfig.colorMapping
        ? [
            ...chartConfig.colorMapping.values
              .slice(0, 255)
              .map(
                (entry, index) =>
                  entry.color ??
                  SCATTER_POINT_PALETTE[index % SCATTER_POINT_PALETTE.length],
              ),
            chartConfig.colorMapping.defaultColor ?? SCATTER_POINT_PALETTE[0],
          ]
        : [SCATTER_POINT_PALETTE[0]],
    [chartConfig.colorMapping],
  );
  const pointCoverageKey = JSON.stringify({
    chartID,
    filterKey,
    pointLimit,
    colorValues,
    colors,
  });
  const dataBounds = useMemo(
    () =>
      selfFetching ? (remoteData?.bounds ?? null) : getDataBounds(chartData),
    [chartData, remoteData, selfFetching],
  );
  const configuredDataBounds = useMemo(
    () => (dataBounds ? applyConfiguredDomain(dataBounds, xAxis, yAxis) : null),
    [dataBounds, xAxis, yAxis],
  );
  const explicitDomainBounds = useMemo(
    () => getExplicitDomainBounds(xAxis, yAxis),
    [xAxis, yAxis],
  );
  const viewportBounds = useMemo(
    () =>
      plotSize.width > 0 && plotSize.height > 0
        ? getViewportBounds(viewState, plotSize)
        : configuredDataBounds,
    [configuredDataBounds, plotSize, viewState],
  );
  const xTicks = useMemo(
    () =>
      viewportBounds && xAxis?.showTicks !== false
        ? getTickValues(
            viewportBounds.xMin,
            viewportBounds.xMax,
            xAxis?.tickCount ?? 5,
          )
        : [],
    [viewportBounds, xAxis?.showTicks, xAxis?.tickCount],
  );
  const yTicks = useMemo(
    () =>
      viewportBounds && yAxis?.showTicks !== false
        ? getTickValues(
            viewportBounds.yMin,
            viewportBounds.yMax,
            yAxis?.tickCount ?? 5,
          )
        : [],
    [viewportBounds, yAxis?.showTicks, yAxis?.tickCount],
  );
  const selectedIDs = useMemo(
    () => new Set(selectedRows.map((point) => point.id)),
    [selectedRows],
  );
  const colorByValue = useMemo(
    () =>
      new Map(
        chartConfig.colorMapping?.values.map((entry, index) => [
          entry.value,
          parseColor(
            entry.color ??
              SCATTER_POINT_PALETTE[index % SCATTER_POINT_PALETTE.length],
          ),
        ]) ?? [],
      ),
    [chartConfig.colorMapping?.values],
  );
  const defaultPointColor = useMemo(
    () =>
      parseColor(
        chartConfig.colorMapping?.defaultColor ?? SCATTER_POINT_PALETTE[0],
      ),
    [chartConfig.colorMapping?.defaultColor],
  );
  const colorLabelsByValue = useMemo(
    () =>
      new Map(
        chartConfig.colorMapping?.values.map((entry) => [
          entry.value,
          entry.label ?? String(entry.value),
        ]) ?? [],
      ),
    [chartConfig.colorMapping?.values],
  );
  const legendItems = useMemo(
    () =>
      chartConfig.colorMapping?.values.map((entry, index) => ({
        value: entry.value,
        color:
          entry.color ??
          SCATTER_POINT_PALETTE[index % SCATTER_POINT_PALETTE.length],
        label: entry.label ?? String(entry.value),
      })) ?? [],
    [chartConfig.colorMapping?.values],
  );
  const showLegend = chartConfig.legend !== false && legendItems.length > 0;
  const sortedHiddenColorValues = useMemo(
    () => Array.from(hiddenColorValues).sort((left, right) => left - right),
    [hiddenColorValues],
  );
  const hiddenColorKey = JSON.stringify(sortedHiddenColorValues);
  const rasterHiddenColorValues =
    remoteData?.mode === "raster"
      ? sortedHiddenColorValues
      : EMPTY_COLOR_VALUES;
  const rasterHiddenColorKey =
    remoteData?.mode === "raster" ? hiddenColorKey : "";
  const legendPosition =
    typeof chartConfig.legend === "object"
      ? (chartConfig.legend.position ?? "center")
      : "center";
  const rasterUrl = useMemo(() => {
    if (remoteData?.mode !== "raster") {
      return null;
    }

    return URL.createObjectURL(
      new Blob([remoteData.png], { type: "image/png" }),
    );
  }, [remoteData]);
  const rasterPlacement = useMemo(() => {
    if (remoteData?.mode !== "raster" || !viewportBounds) {
      return null;
    }

    const xStart = Math.min(
      Math.max(
        getAxisPercent(
          remoteData.bounds.xMin,
          viewportBounds.xMin,
          viewportBounds.xMax,
        ),
        0,
      ),
      100,
    );
    const xEnd = Math.min(
      Math.max(
        getAxisPercent(
          remoteData.bounds.xMax,
          viewportBounds.xMin,
          viewportBounds.xMax,
        ),
        0,
      ),
      100,
    );
    const yStart = Math.min(
      Math.max(
        getAxisPercent(
          remoteData.bounds.yMin,
          viewportBounds.yMin,
          viewportBounds.yMax,
        ),
        0,
      ),
      100,
    );
    const yEnd = Math.min(
      Math.max(
        getAxisPercent(
          remoteData.bounds.yMax,
          viewportBounds.yMin,
          viewportBounds.yMax,
        ),
        0,
      ),
      100,
    );

    return {
      left: `${xStart}%`,
      width: `${Math.max(xEnd - xStart, 0)}%`,
      bottom: `${yStart}%`,
      height: `${Math.max(yEnd - yStart, 0)}%`,
    };
  }, [remoteData, viewportBounds]);

  useEffect(() => {
    selectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    zoomChangeRef.current = lasso.onZoomChange;
  }, [lasso.onZoomChange]);

  useEffect(() => {
    onInteractionLockChange(isRemoteLoading);

    return () => onInteractionLockChange(false);
  }, [isRemoteLoading, onInteractionLockChange]);

  useEffect(
    () => () => {
      clearViewHistory();
    },
    [clearViewHistory],
  );

  useEffect(
    () => () => {
      if (rasterUrl) {
        URL.revokeObjectURL(rasterUrl);
      }
    },
    [rasterUrl],
  );

  useEffect(() => {
    const plot = plotRef.current;

    if (!plot) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.max(Math.floor(entry.contentRect.width), 1);
      const height = Math.max(Math.floor(entry.contentRect.height), 1);

      setPlotSize((currentSize) =>
        currentSize.width === width && currentSize.height === height
          ? currentSize
          : { width, height },
      );
    });

    resizeObserver.observe(plot);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (selfFetching) {
      return;
    }

    if (
      !configuredDataBounds ||
      plotSize.width === 0 ||
      plotSize.height === 0 ||
      fittedDataRef.current === chartData
    ) {
      return;
    }

    fittedDataRef.current = chartData;
    clearViewHistory();
    const initialViewState = fitBounds(
      configuredDataBounds,
      plotSize,
      fitPaddingPixels,
    );

    setPointModeBaseZoom(getZoomLevel(initialViewState));
    setViewState(initialViewState);
  }, [
    chartData,
    clearViewHistory,
    configuredDataBounds,
    fitPaddingPixels,
    plotSize,
    selfFetching,
  ]);

  useEffect(() => {
    if (
      !selfFetching ||
      isMiddlePanning ||
      plotSize.width === 0 ||
      plotSize.height === 0
    ) {
      return;
    }

    const fetchFullExtent = fetchedFilterKeyRef.current !== filterKey;

    if (!fetchFullExtent && !viewportFetchEnabledRef.current) {
      return;
    }

    const currentViewport = getViewportBounds(viewState, plotSize);
    const loadedCoverage = loadedPointCoverageRef.current;

    if (
      loadedCoverage?.key === pointCoverageKey &&
      boundsContain(loadedCoverage.bounds, currentViewport)
    ) {
      viewportFetchEnabledRef.current = false;
      const countTimeout = window.setTimeout(() => {
        setLocalVisiblePointCount(
          countPointsInBounds(loadedCoverage.response, currentViewport),
        );
      }, 300);

      return () => window.clearTimeout(countTimeout);
    }

    const abortController = new AbortController();
    const timeout = window.setTimeout(async () => {
      const requestedViewport = fetchFullExtent
        ? explicitDomainBounds
        : hasFittedRemoteRef.current
          ? currentViewport
          : null;
      const devicePixelRatio = Math.max(window.devicePixelRatio || 1, 1);
      const imageSize = {
        width: plotSize.width * devicePixelRatio,
        height: plotSize.height * devicePixelRatio,
      };
      const requestKey = JSON.stringify({
        pointCoverageKey,
        rasterHiddenColorKey,
        viewport: requestedViewport,
        imageSize,
      });

      if (completedRequestKeyRef.current === requestKey) {
        viewportFetchEnabledRef.current = false;
        return;
      }

      setRemoteStatus("loading");
      setRemoteError(null);
      setLocalVisiblePointCount(null);

      try {
        const response = await fetchScatterData(
          chartID,
          {
            filters: stableFilterParams,
            viewport: requestedViewport,
            pointLimit,
            imageSize,
            colorValues,
            hiddenColorValues: rasterHiddenColorValues,
            colors,
          },
          abortController.signal,
        );
        let responseBaseZoom = getZoomLevel(viewState);

        if (fetchFullExtent && response.totalCount > 0) {
          clearViewHistory();
          fetchedFilterKeyRef.current = filterKey;
          hasFittedRemoteRef.current = true;
          const initialBounds =
            explicitDomainBounds ??
            applyConfiguredDomain(response.bounds, xAxis, yAxis);
          const initialViewState = fitBounds(
            initialBounds,
            plotSize,
            fitPaddingPixels,
          );

          fullRemoteBoundsRef.current = initialBounds;
          responseBaseZoom = getZoomLevel(initialViewState);
          setViewState(initialViewState);
        }

        setPointModeBaseZoom((currentBaseZoom) =>
          response.mode === "points"
            ? fetchFullExtent
              ? responseBaseZoom
              : (currentBaseZoom ?? responseBaseZoom)
            : null,
        );
        loadedPointCoverageRef.current =
          response.mode === "points"
            ? {
                bounds: requestedViewport ?? response.bounds,
                key: pointCoverageKey,
                response,
              }
            : null;
        completedRequestKeyRef.current = requestKey;
        viewportFetchEnabledRef.current = false;
        setRemoteData(response);
        setRemoteStatus("success");
        selectionChangeRef.current?.([]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setRemoteStatus("error");
        setRemoteError(
          error instanceof Error
            ? error.message
            : "Scatterplot konnte nicht geladen werden.",
        );
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [
    chartID,
    clearViewHistory,
    colorValues,
    colors,
    explicitDomainBounds,
    filterKey,
    fitPaddingPixels,
    plotSize,
    pointLimit,
    isMiddlePanning,
    pointCoverageKey,
    rasterHiddenColorKey,
    rasterHiddenColorValues,
    remoteData?.mode,
    selfFetching,
    stableFilterParams,
    viewState,
    xAxis,
    yAxis,
  ]);

  const remotePoints = remoteData?.mode === "points" ? remoteData : null;
  const visibleRemotePoints = useMemo(() => {
    if (!remotePoints || hiddenColorValues.size === 0) {
      return remotePoints;
    }

    const visibleIndexes: number[] = [];

    for (let index = 0; index < remotePoints.pointCount; index += 1) {
      const colorIndex = remotePoints.colorIndexes[index];
      const colorValue = colorValues[colorIndex];

      if (colorValue === undefined || !hiddenColorValues.has(colorValue)) {
        visibleIndexes.push(index);
      }
    }

    const positions = new Float32Array(visibleIndexes.length * 2);
    const ids = new Float64Array(visibleIndexes.length);
    const colorIndexes = new Uint8Array(visibleIndexes.length);

    visibleIndexes.forEach((sourceIndex, targetIndex) => {
      positions[targetIndex * 2] = remotePoints.positions[sourceIndex * 2];
      positions[targetIndex * 2 + 1] =
        remotePoints.positions[sourceIndex * 2 + 1];
      ids[targetIndex] = remotePoints.ids[sourceIndex];
      colorIndexes[targetIndex] = remotePoints.colorIndexes[sourceIndex];
    });

    return {
      ...remotePoints,
      totalCount: visibleIndexes.length,
      pointCount: visibleIndexes.length,
      positions,
      ids,
      colorIndexes,
    };
  }, [colorValues, hiddenColorValues, remotePoints]);
  const visibleChartData = useMemo(
    () =>
      hiddenColorValues.size === 0
        ? chartData
        : chartData.filter(
            (point) =>
              point.color === undefined || !hiddenColorValues.has(point.color),
          ),
    [chartData, hiddenColorValues],
  );
  const visibleSelectedRows = useMemo(
    () =>
      selectedRows.filter(
        (point) =>
          point.color === undefined || !hiddenColorValues.has(point.color),
      ),
    [hiddenColorValues, selectedRows],
  );
  const displayedVisiblePointCount = useMemo(() => {
    if (!selfFetching) {
      return visibleChartData.length;
    }

    if (visibleRemotePoints && viewportBounds) {
      return countPointsInBounds(visibleRemotePoints, viewportBounds);
    }

    return localVisiblePointCount ?? remoteData?.totalCount;
  }, [
    localVisiblePointCount,
    remoteData?.totalCount,
    selfFetching,
    viewportBounds,
    visibleChartData.length,
    visibleRemotePoints,
  ]);
  const pointRadiusScale =
    pointModeBaseZoom === null
      ? 1
      : Math.min(
          Math.max(2 ** (getZoomLevel(viewState) - pointModeBaseZoom), 0.5),
          24,
        );
  const hasAddressablePoints = selfFetching
    ? visibleRemotePoints !== null
    : visibleChartData.length > 0;
  const hasZoomableData = dataBounds !== null;

  const handleMiddlePanStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 1 || lasso.mode !== null) {
        return;
      }

      const bounds = event.currentTarget.getBoundingClientRect();

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      middlePanRef.current = {
        pointerId: event.pointerId,
        recorded: false,
        start: {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        },
        viewState,
      };
      setIsMiddlePanning(true);
    },
    [lasso.mode, viewState],
  );

  const handleMiddlePanMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const pan = middlePanRef.current;

      if (!pan || pan.pointerId !== event.pointerId) {
        return;
      }

      const bounds = event.currentTarget.getBoundingClientRect();
      const viewport = createViewport(pan.viewState, plotSize);
      const startData = viewport.unproject([pan.start.x, pan.start.y]);
      const currentData = viewport.unproject([
        event.clientX - bounds.left,
        event.clientY - bounds.top,
      ]);
      const target = pan.viewState.target ?? [0, 0, 0];

      event.preventDefault();

      if (
        !pan.recorded &&
        (event.clientX - bounds.left !== pan.start.x ||
          event.clientY - bounds.top !== pan.start.y)
      ) {
        if (wheelHistoryTimerRef.current !== null) {
          window.clearTimeout(wheelHistoryTimerRef.current);
          wheelHistoryTimerRef.current = null;
        }

        pushViewHistory(getViewportBounds(pan.viewState, plotSize));
        viewportFetchEnabledRef.current = true;
        pan.recorded = true;
      }

      setViewState({
        ...pan.viewState,
        target: [
          target[0] + startData[0] - currentData[0],
          target[1] + startData[1] - currentData[1],
          target[2] ?? 0,
        ],
      });
    },
    [plotSize, pushViewHistory],
  );

  const handleMiddlePanEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (middlePanRef.current?.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      middlePanRef.current = null;
      setIsMiddlePanning(false);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  const adapterStateRef = useRef({
    chartData: visibleChartData,
    chartID,
    colors,
    colorValues,
    dataBounds,
    filters: stableFilterParams,
    plotSize,
    pointLimit,
    remotePoints: visibleRemotePoints,
    selfFetching,
    viewState,
  });

  useEffect(() => {
    adapterStateRef.current = {
      chartData: visibleChartData,
      chartID,
      colors,
      colorValues,
      dataBounds,
      filters: stableFilterParams,
      plotSize,
      pointLimit,
      remotePoints: visibleRemotePoints,
      selfFetching,
      viewState,
    };
  });

  const { registerAdapter } = lasso;

  useEffect(() => {
    if (!hasZoomableData) {
      registerAdapter(null);
      return;
    }

    const adapter: LassoAdapter<ScatterPlotData> = {
      selectionDisabled: selfFetching && remotePoints === null,
      getPlotBounds: () => {
        const plot = plotRef.current;
        const surface = plot?.closest('[data-slot="context-menu-trigger"]');

        if (!plot || !(surface instanceof HTMLElement)) {
          return null;
        }

        const plotBounds = plot.getBoundingClientRect();
        const surfaceBounds = surface.getBoundingClientRect();

        return {
          x: plotBounds.left - surfaceBounds.left,
          y: plotBounds.top - surfaceBounds.top,
          width: plotBounds.width,
          height: plotBounds.height,
        };
      },
      applyZoom: (shape) => {
        if (shape.kind !== "rectangle") {
          return false;
        }

        const current = adapterStateRef.current;

        if (
          !current.dataBounds ||
          current.plotSize.width === 0 ||
          current.plotSize.height === 0
        ) {
          return false;
        }

        const viewport = createViewport(current.viewState, current.plotSize);
        const start = viewport.unproject([
          shape.start.x * current.plotSize.width,
          shape.start.y * current.plotSize.height,
        ]);
        const end = viewport.unproject([
          shape.end.x * current.plotSize.width,
          shape.end.y * current.plotSize.height,
        ]);
        const nextBounds = {
          xMin: Math.min(start[0], end[0]),
          xMax: Math.max(start[0], end[0]),
          yMin: Math.min(start[1], end[1]),
          yMax: Math.max(start[1], end[1]),
        };

        if (
          nextBounds.xMin === nextBounds.xMax ||
          nextBounds.yMin === nextBounds.yMax
        ) {
          return false;
        }

        if (wheelHistoryTimerRef.current !== null) {
          window.clearTimeout(wheelHistoryTimerRef.current);
          wheelHistoryTimerRef.current = null;
        }

        pushViewHistory(getViewportBounds(current.viewState, current.plotSize));
        viewportFetchEnabledRef.current = true;
        setViewState(fitBounds(nextBounds, current.plotSize));
        return true;
      },
      undoZoom: () => {
        const current = adapterStateRef.current;
        const previousBounds = viewHistoryRef.current.pop();

        if (!previousBounds) {
          return false;
        }

        if (wheelHistoryTimerRef.current !== null) {
          window.clearTimeout(wheelHistoryTimerRef.current);
          wheelHistoryTimerRef.current = null;
        }

        viewportFetchEnabledRef.current = true;
        setViewState(fitBounds(previousBounds, current.plotSize));
        return viewHistoryRef.current.length > 0;
      },
      resetZoom: () => {
        const current = adapterStateRef.current;
        const resetBounds = current.selfFetching
          ? fullRemoteBoundsRef.current
          : current.dataBounds
            ? applyConfiguredDomain(current.dataBounds, xAxis, yAxis)
            : null;

        if (resetBounds) {
          clearViewHistory();
          viewportFetchEnabledRef.current = true;
          setViewState(
            fitBounds(resetBounds, current.plotSize, fitPaddingPixels),
          );
        }
      },
    };

    adapter.select = async (shape) => {
      const current = adapterStateRef.current;

      if (
        current.plotSize.width === 0 ||
        current.plotSize.height === 0 ||
        (current.selfFetching && !current.remotePoints)
      ) {
        return [];
      }

      const viewport = createViewport(current.viewState, current.plotSize);
      const selectionPoints = current.remotePoints;

      const pointCount = current.selfFetching
        ? (selectionPoints?.pointCount ?? 0)
        : current.chartData.length;
      const selected: ScatterPlotData[] = [];

      for (let index = 0; index < pointCount; index += 1) {
        const point = current.selfFetching
          ? selectionPoints
            ? getRemotePoint(selectionPoints, index, current.colorValues)
            : null
          : current.chartData[index];

        if (!point) {
          continue;
        }

        const [pixelX, pixelY] = viewport.project([point.x, point.y]);

        if (
          shapeContains(shape, {
            x: pixelX / current.plotSize.width,
            y: pixelY / current.plotSize.height,
          })
        ) {
          selected.push(point);
        }
      }

      return selected;
    };

    registerAdapter(adapter);

    return () => registerAdapter(null);
  }, [
    clearViewHistory,
    fitPaddingPixels,
    hasAddressablePoints,
    hasZoomableData,
    pushViewHistory,
    registerAdapter,
    remotePoints,
    selfFetching,
    xAxis,
    yAxis,
  ]);

  const handleViewStateChange = useCallback(
    (nextViewState: OrthographicViewState) => {
      viewportFetchEnabledRef.current = true;

      if (
        wheelHistoryTimerRef.current === null &&
        plotSize.width > 0 &&
        plotSize.height > 0
      ) {
        pushViewHistory(getViewportBounds(viewState, plotSize));
      }

      if (wheelHistoryTimerRef.current !== null) {
        window.clearTimeout(wheelHistoryTimerRef.current);
      }

      wheelHistoryTimerRef.current = window.setTimeout(() => {
        wheelHistoryTimerRef.current = null;
      }, WHEEL_STEP_DELAY_MS);
      setViewState(nextViewState);
    },
    [plotSize, pushViewHistory, viewState],
  );

  const handlePointClick = useCallback(
    (point: ScatterPlotData | null, sourceEvent: MouseEvent) => {
      if (!point || lasso.mode !== null) {
        return;
      }

      onSelectionChange?.([point], {
        additive:
          sourceEvent.ctrlKey || sourceEvent.metaKey || sourceEvent.shiftKey,
      });

      if (enhancedTooltip) {
        showTooltipOnClick({
          chartID,
          dataPoint: point,
          position: {
            x: sourceEvent.clientX,
            y: sourceEvent.clientY,
          },
        });
      }
    },
    [
      chartID,
      enhancedTooltip,
      lasso.mode,
      onSelectionChange,
      showTooltipOnClick,
    ],
  );

  const getHoverTooltip = useCallback(
    ({ index, object }: PickingInfo<ScatterPlotData>) => {
      if (chartConfig.hoverTooltip === false || lasso.mode !== null) {
        return null;
      }

      const point = visibleRemotePoints
        ? getRemotePoint(visibleRemotePoints, index, colorValues)
        : object;

      if (!point) {
        return null;
      }

      const lines = [
        `${xAxis?.label ?? "X"}: ${formatValue(point.x, xAxis)}`,
        `${yAxis?.label ?? "Y"}: ${formatValue(point.y, yAxis)}`,
      ];
      const colorLabel = colorLabelsByValue.get(point.color ?? Number.NaN);

      if (colorLabel) {
        lines.push(colorLabel);
      }

      return {
        text: lines.join("\n"),
        style: {
          backgroundColor: "rgba(24, 24, 27, 0.94)",
          borderRadius: "4px",
          color: "#fafafa",
          fontSize: "12px",
          lineHeight: "1.4",
          padding: "6px 8px",
          whiteSpace: "pre-line",
        },
      };
    },
    [
      chartConfig.hoverTooltip,
      colorLabelsByValue,
      colorValues,
      lasso.mode,
      visibleRemotePoints,
      xAxis,
      yAxis,
    ],
  );

  const remoteFillColors = useMemo(() => {
    if (!visibleRemotePoints) {
      return null;
    }

    const values = new Uint8Array(visibleRemotePoints.pointCount * 4);
    const resolvedColors = colors.map((color) => parseColor(color));

    for (let index = 0; index < visibleRemotePoints.pointCount; index += 1) {
      const color =
        resolvedColors[visibleRemotePoints.colorIndexes[index]] ??
        defaultPointColor;

      values.set(color, index * 4);
    }

    return values;
  }, [colors, defaultPointColor, visibleRemotePoints]);

  const layers = useMemo(() => {
    if (selfFetching && remoteData?.mode === "raster") {
      return [];
    }

    const pointLayer =
      visibleRemotePoints && remoteFillColors
        ? new ScatterplotLayer<ScatterPlotData>({
            id: `${chartID}-points`,
            data: {
              length: visibleRemotePoints.pointCount,
              attributes: {
                getPosition: { value: visibleRemotePoints.positions, size: 2 },
                getFillColor: { value: remoteFillColors, size: 4 },
                getLineColor: { value: remoteFillColors, size: 4 },
              },
            },
            coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
            pickable: lasso.mode === null,
            autoHighlight: true,
            highlightColor: SELECTION_COLOR,
            radiusUnits: "pixels",
            radiusScale: pointRadiusScale,
            lineWidthUnits: "pixels",
            lineWidthScale: pointRadiusScale,
            filled: pointShape === "point",
            stroked: pointShape === "circle",
            getRadius: pointRadiusPixels,
            getLineWidth: CIRCLE_LINE_WIDTH_PIXELS,
            opacity: pointOpacity,
            onClick: (info, event) =>
              handlePointClick(
                getRemotePoint(visibleRemotePoints, info.index, colorValues),
                event.srcEvent as MouseEvent,
              ),
          })
        : new ScatterplotLayer<ScatterPlotData>({
            id: `${chartID}-points`,
            data: visibleChartData,
            coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
            pickable: lasso.mode === null,
            autoHighlight: true,
            highlightColor: SELECTION_COLOR,
            radiusUnits: "pixels",
            radiusScale: pointRadiusScale,
            lineWidthUnits: "pixels",
            lineWidthScale: pointShape === "circle" ? pointRadiusScale : 1,
            filled: pointShape === "point",
            stroked: pointShape === "circle" || selectedIDs.size > 0,
            getPosition: (point) => [point.x, point.y, 0],
            getRadius: pointRadiusPixels,
            getFillColor: (point) =>
              colorByValue.get(point.color ?? Number.NaN) ?? defaultPointColor,
            getLineColor: (point) =>
              pointShape === "circle"
                ? (colorByValue.get(point.color ?? Number.NaN) ??
                  defaultPointColor)
                : selectedIDs.has(point.id)
                  ? SELECTION_COLOR
                  : [0, 0, 0, 0],
            getLineWidth: (point) =>
              pointShape === "circle"
                ? CIRCLE_LINE_WIDTH_PIXELS
                : selectedIDs.has(point.id)
                  ? 2
                  : 0,
            opacity: pointOpacity,
            updateTriggers: {
              getFillColor: [colorByValue, defaultPointColor],
              getLineColor: [
                colorByValue,
                defaultPointColor,
                pointShape,
                selectedIDs,
              ],
              getLineWidth: [pointShape, selectedIDs],
            },
            onClick: (info, event) => {
              handlePointClick(
                info.object ?? null,
                event.srcEvent as MouseEvent,
              );
            },
          });

    return [
      pointLayer,
      new ScatterplotLayer<ScatterPlotData>({
        id: `${chartID}-selection`,
        data: visibleSelectedRows,
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        pickable: false,
        radiusUnits: "pixels",
        radiusScale: pointRadiusScale,
        lineWidthUnits: "pixels",
        stroked: true,
        filled: false,
        getPosition: (point) => [point.x, point.y, 0],
        getRadius: pointRadiusPixels + 1,
        getLineColor: SELECTION_COLOR,
        getLineWidth: 2,
      }),
    ];
  }, [
    visibleChartData,
    chartID,
    colorByValue,
    colorValues,
    defaultPointColor,
    handlePointClick,
    lasso.mode,
    pointOpacity,
    pointRadiusPixels,
    pointRadiusScale,
    pointShape,
    remoteData,
    remoteFillColors,
    visibleRemotePoints,
    selectedIDs,
    visibleSelectedRows,
    selfFetching,
  ]);

  return (
    <div
      aria-busy={isRemoteLoading}
      className="flex w-full flex-col gap-2"
      style={{ height: `${height || 15}svh` }}>
      <div className="flex min-h-7 flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <div
          aria-hidden={!isRemoteLoading}
          className={`mr-auto flex w-44 shrink-0 items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 ${isRemoteLoading ? "visible" : "invisible"}`}
          role={isRemoteLoading ? "status" : undefined}>
          <Spinner className="size-3.5" />
          <span>Ansicht wird aktualisiert…</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Sichtbar:</span>
          <span className="font-medium text-foreground">
            {displayedVisiblePointCount?.toLocaleString("de-DE") ?? "–"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Modus:</span>
          <span className="font-medium text-foreground">
            {selfFetching && remoteData?.mode === "raster"
              ? "Übersicht"
              : "Interaktiv"}
          </span>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Interaktive Punktgrenze:
          <Input
            className="w-32"
            type="text"
            inputMode="numeric"
            disabled={isRemoteLoading}
            value={GERMAN_INTEGER_FORMATTER.format(pointLimit)}
            onChange={(event) => {
              const nextValue = Number(event.target.value.replace(/\D/g, ""));

              if (Number.isFinite(nextValue) && nextValue >= 1) {
                viewportFetchEnabledRef.current = true;
                setPointLimit(Math.min(Math.floor(nextValue), pointLimitMax));
              }
            }}
          />
        </label>
      </div>

      <div
        className={`relative min-h-0 flex-1 overflow-hidden transition-opacity duration-150 ${isRemoteLoading ? "pointer-events-none opacity-55" : "opacity-100"}`}>
        {viewportBounds ? (
          <div className="pointer-events-none absolute top-2 right-3 bottom-10 left-16 z-20 overflow-visible text-[11px] text-muted-foreground">
            {xTicks.map((tick) => (
              <span
                key={`x-${tick}`}
                className="absolute top-full mt-1 -translate-x-1/2 whitespace-nowrap"
                style={{
                  left: `${getAxisPercent(tick, viewportBounds.xMin, viewportBounds.xMax)}%`,
                }}>
                {formatValue(tick, xAxis)}
              </span>
            ))}
            {yTicks.map((tick) => (
              <span
                key={`y-${tick}`}
                className="absolute right-full mr-2 w-12 translate-y-1/2 text-right whitespace-nowrap"
                style={{
                  bottom: `${getAxisPercent(tick, viewportBounds.yMin, viewportBounds.yMax)}%`,
                }}>
                {formatValue(tick, yAxis)}
              </span>
            ))}
            {xAxis?.label ? (
              <span className="absolute top-[calc(100%+1.5rem)] left-1/2 -translate-x-1/2 whitespace-nowrap">
                {xAxis.label}
              </span>
            ) : null}
            {yAxis?.label ? (
              <span className="absolute top-1/2 right-[calc(100%+3.25rem)] -translate-y-1/2 -rotate-90 whitespace-nowrap">
                {yAxis.label}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          ref={plotRef}
          className="absolute top-2 right-3 bottom-10 left-16 overflow-hidden"
          onPointerDown={handleMiddlePanStart}
          onPointerMove={handleMiddlePanMove}
          onPointerUp={handleMiddlePanEnd}
          onPointerCancel={handleMiddlePanEnd}
          onAuxClick={(event) => {
            if (event.button === 1) {
              event.preventDefault();
            }
          }}>
          {viewportBounds ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0">
              {chartConfig.referenceAreas?.map((area, index) => {
                const axisMin =
                  area.axis === "x" ? viewportBounds.xMin : viewportBounds.yMin;
                const axisMax =
                  area.axis === "x" ? viewportBounds.xMax : viewportBounds.yMax;
                const start = getAxisPercent(
                  Math.min(area.from, area.to),
                  axisMin,
                  axisMax,
                );
                const end = getAxisPercent(
                  Math.max(area.from, area.to),
                  axisMin,
                  axisMax,
                );

                if (end < 0 || start > 100) {
                  return null;
                }

                const clippedStart = Math.max(start, 0);
                const clippedEnd = Math.min(end, 100);

                return (
                  <div
                    key={`${area.axis}-${area.from}-${area.to}-${index}`}
                    className={
                      area.axis === "x"
                        ? "absolute inset-y-0"
                        : "absolute inset-x-0"
                    }
                    style={
                      area.axis === "x"
                        ? {
                            left: `${clippedStart}%`,
                            width: `${clippedEnd - clippedStart}%`,
                            backgroundColor:
                              area.color ?? "rgba(37, 99, 235, 0.08)",
                          }
                        : {
                            bottom: `${clippedStart}%`,
                            height: `${clippedEnd - clippedStart}%`,
                            backgroundColor:
                              area.color ?? "rgba(37, 99, 235, 0.08)",
                          }
                    }>
                    {area.label ? (
                      <span className="absolute top-1 left-1 text-[10px] text-muted-foreground">
                        {area.label}
                      </span>
                    ) : null}
                  </div>
                );
              })}

              {(chartConfig.grid ?? "both") === "both" ||
              chartConfig.grid === "x"
                ? xTicks.map((tick) => (
                    <span
                      key={`grid-x-${tick}`}
                      className="absolute inset-y-0 border-l border-border/50"
                      style={{
                        left: `${getAxisPercent(tick, viewportBounds.xMin, viewportBounds.xMax)}%`,
                      }}
                    />
                  ))
                : null}
              {(chartConfig.grid ?? "both") === "both" ||
              chartConfig.grid === "y"
                ? yTicks.map((tick) => (
                    <span
                      key={`grid-y-${tick}`}
                      className="absolute inset-x-0 border-t border-border/50"
                      style={{
                        bottom: `${getAxisPercent(tick, viewportBounds.yMin, viewportBounds.yMax)}%`,
                      }}
                    />
                  ))
                : null}
            </div>
          ) : null}

          {remoteData?.mode === "raster" && rasterUrl && rasterPlacement ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bg-no-repeat"
              style={{
                ...rasterPlacement,
                backgroundImage: `url(${rasterUrl})`,
                backgroundSize: "100% 100%",
                opacity: rasterOpacity,
              }}
            />
          ) : null}

          <DeckGL
            views={ORTHOGRAPHIC_VIEW}
            viewState={viewState}
            controller={isRemoteLoading ? false : WHEEL_ZOOM_CONTROLLER}
            pickingRadius={8}
            getCursor={({ isHovering }) =>
              isMiddlePanning ? "grabbing" : isHovering ? "pointer" : "default"
            }
            layers={layers}
            getTooltip={isRemoteLoading ? undefined : getHoverTooltip}
            onViewStateChange={({ viewState: nextViewState }) =>
              handleViewStateChange(nextViewState as OrthographicViewState)
            }
          />

          {viewportBounds ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10">
              {chartConfig.referenceLines?.map((line, index) => {
                const axisMin =
                  line.axis === "x" ? viewportBounds.xMin : viewportBounds.yMin;
                const axisMax =
                  line.axis === "x" ? viewportBounds.xMax : viewportBounds.yMax;
                const position = getAxisPercent(line.value, axisMin, axisMax);

                if (position < 0 || position > 100) {
                  return null;
                }

                return (
                  <div
                    key={`${line.axis}-${line.value}-${index}`}
                    className={
                      line.axis === "x"
                        ? "absolute inset-y-0 border-l border-dashed"
                        : "absolute inset-x-0 border-t border-dashed"
                    }
                    style={
                      line.axis === "x"
                        ? { left: `${position}%`, borderColor: line.color }
                        : { bottom: `${position}%`, borderColor: line.color }
                    }>
                    {line.label ? (
                      <span
                        className={
                          line.axis === "x"
                            ? "absolute top-1 left-1 whitespace-nowrap text-[10px]"
                            : "absolute bottom-1 left-1 whitespace-nowrap text-[10px]"
                        }
                        style={{ color: line.color }}>
                        {line.label}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {selfFetching && remoteStatus === "error" ? (
            <div className="absolute inset-0 grid place-items-center bg-background/80 px-6 text-center text-sm text-destructive">
              {remoteError}
            </div>
          ) : null}

          {selfFetching &&
          remoteStatus === "success" &&
          remoteData?.totalCount === 0 ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
              Keine Daten im sichtbaren Bereich
            </div>
          ) : null}
        </div>
      </div>

      {showLegend ? (
        <div
          className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-16 text-[11px] text-foreground ${getLegendAlignmentClass(legendPosition)}`}>
          {legendItems.map((item) => {
            const isVisible = !hiddenColorValues.has(item.value);

            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={isVisible}
                className={`flex cursor-pointer items-center gap-1.5 transition-opacity ${isVisible ? "opacity-100" : "opacity-40 line-through"}`}
                title={`${item.label} ${isVisible ? "ausblenden" : "einblenden"}`}
                onClick={() => {
                  if (remoteData?.mode === "raster") {
                    viewportFetchEnabledRef.current = true;
                  }

                  setHiddenColorValues((currentValues) => {
                    const nextValues = new Set(currentValues);

                    if (nextValues.has(item.value)) {
                      nextValues.delete(item.value);
                    } else {
                      nextValues.add(item.value);
                    }

                    return nextValues;
                  });
                }}>
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default ScatterPlotModule;
