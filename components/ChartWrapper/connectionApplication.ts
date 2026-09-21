import type {
  TooltipDataPoint,
  TooltipPathResponse,
} from "@/app/api/utils/types";
import { resolveActionContributions } from "@/lib/filters/actions";

export function shouldHideTooltipForInteractionLock(
  locked: boolean,
  chartID: string,
  tooltipChartID: string | null,
): boolean {
  return locked && tooltipChartID === chartID;
}

export function handleChartContextSync(params: {
  chartID: string;
  zoomContext: string;
  appliedContextRef: { current: string | null };
  connectionRequestRef: { current: number };
  outgoingActions: ChartAction[];
  clearActionSource: (chartID: string) => void;
  onInvalidateSelection?: () => void;
}): boolean {
  if (params.appliedContextRef.current === params.zoomContext) {
    return false;
  }

  const isFirstRun = params.appliedContextRef.current === null;
  params.appliedContextRef.current = params.zoomContext;

  if (isFirstRun) {
    return false;
  }

  params.connectionRequestRef.current += 1;
  params.onInvalidateSelection?.();

  if (params.outgoingActions.length > 0) {
    params.clearActionSource(params.chartID);
  }
  return true;
}

export interface ResolveChartActionsParams<T = Record<string, unknown>> {
  chartID: string;
  zoomContext: string;
  dimensions: FilterDimension[];
  outgoingActions: ChartAction[];
  rows: T[];
  fetchTooltip: (
    chartID: string,
    dataPoints: TooltipDataPoint[],
  ) => Promise<TooltipPathResponse>;
  connectionRequestRef: { current: number };
  setResolvedConnectionContributions: (
    val: { context: string; contributions: FilterContribution[] } | null,
  ) => void;
  stagePendingAction: (
    chartID: string,
    contributions: FilterContribution[],
  ) => void;
  clearPendingAction: (chartID: string) => void;
  applyActionContributions: (
    chartID: string,
    contributions: FilterContribution[],
    actionIds: string[],
  ) => void;
  clearActionSource: (chartID: string, actionIds?: string[]) => void;
}

export async function resolveChartActions<T = Record<string, unknown>>({
  chartID,
  zoomContext,
  dimensions,
  outgoingActions,
  rows,
  fetchTooltip,
  connectionRequestRef,
  setResolvedConnectionContributions,
  stagePendingAction,
  clearPendingAction,
  applyActionContributions,
  clearActionSource,
}: ResolveChartActionsParams<T>): Promise<void> {
  if (outgoingActions.length === 0) {
    setResolvedConnectionContributions(null);
    return;
  }

  const requestID = ++connectionRequestRef.current;

  if (rows.length === 0) {
    setResolvedConnectionContributions(null);
    clearPendingAction(chartID);
    const autoActionIds = outgoingActions
      .filter((action) => action.trigger === "auto")
      .map((action) => action.id);
    if (autoActionIds.length > 0) {
      clearActionSource(chartID, autoActionIds);
    }
    return;
  }

  setResolvedConnectionContributions(null);
  clearPendingAction(chartID);

  // 1. Resolve clientRow actions synchronously
  const clientActions = outgoingActions.filter(
    (action) => action.sourceResolution === "clientRow",
  );
  const clientContributions: FilterContribution[] = [];
  const autoClientActionIds: string[] = [];

  for (const action of clientActions) {
    const contribs = resolveActionContributions(
      dimensions,
      action,
      rows as Record<string, unknown>[],
    );
    if (contribs) {
      clientContributions.push(...contribs);
      if (action.trigger === "auto") {
        autoClientActionIds.push(action.id);
      }
    }
  }

  // 2. Resolve tooltipLookup actions asynchronously
  const tooltipActions = outgoingActions.filter(
    (action) => action.sourceResolution === "tooltipLookup",
  );

  const allNextContributions = [...clientContributions];
  const autoActionIds = [...autoClientActionIds];

  if (tooltipActions.length > 0) {
    try {
      const tooltipResult = await fetchTooltip(
        chartID,
        rows as TooltipDataPoint[],
      );

      if (requestID !== connectionRequestRef.current) {
        return;
      }

      for (const action of tooltipActions) {
        const contribs = resolveActionContributions(
          dimensions,
          action,
          tooltipResult.dataPoint as Record<string, unknown>[],
        );
        if (contribs) {
          allNextContributions.push(...contribs);
          if (action.trigger === "auto") {
            autoActionIds.push(action.id);
          }
        }
      }
    } catch (connectionError) {
      if (requestID !== connectionRequestRef.current) {
        return;
      }
      console.error(
        `Failed to resolve chart actions for "${chartID}":`,
        connectionError,
      );
    }
  }

  if (requestID !== connectionRequestRef.current) {
    return;
  }

  if (allNextContributions.length > 0) {
    setResolvedConnectionContributions({
      context: zoomContext,
      contributions: allNextContributions,
    });
    stagePendingAction(chartID, allNextContributions);

    if (autoActionIds.length > 0) {
      const autoActionSet = new Set(autoActionIds);
      applyActionContributions(
        chartID,
        allNextContributions.filter(
          (contribution) =>
            "actionId" in contribution.source &&
            autoActionSet.has(contribution.source.actionId),
        ),
        autoActionIds,
      );
    }
  }
}
