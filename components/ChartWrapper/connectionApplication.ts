export function shouldHideTooltipForInteractionLock(
  locked: boolean,
  chartID: string,
  tooltipChartID: string | null,
): boolean {
  return locked && tooltipChartID === chartID;
}
