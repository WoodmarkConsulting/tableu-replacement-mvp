import type { ConnectionFilters } from "@/stores/chartConnectionsStore";

type ConnectionFilterWriter = (
  sourceChartID: string,
  filters: ConnectionFilters,
) => void;

type ApplyResolvedConnectionFiltersOptions = {
  autoApply: boolean;
  sourceChartID: string;
  filters: ConnectionFilters;
  setSourceFilters: ConnectionFilterWriter;
  stageSourceFilters: ConnectionFilterWriter;
};

export function applyResolvedConnectionFilters({
  autoApply,
  sourceChartID,
  filters,
  setSourceFilters,
  stageSourceFilters,
}: ApplyResolvedConnectionFiltersOptions): void {
  stageSourceFilters(sourceChartID, filters);

  if (autoApply) {
    setSourceFilters(sourceChartID, filters);
  }
}

export function shouldHideTooltipForInteractionLock(
  locked: boolean,
  chartID: string,
  tooltipChartID: string | null,
): boolean {
  return locked && tooltipChartID === chartID;
}
