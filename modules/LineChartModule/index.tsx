"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Curve,
  Legend,
  Line,
  MouseHandlerDataParam,
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import { LineChartData } from "./chartDataSchema";
import useTooltipStore from "@/stores/tooltip";
import { useShallow } from "zustand/shallow";

/**
 * Compact transport format returned by the API.
 *
 * x:
 *   Numeric X-axis value.
 *   Dates should be Unix timestamps in milliseconds.
 *
 * y:
 *   Values for the configured chart series.
 *
 * Example:
 *
 * {
 *   x: 1782864000000,
 *   y: [12, 9]
 * }
 */

type RechartsDataPoint = {
  x: number;
  [key: `series_${number}`]: number | null;
};

function getSeriesKey(seriesIndex: number): `series_${number}` {
  return `series_${seriesIndex}`;
}

function formatXAxisValue(
  value: number,
  format: LineChartConfig["xAxis"]["format"],
): string {
  switch (format) {
    case "date-month-day": {
      const date = new Date(value);

      const month = String(date.getUTCMonth() + 1).padStart(2, "0");

      const day = String(date.getUTCDate()).padStart(2, "0");

      return `${month}-${day}`;
    }

    case "date-day-month": {
      const date = new Date(value);

      const month = String(date.getUTCMonth() + 1).padStart(2, "0");

      const day = String(date.getUTCDate()).padStart(2, "0");

      return `${day}.${month}`;
    }

    case "number":
    default:
      return String(value);
  }
}

function formatYAxisValue(
  value: number,
  format: LineChartConfig["yAxis"]["format"],
): string {
  switch (format) {
    case "compact":
      return new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);

    case "percent":
      return `${value}%`;

    case "number":
    default:
      return String(value);
  }
}

function createChartContainerConfig(
  lines: LineChartConfig["lines"],
): ChartConfig {
  return Object.fromEntries(
    lines.map((line) => [
      getSeriesKey(line.seriesIndex),
      {
        label: line.name,
        color: line.stroke,
      },
    ]),
  ) as ChartConfig;
}

function createRechartsData(
  chartData: LineChartData[],
  lines: LineChartConfig["lines"],
): RechartsDataPoint[] {
  return chartData.map((dataPoint, pointIndex) => {
    const rechartsDataPoint: RechartsDataPoint = {
      x: dataPoint.x,
    };

    for (const line of lines) {
      if (line.seriesIndex < 0) {
        throw new Error(
          `Invalid seriesIndex ${line.seriesIndex} for line "${line.name}". seriesIndex must be 0 or greater.`,
        );
      }

      if (line.seriesIndex >= dataPoint.y.length) {
        throw new Error(
          `Missing Y value for line "${line.name}" at data point ${pointIndex}. ` +
            `Expected y[${line.seriesIndex}], but the Y array only contains ${dataPoint.y.length} value(s).`,
        );
      }

      rechartsDataPoint[getSeriesKey(line.seriesIndex)] =
        dataPoint.y[line.seriesIndex];
    }

    return rechartsDataPoint;
  });
}

function getXDomain(chartData: LineChartData[]): [number, number] | null {
  if (chartData.length === 0) {
    return null;
  }

  let min = chartData[0].x;
  let max = chartData[0].x;

  for (const point of chartData) {
    min = Math.min(min, point.x);
    max = Math.max(max, point.x);
  }

  return [min, max];
}

type Props = ChartWrapperInjectedProps<LineChartData, LineChartConfig>;

