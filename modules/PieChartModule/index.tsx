"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  type PieLabelRenderProps,
  type PieSectorDataItem,
  usePlotArea,
} from "recharts";
import { useShallow } from "zustand/shallow";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import useTooltipStore from "@/stores/tooltip";

import type { PieChartData } from "./chartDataSchema";
import {
  derivePieSlices,
  getSelectableSliceRow,
  type RenderSlice,
} from "./logic";

type Props = ChartWrapperInjectedProps<PieChartData, PieChartConfig>;

type PlotArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type NumberFormatOptions = NonNullable<
  PieChartConfig["labels"]["numberFormat"]
>;

const DEFAULT_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;
const DEFAULT_MAX_SLICES = 24;
const DEFAULT_FADE_OPACITY = 0.35;
const DEFAULT_SELECTION_STROKE = "var(--foreground)";
const DEFAULT_SELECTION_STROKE_WIDTH = 2;
const DEFAULT_SLICE_STROKE = "var(--background)";
const DEFAULT_SLICE_STROKE_WIDTH = 1;
const LABEL_OFFSET = 16;
const COMPACT_WIDTH = 480;
const RADIAN = Math.PI / 180;

function formatValue(
  value: number,
  options: NumberFormatOptions | undefined,
  fallbackFormat: NumberFormatOptions["format"],
): string {
  const format = options?.format ?? fallbackFormat;
  const locale = options?.locale ?? "en";
  const decimals = options?.decimals;
  const fractionDigits =
    decimals === undefined
      ? {}
      : {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        };

  let formatted: string;

  switch (format) {
    case "compact":
      formatted = new Intl.NumberFormat(locale, {
        notation: "compact",
        useGrouping: options?.useGrouping ?? false,
        maximumFractionDigits: decimals ?? 1,
        ...(decimals === undefined
          ? {}
          : { minimumFractionDigits: decimals }),
      }).format(value);
      break;

    case "percent":
      formatted = new Intl.NumberFormat(locale, {
        style: "percent",
        useGrouping: options?.useGrouping ?? false,
        ...fractionDigits,
      }).format(value);
      break;

    case "currency":
      formatted = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: options?.currency ?? "EUR",
        useGrouping: options?.useGrouping ?? false,
        ...fractionDigits,
      }).format(value);
      break;

    case "number":
    default:
      formatted = new Intl.NumberFormat(locale, {
        useGrouping: options?.useGrouping ?? false,
        ...fractionDigits,
      }).format(value);
      break;
  }

  return `${options?.prefix ?? ""}${formatted}${options?.suffix ?? ""}`;
}

function truncateName(name: string, maxChars?: number): string {
  if (!maxChars || name.length <= maxChars) {
    return name;
  }

  return `${name.slice(0, Math.max(0, maxChars - 1))}…`;
}

function isDonutRadius(radius: number | string | undefined): boolean {
  if (typeof radius === "number") {
    return radius > 0;
  }

  if (typeof radius !== "string") {
    return false;
  }

  const parsed = Number.parseFloat(radius.trim());
  return Number.isFinite(parsed) && parsed > 0;
}

function usesDefaultCenter(value: number | string | undefined): boolean {
  return value === undefined || value === "50%";
}

function resolveSliceFill(
  slice: RenderSlice,
  index: number,
  config: PieChartConfig,
): string {
  if (slice.kind === "others" && config.groupOthers?.color) {
    return config.groupOthers.color;
  }

  const override = config.colors.byName?.[slice.row.name];

  if (override !== undefined) {
    return override;
  }

  const palette = config.colors.palette?.length
    ? config.colors.palette
    : DEFAULT_PALETTE;

  return palette[index % palette.length];
}

function formatSliceContent(
  slice: RenderSlice,
  total: number,
  content: PieChartConfig["labels"]["content"],
  numberFormat: PieChartConfig["labels"]["numberFormat"],
  maxLabelChars?: number,
): string {
  const name = truncateName(slice.row.name, maxLabelChars);
  const percent = total === 0 ? 0 : slice.row.value / total;
  const formattedValue = formatValue(slice.row.value, numberFormat, "number");
  const formattedPercent = formatPercentValue(percent, numberFormat);

  switch (content) {
    case "value":
      return formattedValue;
    case "percent":
      return formattedPercent;
    case "name-percent":
      return `${name} ${formattedPercent}`;
    case "name-value":
      return `${name} ${formattedValue}`;
    case "name":
    default:
      return name;
  }
}

function formatRawTooltipValue(
  value: number,
  options?: NumberFormatOptions,
): string {
  if (options?.format !== "percent") {
    return formatValue(value, options, "number");
  }

  return formatValue(value, { ...options, format: "number" }, "number");
}

// Percent displays must ignore a value-oriented `format` (e.g. currency/compact).
function formatPercentValue(
  value: number,
  options: NumberFormatOptions | undefined,
): string {
  return formatValue(
    value,
    options ? { ...options, format: "percent" } : undefined,
    "percent",
  );
}

