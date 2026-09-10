"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";

import type { CardData } from "./chartDataSchema";

type Props = ChartWrapperInjectedProps<CardData, CardChartConfig>;

const ALIGN_CLASS: Record<
  NonNullable<CardChartConfig["align"]>,
  string
> = {
  start: "items-start text-left",
  center: "items-center text-center",
  end: "items-end text-right",
};

function formatValue(value: number, config: CardChartConfig): string {
  const locale = config.locale ?? "de-DE";
  const decimals = config.decimals ?? 0;

  switch (config.format) {
    case "compact":
      return new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: decimals,
      }).format(value);

    case "percent":
      return new Intl.NumberFormat(locale, {
        style: "percent",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);

    case "currency":
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: config.currency ?? "EUR",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);

    case "number":
    default:
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
  }
}

function CardModule(props: Props) {
  const { chartConfig, chartData, height } = props;

  const row = chartData[0];
  const label = chartConfig.label ?? row?.label ?? "";

  const displayValue = useMemo(() => {
    if (!row || row.value === null || row.value === undefined) {
      return "–";
    }

    const formatted = formatValue(row.value, chartConfig);

    return `${chartConfig.prefix ?? ""}${formatted}${chartConfig.suffix ?? ""}`;
  }, [row, chartConfig]);

  return (
    <div
      className={cn(
        "flex w-full flex-col justify-center gap-2 p-4",
        ALIGN_CLASS[chartConfig.align ?? "center"],
      )}
      style={{ height: `${height}svh` }}>
      <span className="text-sm font-medium text-muted-foreground">
        {label}
      </span>
      <span className="text-4xl font-semibold tabular-nums tracking-tight">
        {displayValue}
      </span>
    </div>
  );
}

export default CardModule;
