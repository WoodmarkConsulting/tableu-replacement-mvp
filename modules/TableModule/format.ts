import { format as formatDateFns } from "date-fns";
import { de } from "date-fns/locale";

import type { TableCellValue } from "./chartDataSchema";

type ColumnConfig = TableChartConfig["columns"][number];

const LOCALE = "de-DE";

function toNumber(value: TableCellValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function formatNumber(value: number, column: ColumnConfig): string {
  const { format } = column;

  return new Intl.NumberFormat(LOCALE, {
    notation: format?.notation === "compact" ? "compact" : "standard",
    minimumFractionDigits: format?.minFractionDigits,
    maximumFractionDigits: format?.maxFractionDigits,
  }).format(value);
}

function formatPercent(value: number, column: ColumnConfig): string {
  const scale = column.format?.percentScale ?? "fraction";
  const fraction = scale === "value" ? value / 100 : value;

  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    minimumFractionDigits: column.format?.minFractionDigits,
    maximumFractionDigits: column.format?.maxFractionDigits ?? 1,
  }).format(fraction);
}

function formatCurrency(value: number, column: ColumnConfig): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: column.format?.currency ?? "EUR",
    notation: column.format?.notation === "compact" ? "compact" : "standard",
    minimumFractionDigits: column.format?.minFractionDigits,
    maximumFractionDigits: column.format?.maxFractionDigits,
  }).format(value);
}

function formatDateValue(value: number, column: ColumnConfig): string {
  return formatDateFns(new Date(value), column.format?.datePattern ?? "dd.MM.yyyy", {
    locale: de,
  });
}

/**
 * Formats a scalar cell value to a display string. Returns `null` when the value is
 * empty so the caller can render the configured placeholder. Booleans are handled by
 * the cell renderer, not here.
 */
export function formatCellValue(
  value: TableCellValue | undefined,
  column: ColumnConfig,
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  switch (column.type) {
    case "number": {
      const numeric = toNumber(value);
      return numeric === null ? String(value) : formatNumber(numeric, column);
    }
    case "percent": {
      const numeric = toNumber(value);
      return numeric === null ? String(value) : formatPercent(numeric, column);
    }
    case "currency": {
      const numeric = toNumber(value);
      return numeric === null ? String(value) : formatCurrency(numeric, column);
    }
    case "date": {
      const numeric = toNumber(value);
      return numeric === null ? String(value) : formatDateValue(numeric, column);
    }
    case "boolean":
    case "string":
    default:
      return String(value);
  }
}

export function getColumnValueKey(column: ColumnConfig): string {
  return column.valueKey ?? column.id;
}

export function isNumericType(type: ColumnConfig["type"]): boolean {
  return type === "number" || type === "percent" || type === "currency";
}
