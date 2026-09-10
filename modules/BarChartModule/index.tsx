"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  MouseHandlerDataParam,
  ReferenceLine,
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

import { BarChartData } from "./chartDataSchema";
import useTooltipStore from "@/stores/tooltip";
import { useShallow } from "zustand/shallow";

/**
 * Compact transport format returned by the API.
 *
 * category:
 *   Discrete label rendered on the category axis.
 *
 * values:
 *   Per-series measures; values[seriesIndex] selects a series.
 *
 * target:
 *   Optional per-category target used by target markers.
 */

type RechartsRow = {
  category: string;
  target?: number | null;
  [key: `series_${number}`]: number | null | string | undefined;
};

type AxisScale = ((value: string | number) => number | undefined) & {
  bandwidth?: () => number;
};

const DEFAULT_SELECTION_STROKE = "#f59e0b";
const DEFAULT_SELECTION_STROKE_WIDTH = 2;
const DEFAULT_FADE_OPACITY = 0.35;

function getSeriesKey(seriesIndex: number): `series_${number}` {
  return `series_${seriesIndex}`;
}

function formatValue(
  value: number,
  format: BarChartConfig["valueAxis"]["format"],
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

function truncateLabel(label: string, maxLabelChars?: number): string {
  if (!maxLabelChars || label.length <= maxLabelChars) {
    return label;
  }

  return `${label.slice(0, Math.max(0, maxLabelChars - 1))}…`;
}

function createChartContainerConfig(
  series: BarChartConfig["series"],
): ChartConfig {
  return Object.fromEntries(
    series.map((entry) => [
      getSeriesKey(entry.seriesIndex),
      {
        label: entry.name,
        color: entry.fill,
      },
    ]),
  ) as ChartConfig;
}

function sortData(
  data: BarChartData[],
  sort: BarChartConfig["sort"],
): BarChartData[] {
  if (!sort) {
    return data;
  }

  const direction = sort.direction === "asc" ? 1 : -1;
  const copy = [...data];

  if (sort.by === "category") {
    copy.sort((a, b) => a.category.localeCompare(b.category) * direction);
    return copy;
  }

  const seriesIndex = sort.seriesIndex ?? 0;

  copy.sort((a, b) => {
    const aValue = a.values[seriesIndex] ?? Number.NEGATIVE_INFINITY;
    const bValue = b.values[seriesIndex] ?? Number.NEGATIVE_INFINITY;

    return (aValue - bValue) * direction;
  });

  return copy;
}

function createRechartsData(
  data: BarChartData[],
  series: BarChartConfig["series"],
  layout: BarChartConfig["layout"],
): RechartsRow[] {
  return data.map((row, rowIndex) => {
    const rechartsRow: RechartsRow = {
      category: row.category,
      target: row.target,
    };

    let rowTotal = 0;

    if (layout === "stacked100") {
      for (const entry of series) {
        const value = row.values[entry.seriesIndex];

        if (typeof value === "number") {
          rowTotal += value;
        }
      }
    }

    for (const entry of series) {
      if (entry.seriesIndex < 0) {
        throw new Error(
          `Invalid seriesIndex ${entry.seriesIndex} for series "${entry.name}". seriesIndex must be 0 or greater.`,
        );
      }

      if (entry.seriesIndex >= row.values.length) {
        throw new Error(
          `Missing value for series "${entry.name}" at data row ${rowIndex}. ` +
            `Expected values[${entry.seriesIndex}], but the values array only contains ${row.values.length} value(s).`,
        );
      }

      const value = row.values[entry.seriesIndex];

      if (layout === "stacked100") {
        rechartsRow[getSeriesKey(entry.seriesIndex)] =
          typeof value === "number" && rowTotal > 0
            ? (value / rowTotal) * 100
            : null;
      } else {
        rechartsRow[getSeriesKey(entry.seriesIndex)] = value;
      }
    }

    return rechartsRow;
  });
}

function resolveThresholdFill(
  value: number,
  thresholds: NonNullable<BarChartConfig["thresholds"]>,
): string | null {
  for (const rule of thresholds.rules) {
    const aboveMin = rule.min === undefined || value >= rule.min;
    const belowMax = rule.max === undefined || value < rule.max;

    if (aboveMin && belowMax) {
      return rule.fill;
    }
  }

  return null;
}

function resolveBarFill(
  row: BarChartData,
  entry: BarChartConfig["series"][number],
  config: BarChartConfig,
): string {
  const value = row.values[entry.seriesIndex];

  if (
    config.thresholds?.enabled &&
    typeof value === "number" &&
    (config.thresholds.seriesIndex === undefined ||
      config.thresholds.seriesIndex === entry.seriesIndex)
  ) {
    const thresholdFill = resolveThresholdFill(value, config.thresholds);

    if (thresholdFill) {
      return thresholdFill;
    }
  }

  if (config.series.length === 1 && config.colorByCategory?.enabled) {
    return config.colorByCategory.colors[row.category] ?? entry.fill;
  }

  return entry.fill;
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

function resolveLabelPosition(
  position: BarChartConfig["valueLabels"]["position"],
  orientation: BarChartConfig["orientation"],
): "center" | "top" | "right" {
  if (position === "inside") {
    return "center";
  }

  return orientation === "vertical" ? "top" : "right";
}

type Props = ChartWrapperInjectedProps<BarChartData, BarChartConfig>;

function BarChartModule(props: Props) {
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
  const {
    orientation,
    layout,
    categoryAxis,
    valueAxis,
    grid,
    tooltip,
    legend,
    margin,
    bars,
    valueLabels,
    series,
    referenceLines,
    targetBars,
    selectionStyle,
  } = chartConfig;

  const selectionEnabled = typeof onSelectionChange === "function";
  const normalInteractionEnabled = lasso.mode === null;

  const { showTooltipOnClick, tooltip: enhancedTooltipData } = useTooltipStore(
    useShallow((state) => ({
      tooltip: state.tooltip,
      showTooltipOnClick: state.showTooltipOnClick,
    })),
  );

  const showEnhancedTooltip = !!enhancedTooltipData;

  const sortedData = useMemo(
    () => sortData(chartData, chartConfig.sort),
    [chartData, chartConfig.sort],
  );

  const rechartsData = useMemo(
    () => createRechartsData(sortedData, series, layout),
    [sortedData, series, layout],
  );

  const dataConfig = useMemo(
    () => createChartContainerConfig(series),
    [series],
  );

  const selectedSet = useMemo(() => new Set(selectedRows), [selectedRows]);
  const selectionActive = selectedRows.length > 0;

  const selectionStroke = selectionStyle?.stroke ?? DEFAULT_SELECTION_STROKE;
  const selectionStrokeWidth =
    selectionStyle?.strokeWidth ?? DEFAULT_SELECTION_STROKE_WIDTH;
  const fadeOthersOpacity =
    selectionStyle?.fadeOthersOpacity ?? DEFAULT_FADE_OPACITY;

  const effectiveValueFormat =
    layout === "stacked100" ? "percent" : valueAxis.format;

  const valueDomain: [number, number] | undefined =
    layout === "stacked100"
      ? [0, 100]
      : Array.isArray(valueAxis.domain)
        ? valueAxis.domain
        : undefined;

  const isStacked = layout === "stacked" || layout === "stacked100";
  const chartLayout = orientation === "horizontal" ? "vertical" : "horizontal";

  const handleChartClick = (
    state: MouseHandlerDataParam,
    event: React.MouseEvent<Element>,
  ) => {
    if (!normalInteractionEnabled) {
      return;
    }

    const category = state?.activeLabel;

    if (typeof category !== "string") {
      return;
    }

    const row = sortedData.find((entry) => entry.category === category);

    if (!row) {
      return;
    }

    if (enhancedTooltip) {
      showTooltipOnClick({
        chartID,
        dataPoint: row,
        position: {
          x: event.clientX,
          y: event.clientY,
        },
      });
    }

    if (!onSelectionChange) {
      return;
    }

    const additive = event.ctrlKey || event.metaKey || event.shiftKey;

    onSelectionChange([row], additive ? { additive: true } : undefined);
  };

  const categoryTickFormatter = (value: string) =>
    truncateLabel(value, categoryAxis.maxLabelChars);

  const categoryAngleProps =
    categoryAxis.angle !== undefined
      ? { angle: categoryAxis.angle, textAnchor: "end" as const }
      : {};

  const categoryAxisElement =
    orientation === "vertical" ? (
      <XAxis
        dataKey="category"
        type="category"
        interval={0}
        hide={!categoryAxis.show}
        tickLine={categoryAxis.tickLine}
        axisLine={categoryAxis.axisLine}
        tickMargin={categoryAxis.tickMargin}
        tickFormatter={categoryTickFormatter}
        {...categoryAngleProps}
      />
    ) : (
      <YAxis
        dataKey="category"
        type="category"
        width="auto"
        interval={0}
        hide={!categoryAxis.show}
        tickLine={categoryAxis.tickLine}
        axisLine={categoryAxis.axisLine}
        tickMargin={categoryAxis.tickMargin}
        tickFormatter={categoryTickFormatter}
        {...categoryAngleProps}
      />
    );

  const valueAxisElement =
    orientation === "vertical" ? (
      <YAxis
        type="number"
        width="auto"
        domain={valueDomain}
        hide={!valueAxis.show}
        tickLine={valueAxis.tickLine}
        axisLine={valueAxis.axisLine}
        tickFormatter={(value: number) =>
          formatValue(value, effectiveValueFormat)
        }
      />
    ) : (
      <XAxis
        type="number"
        domain={valueDomain}
        hide={!valueAxis.show}
        tickLine={valueAxis.tickLine}
        axisLine={valueAxis.axisLine}
        tickFormatter={(value: number) =>
          formatValue(value, effectiveValueFormat)
        }
      />
    );

  return (
    <ChartContainer
      config={dataConfig}
      className="w-full aspect-auto"
      style={{
        height: `${height || 15}svh`,
      }}>
      <ComposedChart
        accessibilityLayer
        data={rechartsData}
        layout={chartLayout}
        margin={margin}
        barCategoryGap={bars.categoryGap}
        barGap={layout === "overlay" ? "-100%" : bars.barGap}
        onClick={
          normalInteractionEnabled && (selectionEnabled || enhancedTooltip)
            ? handleChartClick
            : undefined
        }>
        {grid.show && (
          <CartesianGrid
            horizontal={grid.horizontal}
            vertical={grid.vertical}
            strokeDasharray={grid.strokeDasharray}
          />
        )}

        {categoryAxisElement}
        {valueAxisElement}

        {tooltip.show && !showEnhancedTooltip && (
          <ChartTooltip
            cursor={tooltip.cursor}
            content={<ChartTooltipContent />}
          />
        )}

        {legend.show && <Legend />}

        {series.map((entry) => {
          const dataKey = getSeriesKey(entry.seriesIndex);

          return (
            <Bar
              key={dataKey}
              dataKey={dataKey}
              name={entry.name}
              fill={entry.fill}
              radius={bars.radius}
              stackId={isStacked ? (entry.stackId ?? "stack") : undefined}>
              {sortedData.map((row, rowIndex) => {
                const selected = selectedSet.has(row);
                const fillOpacity =
                  selectionActive && !selected
                    ? fadeOthersOpacity
                    : entry.fillOpacity;

                return (
                  <Cell
                    key={`${dataKey}-${rowIndex}`}
                    fill={resolveBarFill(row, entry, chartConfig)}
                    fillOpacity={fillOpacity}
                    stroke={selected ? selectionStroke : entry.stroke}
                    strokeWidth={
                      selected ? selectionStrokeWidth : entry.strokeWidth
                    }
                  />
                );
              })}

              {valueLabels.show && (
                <LabelList
                  dataKey={dataKey}
                  position={resolveLabelPosition(
                    valueLabels.position,
                    orientation,
                  )}
                  formatter={(value: unknown) =>
                    typeof value === "number"
                      ? formatValue(value, valueLabels.format)
                      : ""
                  }
                />
              )}
            </Bar>
          );
        })}

        {referenceLines?.map((line, index) =>
          orientation === "vertical" ? (
            <ReferenceLine
              key={`ref-${index}`}
              y={line.value}
              stroke={line.stroke}
              strokeWidth={line.strokeWidth}
              strokeDasharray={line.strokeDasharray}
              label={line.label}
            />
          ) : (
            <ReferenceLine
              key={`ref-${index}`}
              x={line.value}
              stroke={line.stroke}
              strokeWidth={line.strokeWidth}
              strokeDasharray={line.strokeDasharray}
              label={line.label}
            />
          ),
        )}

        {targetBars?.enabled && (
          <TargetMarkers
            data={sortedData}
            orientation={orientation}
            style={targetBars.style}
            fill={targetBars.fill}
            size={targetBars.size}
          />
        )}

        <BarChartLassoAdapter
          lasso={lasso}
          data={sortedData}
          series={series}
          orientation={orientation}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

type TargetMarkersProps = {
  data: BarChartData[];
  orientation: BarChartConfig["orientation"];
  style: NonNullable<BarChartConfig["targetBars"]>["style"];
  fill: string;
  size: number;
};

function TargetMarkers({
  data,
  orientation,
  style,
  fill,
  size,
}: TargetMarkersProps) {
  const plotArea = usePlotArea();
  const xScale = useXAxisScale() as unknown as AxisScale | undefined;
  const yScale = useYAxisScale() as unknown as AxisScale | undefined;

  if (!plotArea || !xScale || !yScale) {
    return null;
  }

  const categoryScale = orientation === "vertical" ? xScale : yScale;
  const valueScale = orientation === "vertical" ? yScale : xScale;
  const bandwidth =
    typeof categoryScale.bandwidth === "function"
      ? categoryScale.bandwidth()
      : 0;

  return (
    <g pointerEvents="none">
      {data.map((row, index) => {
        if (row.target === null || row.target === undefined) {
          return null;
        }

        const categoryStart = categoryScale(row.category);
        const valuePixel = valueScale(row.target);

        if (
          typeof categoryStart !== "number" ||
          typeof valuePixel !== "number"
        ) {
          return null;
        }

        if (orientation === "vertical") {
          if (style === "line") {
            return (
              <line
                key={index}
                x1={categoryStart}
                x2={categoryStart + bandwidth}
                y1={valuePixel}
                y2={valuePixel}
                stroke={fill}
                strokeWidth={size}
              />
            );
          }

          return (
            <rect
              key={index}
              x={categoryStart}
              y={valuePixel - size / 2}
              width={bandwidth}
              height={size}
              fill={fill}
            />
          );
        }

        if (style === "line") {
          return (
            <line
              key={index}
              x1={valuePixel}
              x2={valuePixel}
              y1={categoryStart}
              y2={categoryStart + bandwidth}
              stroke={fill}
              strokeWidth={size}
            />
          );
        }

        return (
          <rect
            key={index}
            x={valuePixel - size / 2}
            y={categoryStart}
            width={size}
            height={bandwidth}
            fill={fill}
          />
        );
      })}
    </g>
  );
}

type BarChartLassoAdapterProps = {
  lasso: LassoController<BarChartData>;
  data: BarChartData[];
  series: BarChartConfig["series"];
  orientation: BarChartConfig["orientation"];
};

function BarChartLassoAdapter({
  lasso,
  data,
  series,
  orientation,
}: BarChartLassoAdapterProps) {
  const plotArea = usePlotArea();
  const xScale = useXAxisScale() as unknown as AxisScale | undefined;
  const yScale = useYAxisScale() as unknown as AxisScale | undefined;
  const { registerAdapter } = lasso;

  const adapterStateRef = useRef({
    data,
    series,
    orientation,
    plotArea,
    xScale,
    yScale,
  });

  useEffect(() => {
    adapterStateRef.current = {
      data,
      series,
      orientation,
      plotArea,
      xScale,
      yScale,
    };
  });

  useEffect(() => {
    const adapter: LassoAdapter<BarChartData> = {
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
        const {
          data: currentData,
          series: currentSeries,
          orientation: currentOrientation,
          plotArea: currentPlotArea,
          xScale: currentXScale,
          yScale: currentYScale,
        } = adapterStateRef.current;

        if (!currentPlotArea || !currentXScale || !currentYScale) {
          return [];
        }

        const categoryScale =
          currentOrientation === "vertical" ? currentXScale : currentYScale;
        const valueScale =
          currentOrientation === "vertical" ? currentYScale : currentXScale;
        const bandwidth =
          typeof categoryScale.bandwidth === "function"
            ? categoryScale.bandwidth()
            : 0;

        return currentData.filter((row) =>
          currentSeries.some((entry) => {
            const value = row.values[entry.seriesIndex];

            if (value === null || value === undefined) {
              return false;
            }

            const categoryStart = categoryScale(row.category);
            const valuePixel = valueScale(value);

            if (
              typeof categoryStart !== "number" ||
              typeof valuePixel !== "number"
            ) {
              return false;
            }

            const categoryCenter = categoryStart + bandwidth / 2;
            const pixelX =
              currentOrientation === "vertical" ? categoryCenter : valuePixel;
            const pixelY =
              currentOrientation === "vertical" ? valuePixel : categoryCenter;

            const normalizedX =
              (pixelX - currentPlotArea.x) / currentPlotArea.width;
            const normalizedY =
              (pixelY - currentPlotArea.y) / currentPlotArea.height;

            return shapeContains(shape, { x: normalizedX, y: normalizedY });
          }),
        );
      },
    };

    registerAdapter(adapter);

    return () => registerAdapter(null);
  }, [registerAdapter]);

  return null;
}

export default BarChartModule;
