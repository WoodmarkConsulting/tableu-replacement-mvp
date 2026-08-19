"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import type { ChartWrapperInjectedProps } from "@/types/baseChart";
import { LineChartData } from "./chartDataSchema";

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

type Props = ChartWrapperInjectedProps<LineChartData, LineChartConfig>;

function LineChartModule(props: Props) {
  const { chartConfig, chartData, height } = props;

  const { xAxis, yAxis, grid, tooltip, legend, margin, lines } = chartConfig;

  const dataConfig = useMemo(() => createChartContainerConfig(lines), [lines]);

  const rechartsData = useMemo(
    () => createRechartsData(chartData, lines),
    [chartData, lines],
  );

  return (
    <ChartContainer
      config={dataConfig}
      className="w-full aspect-auto"
      style={{
        height: `${height || 15}svh`,
      }}>
      <ComposedChart accessibilityLayer data={rechartsData} margin={margin}>
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
          domain={["dataMin", "dataMax"]}
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

        {tooltip.show && (
          <ChartTooltip
            cursor={tooltip.cursor}
            content={<ChartTooltipContent />}
          />
        )}

        {legend.show && <Legend />}

        {lines.map((line) => {
          const dataKey = getSeriesKey(line.seriesIndex);

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
              <Area
                key={dataKey}
                {...commonProps}
                fill={line.fill.color}
                fillOpacity={line.fill.opacity}
              />
            );
          }

          return <Line key={dataKey} {...commonProps} fill="none" />;
        })}
      </ComposedChart>
    </ChartContainer>
  );
}

export default LineChartModule;