function PieLegend({
  chartConfig,
  position,
  slices,
  total,
}: {
  chartConfig: PieChartConfig;
  position: PieChartConfig["legend"]["position"];
  slices: RenderSlice[];
  total: number;
}) {
  const vertical = position === "left" || position === "right";

  return (
    <ul
      className={
        vertical
          ? "flex flex-col gap-2 text-xs"
          : "flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs"
      }>
      {slices.map((slice, index) => {
        const percent = total === 0 ? 0 : slice.row.value / total;
        const detail =
          chartConfig.legend.content === "name-percent"
            ? formatPercentValue(percent, chartConfig.labels.numberFormat)
            : chartConfig.legend.content === "name-value"
              ? formatValue(
                  slice.row.value,
                  chartConfig.labels.numberFormat,
                  "number",
                )
              : null;

        return (
          <li
            key={`${slice.kind}-${index}`}
            className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: resolveSliceFill(slice, index, chartConfig) }}
            />
            <span>
              {slice.row.name}
              {detail ? ` ${detail}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function PlotAreaReporter({
  onChange,
}: {
  onChange: (plotArea: PlotArea) => void;
}) {
  const plotArea = usePlotArea();

  useEffect(() => {
    if (!plotArea) {
      return;
    }

    onChange({
      x: plotArea.x,
      y: plotArea.y,
      width: plotArea.width,
      height: plotArea.height,
    });
  }, [
    onChange,
    plotArea,
    plotArea?.height,
    plotArea?.width,
    plotArea?.x,
    plotArea?.y,
  ]);

  return null;
}

function PieChartModule(props: Props) {
  const {
    chartConfig,
    chartData,
    chartID,
    enhancedTooltip,
    height,
    onSelectionChange,
    selectedRows,
  } = props;
  const { colors, labels, legend, margin, pie, selectionStyle, tooltip } =
    chartConfig;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [plotArea, setPlotArea] = useState<PlotArea | null>(null);
  const { showTooltipOnClick, tooltip: enhancedTooltipData } = useTooltipStore(
    useShallow((state) => ({
      showTooltipOnClick: state.showTooltipOnClick,
      tooltip: state.tooltip,
    })),
  );

  const derived = useMemo(
    () =>
      derivePieSlices(
        chartData,
        chartConfig.groupOthers,
        chartConfig.sort,
      ),
    [chartConfig.groupOthers, chartConfig.sort, chartData],
  );

  const { slices, total } = derived;
  const selectedSet = useMemo(() => new Set(selectedRows), [selectedRows]);
  const selectionActive = selectedRows.length > 0;
  const selectedTotal = selectedRows.reduce(
    (sum, row) => sum + row.value,
    0,
  );
  const maxSlices = chartConfig.maxSlices ?? DEFAULT_MAX_SLICES;
  const selectionStroke =
    selectionStyle?.stroke ?? DEFAULT_SELECTION_STROKE;
  const selectionStrokeWidth =
    selectionStyle?.strokeWidth ?? DEFAULT_SELECTION_STROKE_WIDTH;
  const fadeOthersOpacity =
    selectionStyle?.fadeOthersOpacity ?? DEFAULT_FADE_OPACITY;
  const sliceStroke = colors.stroke ?? DEFAULT_SLICE_STROKE;
  const sliceStrokeWidth =
    colors.strokeWidth ?? DEFAULT_SLICE_STROKE_WIDTH;
  const showEnhancedTooltip = !!enhancedTooltipData;
  const canInteract =
    typeof onSelectionChange === "function" || enhancedTooltip === true;
  const compact = containerWidth !== null && containerWidth < COMPACT_WIDTH;
  const showSliceLabels =
    labels.show && !(compact && labels.position === "outside");

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const chartContainerConfig = useMemo<ChartConfig>(
    () => ({ value: { label: "Value" } }),
    [],
  );

  const renderLabel = (labelProps: PieLabelRenderProps) => {
    const index = labelProps.index;
    const slice = slices[index];

    if (!slice || total === 0) {
      return null;
    }

    const percent = slice.row.value / total;

    if (percent < (labels.minPercent ?? 0)) {
      return null;
    }

    const centerX = Number(labelProps.cx);
    const centerY = Number(labelProps.cy);
    const innerRadius = Number(labelProps.innerRadius);
    const outerRadius = Number(labelProps.outerRadius);
    const midAngle = labelProps.midAngle ?? 0;
    const radius =
      labels.position === "inside"
        ? innerRadius + (outerRadius - innerRadius) / 2
        : outerRadius + LABEL_OFFSET;
    const x = centerX + radius * Math.cos(-midAngle * RADIAN);
    const y = centerY + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="var(--foreground)"
        textAnchor={x > centerX ? "start" : "end"}
        dominantBaseline="central">
        {formatSliceContent(
          slice,
          total,
          labels.content,
          labels.numberFormat,
          labels.maxLabelChars,
        )}
      </text>
    );
  };

  const handleSliceClick = (
    _sector: PieSectorDataItem,
    index: number,
    event: ReactMouseEvent<SVGGraphicsElement>,
  ) => {
    const row = getSelectableSliceRow(slices, index);

    if (!row) {
      return;
    }

    if (enhancedTooltip) {
      showTooltipOnClick({
        chartID,
        dataPoint: row,
        position: { x: event.clientX, y: event.clientY },
      });
    }

    if (!onSelectionChange) {
      return;
    }

    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    onSelectionChange([row], additive ? { additive: true } : undefined);
  };

  if (slices.length === 0) {
    return (
      <div
        className="flex w-full items-center justify-center text-sm text-muted-foreground"
        style={{ height: `${height || 15}svh` }}>
        Keine darstellbaren Werte
      </div>
    );
  }

  if (slices.length > maxSlices) {
    return (
      <div
        className="flex w-full flex-col items-center justify-center gap-1 px-4 text-center"
        style={{ height: `${height || 15}svh` }}>
        <span className="text-sm font-medium">
          Zu viele Segmente ({slices.length} von maximal {maxSlices})
        </span>
        <span className="text-xs text-muted-foreground">
          Kleine Werte mit groupOthers zusammenfassen.
        </span>
      </div>
    );
  }

  const centerLabel = chartConfig.centerLabel;
  const showCenterLabel =
    !!centerLabel?.show &&
    isDonutRadius(pie.innerRadius) &&
    usesDefaultCenter(pie.cx) &&
    usesDefaultCenter(pie.cy) &&
    plotArea !== null;
  const centerValue =
    centerLabel?.mode === "custom"
      ? (centerLabel.value ?? "")
      : formatValue(
          centerLabel?.mode === "selected" && selectedRows.length > 0
            ? selectedTotal
            : total,
          centerLabel?.numberFormat,
          "number",
        );
  const effectiveLegendPosition =
    compact && (legend.position === "left" || legend.position === "right")
      ? "bottom"
      : legend.position;
  const legendLayout =
    effectiveLegendPosition === "left" || effectiveLegendPosition === "right"
      ? "vertical"
      : "horizontal";
  const legendAlign =
    effectiveLegendPosition === "left"
      ? "left"
      : effectiveLegendPosition === "right"
        ? "right"
        : "center";
  const legendVerticalAlign =
    effectiveLegendPosition === "top"
      ? "top"
      : effectiveLegendPosition === "bottom"
        ? "bottom"
        : "middle";

  return (
    <ChartContainer
      ref={containerRef}
      config={chartContainerConfig}
      className="relative w-full aspect-auto"
      style={{ height: `${height || 15}svh` }}>
      <PieChart accessibilityLayer margin={margin}>
        <Pie
          data={slices}
          dataKey={(slice: RenderSlice) => slice.row.value}
          nameKey={(slice: RenderSlice) => slice.row.name}
          innerRadius={pie.innerRadius}
          outerRadius={pie.outerRadius}
          paddingAngle={pie.paddingAngle ?? 0}
          cornerRadius={pie.cornerRadius ?? 0}
          cx={pie.cx}
          cy={pie.cy}
          label={showSliceLabels ? renderLabel : false}
          labelLine={
            showSliceLabels && labels.position === "outside"
              ? (labels.leaderLines ?? true)
              : false
          }
          onClick={canInteract ? handleSliceClick : undefined}>
          {slices.map((slice, index) => {
            const selected =
              slice.kind === "source" && selectedSet.has(slice.row);

            return (
              <Cell
                key={`${slice.kind}-${index}`}
                fill={resolveSliceFill(slice, index, chartConfig)}
                fillOpacity={
                  selectionActive && !selected ? fadeOthersOpacity : 1
                }
                stroke={selected ? selectionStroke : sliceStroke}
                strokeWidth={
                  selected ? selectionStrokeWidth : sliceStrokeWidth
                }
                cursor={
                  slice.kind === "source" && canInteract
                    ? "pointer"
                    : "default"
                }
              />
            );
          })}
        </Pie>

        {tooltip.show && !showEnhancedTooltip ? (
          <ChartTooltip
            cursor={tooltip.cursor}
            content={
              <ChartTooltipContent
                hideLabel
                hideIndicator
                formatter={(value, name) => (
                  <div className="flex min-w-32 items-center justify-between gap-4">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {typeof value === "number"
                        ? formatRawTooltipValue(value, labels.numberFormat)
                        : String(value)}
                    </span>
                  </div>
                )}
              />
            }
          />
        ) : null}

        {legend.show ? (
          <Legend
            layout={legendLayout}
            align={legendAlign}
            verticalAlign={legendVerticalAlign}
            content={
              <PieLegend
                chartConfig={chartConfig}
                position={effectiveLegendPosition}
                slices={slices}
                total={total}
              />
            }
          />
        ) : null}

        <PlotAreaReporter onChange={setPlotArea} />
      </PieChart>

      {showCenterLabel && centerLabel ? (
        <div
          className="pointer-events-none absolute z-10 flex max-w-[40%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
          style={{
            left: plotArea.x + plotArea.width / 2,
            top: plotArea.y + plotArea.height / 2,
          }}>
          {centerLabel.label ? (
            <span className="text-xs text-muted-foreground">
              {centerLabel.label}
            </span>
          ) : null}
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {centerValue}
          </span>
        </div>
      ) : null}
    </ChartContainer>
  );
}

export default PieChartModule;