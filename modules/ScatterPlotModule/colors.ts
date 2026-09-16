export const SCATTER_POINT_PALETTE = [
  "#1d4ed8",
  "#b91c1c",
  "#047857",
  "#a21caf",
  "#b45309",
  "#0e7490",
  "#4338ca",
  "#be123c",
] as const;

export function getAutomaticColorIndex(
  value: unknown,
  colorCount: number,
): number {
  if (colorCount <= 1) {
    return 0;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? Math.abs(Math.trunc(numericValue)) % colorCount
    : 0;
}