function LineChartModule(props: Props) {
  const {
    chartConfig,
    chartData,
    height,
    onSelectionChange,
    chartID,
    enhancedTooltip,
    lasso,
    selectedRows,
  } = props;
  const { xAxis, yAxis, grid, tooltip, legend, margin, lines } = chartConfig;
  const selectionEnabled = typeof onSelectionChange === "function";
  const normalInteractionEnabled = lasso.mode === null;
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);

  // const lastTooltipDataPoint = useRef<LineChartData | null>(null);
  const {
    showTooltipOnClick,
    //TODO: Remove here if not needed
    // hideTooltip,
    tooltip: enhancedTooltipData,
  } = useTooltipStore(
    useShallow((state) => ({
      showTooltipOnMove: state.showTooltipOnMove,
      tooltip: state.tooltip,
      // hideTooltip: state.hideTooltip,
      showTooltipOnClick: state.showTooltipOnClick,
    })),
  );

  const showEnhancedTooltip = !!enhancedTooltipData;

  const handleChartClick = (
    state: MouseHandlerDataParam,
    event: React.MouseEvent<Element>,
  ) => {
    if (enhancedTooltip && normalInteractionEnabled) {
      showTooltipOnClick({
        chartID,
        dataPoint: chartData.find(
          (point) => point.x === Number(state.activeLabel),
        ),
        position: {
          x: event.clientX,
          y: event.clientY,
        },
      });
    }

    if (!onSelectionChange || !normalInteractionEnabled) {
      return;
    }

    const activeLabel = state?.activeLabel;
    const x = Number(activeLabel);

    if (!Number.isFinite(x)) {
      return;
    }

    const rows = chartData.filter((point) => point.x === x);

    if (rows.length > 0) {
      onSelectionChange(rows);
    }
  };

  const dataConfig = useMemo(() => createChartContainerConfig(lines), [lines]);

  const rechartsData = useMemo(
    () => createRechartsData(chartData, lines),
    [chartData, lines],
  );

  const visibleChartData = useMemo(
    () =>
      zoomDomain
        ? chartData.filter(
            (point) => point.x >= zoomDomain[0] && point.x <= zoomDomain[1],
          )
        : chartData,
    [chartData, zoomDomain],
  );

  const visibleRechartsData = useMemo(
    () =>
      zoomDomain
        ? rechartsData.filter(
            (point) => point.x >= zoomDomain[0] && point.x <= zoomDomain[1],
          )
        : rechartsData,
    [rechartsData, zoomDomain],
  );

  const visibleSelectedRows = useMemo(
    () =>
      zoomDomain
        ? selectedRows.filter(
            (point) => point.x >= zoomDomain[0] && point.x <= zoomDomain[1],
          )
        : selectedRows,
    [selectedRows, zoomDomain],
  );

  const fullXDomain = useMemo(() => getXDomain(chartData), [chartData]);

  // TODO: Remove if no tootlip on hover is used
  // const handleTooltipMouseMove = (
  //   state: MouseHandlerDataParam,
  //   event: React.MouseEvent<Element>,
  // ) => {
  //   if (!enhancedTooltip) return;

  //   hideTooltip();

  //   const x = Number(state.activeLabel);

  //   if (!Number.isFinite(x)) {
  //     return;
  //   }

  //   const dataPoint = chartData.find((point) => point.x === x);

  //   if (!dataPoint) {
  //     return;
  //   }

  //   showTooltipOnMove({
  //     chartID,
  //     dataPoint,
  //     position: {
  //       x: event.clientX,
  //       y: event.clientY,
  //     },
  //   });
  // };

  // const handleTooltipMouseLeave = () => {
  //   lastTooltipDataPoint.current = null;
  //   hideTooltip();
  // };

  return (
    <ChartContainer
      config={dataConfig}
      className="w-full aspect-auto"
      style={{
        height: `${height || 15}svh`,
      }}>
      <ComposedChart
        accessibilityLayer
        data={visibleRechartsData}
        margin={margin}
        onClick={
          normalInteractionEnabled && (selectionEnabled || enhancedTooltip)
            ? handleChartClick
            : undefined
        }
        // onMouseMove={handleTooltipMouseMove}
        // onMouseLeave={handleTooltipMouseLeave}
      >
        {grid.show && (
          <CartesianGrid
            horizontal={grid.horizontal}
            vertical={grid.vertical}
            strokeDasharray={grid.strokeDasharray}
          />
        )}

        <XAxis
          dataKey="x"
          type="number"
          domain={zoomDomain ?? ["dataMin", "dataMax"]}
          allowDataOverflow={zoomDomain !== null}
          hide={!xAxis.show}
          tickLine={xAxis.tickLine}
          axisLine={xAxis.axisLine}
          tickMargin={xAxis.tickMargin}
          tickFormatter={(value: number) =>
            formatXAxisValue(value, xAxis.format)
          }
        />

        <YAxis
          type="number"
          width="auto"
          hide={!yAxis.show}
          tickLine={yAxis.tickLine}
          axisLine={yAxis.axisLine}
          tickFormatter={(value: number) =>
            formatYAxisValue(value, yAxis.format)
          }
        />

        {tooltip.show && !showEnhancedTooltip && (
          <ChartTooltip
            cursor={tooltip.cursor}
            content={<ChartTooltipContent />}
          />
        )}

        {legend.show && <Legend />}

        {lines.map((line) => {
          const dataKey = getSeriesKey(line.seriesIndex);
          const selectionAwareShape = (
            <SelectionAwareLineShape
              chartData={visibleChartData}
              selectedRows={visibleSelectedRows}
              originalStroke={line.stroke}
              selectionStroke={SELECTION_COLOR}
              configuredStrokeWidth={line.strokeWidth}
              configuredStrokeDasharray={line.strokeDasharray}
              connectConfiguredNulls={line.connectNulls}
            />
          );

          const commonProps = {
            dataKey,
            name: line.name,
            type: line.curve,
            stroke: line.stroke,
            strokeWidth: line.strokeWidth,
            strokeDasharray: line.strokeDasharray,
            connectNulls: line.connectNulls,

            dot: line.dots.show
              ? {
                  r: line.dots.radius,
                  fill: line.dots.fill,
                  stroke: line.dots.stroke,
                  strokeWidth: line.dots.strokeWidth,
                }
              : false,

            activeDot: line.activeDot.show
              ? {
                  r: line.activeDot.radius,
                  fill: line.activeDot.fill,
                  stroke: line.activeDot.stroke,
                  strokeWidth: line.activeDot.strokeWidth,
                }
              : false,
          } as const;

          if (line.fill.enabled) {
            return (
              <g key={dataKey}>
                <Area
                  {...commonProps}
                  stroke="none"
                  dot={false}
                  activeDot={false}
                  fill={line.fill.color}
                  fillOpacity={line.fill.opacity}
                />
                <Line
                  {...commonProps}
                  shape={selectionAwareShape}
                  fill="none"
                  legendType="none"
                  tooltipType="none"
                />
              </g>
            );
          }

          return (
            <Line
              key={dataKey}
              {...commonProps}
              shape={selectionAwareShape}
              fill="none"
            />
          );
        })}

        <LineChartLassoAdapter
          lasso={lasso}
          chartData={visibleChartData}
          lines={lines}
          currentXDomain={zoomDomain ?? fullXDomain}
          setZoomDomain={setZoomDomain}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

type SelectionAwareLineShapeProps = React.ComponentProps<typeof Curve> & {
  chartData: readonly LineChartData[];
  selectedRows: readonly LineChartData[];
  originalStroke: string;
  selectionStroke: string;
  configuredStrokeWidth: number;
  configuredStrokeDasharray?: string;
  connectConfiguredNulls: boolean;
};

const SELECTION_COLOR = "#f59e0b";
const NULL_CURVE_POINT = { x: null, y: null } as const;

function SelectionAwareLineShape({
  points = [],
  type,
  layout,
  chartData,
  selectedRows,
  originalStroke,
  selectionStroke,
  configuredStrokeWidth,
  configuredStrokeDasharray,
  connectConfiguredNulls,
}: SelectionAwareLineShapeProps) {
  const selectedSet = new Set(selectedRows);
  const entries = points.map((point, index) => ({
    point,
    selected: selectedSet.has(chartData[index]),
  }));
  const drawableEntries = connectConfiguredNulls
    ? entries.filter(({ point }) => point.x !== null && point.y !== null)
    : entries;
  const selectedSegments = drawableEntries.slice(0, -1).map((entry, index) => {
    const next = drawableEntries[index + 1];

    if (
      entry.point.x === null ||
      entry.point.y === null ||
      next.point.x === null ||
      next.point.y === null
    ) {
      return null;
    }

    return entry.selected || next.selected;
  });
  const originalPoints = createSegmentPoints(
    drawableEntries,
    selectedSegments,
    false,
  );
  const selectionPoints = createSegmentPoints(
    drawableEntries,
    selectedSegments,
    true,
  );

  return (
    <g className="line-chart-selection-aware-curve" pointerEvents="none">
      <Curve
        points={originalPoints}
        type={type}
        layout={layout}
        connectNulls={false}
        fill="none"
        stroke={originalStroke}
        strokeWidth={configuredStrokeWidth}
        strokeDasharray={configuredStrokeDasharray}
      />
      <Curve
        className="line-chart-selected-segments"
        points={selectionPoints}
        type={type}
        layout={layout}
        connectNulls={false}
        fill="none"
        stroke={selectionStroke}
        strokeWidth={configuredStrokeWidth}
        strokeDasharray={configuredStrokeDasharray}
      />
    </g>
  );
}

function createSegmentPoints(
  entries: ReadonlyArray<{
    point: { x: number | null; y: number | null };
    selected: boolean;
  }>,
  selectedSegments: ReadonlyArray<boolean | null>,
  selected: boolean,
): Array<{ x: number | null; y: number | null }> {
  return entries.map(({ point }, index) => {
    const previousSegment = selectedSegments[index - 1];
    const nextSegment = selectedSegments[index];

    return previousSegment === selected || nextSegment === selected
      ? point
      : NULL_CURVE_POINT;
  });
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

type LineChartLassoAdapterProps = {
  lasso: LassoController<LineChartData>;
  chartData: LineChartData[];
  lines: LineChartConfig["lines"];
  currentXDomain: [number, number] | null;
  setZoomDomain: (domain: [number, number] | null) => void;
};

function LineChartLassoAdapter({
  lasso,
  chartData,
  lines,
  currentXDomain,
  setZoomDomain,
}: LineChartLassoAdapterProps) {
  const plotArea = usePlotArea();
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const { registerAdapter } = lasso;
  const adapterStateRef = useRef({
    chartData,
    currentXDomain,
    lines,
    plotArea,
    xScale,
    yScale,
  });

  useEffect(() => {
    adapterStateRef.current = {
      chartData,
      currentXDomain,
      lines,
      plotArea,
      xScale,
      yScale,
    };
  });

  useEffect(() => {
    const adapter: LassoAdapter<LineChartData> = {
      getPlotBounds: () => {
        const { plotArea: currentPlotArea } = adapterStateRef.current;

        return currentPlotArea
          ? {
              x: currentPlotArea.x,
              y: currentPlotArea.y,
              width: currentPlotArea.width,
              height: currentPlotArea.height,
            }
          : null;
      },
      select: (shape) => {
        if (shape.kind !== "polygon") {
          return [];
        }

        const {
          chartData: currentChartData,
          lines: currentLines,
          plotArea: currentPlotArea,
          xScale: currentXScale,
          yScale: currentYScale,
        } = adapterStateRef.current;

        if (!currentPlotArea || !currentXScale || !currentYScale) {
          return [];
        }

        return currentChartData.filter((dataPoint) =>
          currentLines.some((line) => {
            const value = dataPoint.y[line.seriesIndex];

            if (value === null || value === undefined) {
              return false;
            }

            const pixelX = currentXScale(dataPoint.x);
            const pixelY = currentYScale(value);

            if (typeof pixelX !== "number" || typeof pixelY !== "number") {
              return false;
            }

            const normalizedX =
              (pixelX - currentPlotArea.x) / currentPlotArea.width;
            const normalizedY =
              (pixelY - currentPlotArea.y) / currentPlotArea.height;

            return isPointInPolygon(
              { x: normalizedX, y: normalizedY },
              shape.points,
            );
          }),
        );
      },
      applyZoom: (shape) => {
        if (shape.kind !== "rectangle") {
          return false;
        }

        const { currentXDomain: currentDomain } = adapterStateRef.current;

        if (!currentDomain) {
          return false;
        }

        const start = Math.min(shape.start.x, shape.end.x);
        const end = Math.max(shape.start.x, shape.end.x);
        const [domainMin, domainMax] = currentDomain;
        const domainSize = domainMax - domainMin;

        if (domainSize <= 0 || end <= start) {
          return false;
        }

        setZoomDomain([
          domainMin + start * domainSize,
          domainMin + end * domainSize,
        ]);

        return true;
      },
      resetZoom: () => setZoomDomain(null),
    };

    registerAdapter(adapter);

    return () => registerAdapter(null);
  }, [registerAdapter, setZoomDomain]);

  return null;
}

export default LineChartModule;
