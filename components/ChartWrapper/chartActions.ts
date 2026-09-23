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
  actionRequestRef: { current: number };
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

  params.actionRequestRef.current += 1;
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
  actionRequestRef: { current: number };
  setResolvedActionContributions: (
    val: {
      context: string;
      contributions: FilterContribution[];
      failed: boolean;
    } | null,
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
  actionRequestRef,
  setResolvedActionContributions,
  stagePendingAction,
  clearPendingAction,
  applyActionContributions,
  clearActionSource,
}: ResolveChartActionsParams<T>): Promise<void> {
  if (outgoingActions.length === 0) {
    setResolvedActionContributions(null);
    return;
  }

  const requestID = ++actionRequestRef.current;

  if (rows.length === 0) {
    setResolvedActionContributions(null);
    clearPendingAction(chartID);
    const autoActionIds = outgoingActions
      .filter((action) => action.trigger === "auto")
      .map((action) => action.id);
    if (autoActionIds.length > 0) {
      clearActionSource(chartID, autoActionIds);
    }
    return;
  }

  setResolvedActionContributions(null);
  clearPendingAction(chartID);

  // 1. Resolve clientRow actions synchronously and publish them before the
  // tooltip roundtrip. A sibling tooltipLookup must not block the menu or the
  // tooltip footer from applying an already-known in-memory action.
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

  if (clientContributions.length > 0) {
    setResolvedActionContributions({
      context: zoomContext,
      contributions: clientContributions,
      failed: false,
    });
    stagePendingAction(chartID, clientContributions);

    // Apply auto clientRow actions immediately: a sibling tooltipLookup must not
    // gate an already-known in-memory action on the warehouse roundtrip.
    if (autoClientActionIds.length > 0) {
      const autoClientSet = new Set(autoClientActionIds);
      applyActionContributions(
        chartID,
        clientContributions.filter(
          (contribution) =>
            "actionId" in contribution.source &&
            autoClientSet.has(contribution.source.actionId),
        ),
        autoClientActionIds,
      );
    }
  }

  // 2. Resolve tooltipLookup actions asynchronously
  const tooltipActions = outgoingActions.filter(
    (action) => action.sourceResolution === "tooltipLookup",
  );

  const allNextContributions = [...clientContributions];
  const tooltipAutoActionIds: string[] = [];
  let resolutionFailed = false;

  if (tooltipActions.length > 0) {
    try {
      const tooltipResult = await fetchTooltip(
        chartID,
        rows as TooltipDataPoint[],
      );

      if (requestID !== actionRequestRef.current) {
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
            tooltipAutoActionIds.push(action.id);
          }
        }
      }
    } catch (actionError) {
      if (requestID !== actionRequestRef.current) {
        return;
      }
      resolutionFailed = true;
      console.error(
        `Failed to resolve chart actions for "${chartID}":`,
        actionError,
      );
    }
  }

  if (requestID !== actionRequestRef.current) {
    return;
  }

  // Record the final resolution state whenever tooltipLookup work added
  // contributions or failed, so a failed roundtrip is distinguishable from an
  // in-progress one instead of leaving the menu stuck on "loading".
  if (allNextContributions.length > clientContributions.length || resolutionFailed) {
    setResolvedActionContributions({
      context: zoomContext,
      contributions: allNextContributions,
      failed: resolutionFailed,
    });

    if (allNextContributions.length > 0) {
      stagePendingAction(chartID, allNextContributions);
    }

    if (tooltipAutoActionIds.length > 0) {
      const tooltipAutoSet = new Set(tooltipAutoActionIds);
      applyActionContributions(
        chartID,
        allNextContributions.filter(
          (contribution) =>
            "actionId" in contribution.source &&
            tooltipAutoSet.has(contribution.source.actionId),
        ),
        tooltipAutoActionIds,
      );
    }
  }
}
