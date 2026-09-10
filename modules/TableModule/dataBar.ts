import type { TableRowData } from "./chartDataSchema";
import { getColumnValueKey } from "./format";

type ColumnConfig = TableChartConfig["columns"][number];

export type BarDomain = { min: number; max: number };

export type BarGeometry = {
  leftPct: number;
  widthPct: number;
  color: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolves the databar domain for a column. Uses the explicit `{ min, max }` when both
 * are set, otherwise derives it from the column values. Auto-derived domains always
 * include zero so bars anchor correctly.
 */
export function resolveDomain(
  column: ColumnConfig,
  flatRows: TableRowData[],
): BarDomain {
  const dataBar = column.dataBar;

  if (dataBar?.min !== undefined && dataBar?.max !== undefined) {
    return { min: dataBar.min, max: dataBar.max };
  }

  const includeChildren = dataBar?.includeChildrenInDomain ?? true;
  const source = includeChildren
    ? flatRows
    : flatRows.filter((row) => row.parentId === null);

  const key = getColumnValueKey(column);
  const values = source
    .map((row) => row.values[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) {
    return { min: 0, max: 1 };
  }

  return {
    min: dataBar?.min ?? Math.min(0, ...values),
    max: dataBar?.max ?? Math.max(0, ...values),
  };
}

/**
 * Computes bar placement for a value within a domain. Positive-only domains render a
 * left-anchored bar; diverging domains (spanning zero) anchor at the zero position.
 */
export function computeBarGeometry(
  value: number,
  domain: BarDomain,
  column: ColumnConfig,
): BarGeometry | null {
  const dataBar = column.dataBar;

  if (!dataBar) {
    return null;
  }

  const positiveColor = dataBar.positiveColor;
  const negativeColor = dataBar.negativeColor ?? positiveColor;

  if (domain.min >= 0) {
    const denominator = domain.max <= 0 ? 1 : domain.max;
    const widthPct = clamp((value / denominator) * 100, 0, 100);

    return { leftPct: 0, widthPct, color: positiveColor };
  }

  const range = domain.max - domain.min || 1;
  const zeroFraction = clamp((0 - domain.min) / range, 0, 1);
  const valueFraction = clamp((value - domain.min) / range, 0, 1);

  if (value >= 0) {
    return {
      leftPct: zeroFraction * 100,
      widthPct: Math.max(0, (valueFraction - zeroFraction) * 100),
      color: positiveColor,
    };
  }

  return {
    leftPct: valueFraction * 100,
    widthPct: Math.max(0, (zeroFraction - valueFraction) * 100),
    color: negativeColor,
  };
}
