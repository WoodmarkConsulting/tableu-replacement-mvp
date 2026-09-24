"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/shallow";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

import { Spinner } from "@/components/ui/spinner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  ExternalLink,
  Eye,
  ListFilter,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  contributionAppliesTo,
  isEmptyFilterValue,
} from "@/lib/filters/contributions";
import { resolveChartFilters } from "@/lib/filters/resolveChartFilters";
import {
  canExecuteAction,
  resolveActionContributions,
} from "@/lib/filters/actions";
import { cn } from "@/lib/utils";

import {
  moduleRegistry,
  type ChartConfigs,
  type ModuleRegistryKeys,
} from "@/modules/modulRegistry";

import useFilterStore from "@/stores/filterProvider";
import useQueryTimingStore from "@/stores/queryTimingStore";

import useTooltipStore from "@/stores/tooltip";
import type { ChartQueryValue, TooltipDataPoint } from "@/app/api/utils/types";
import TooltipCard from "../TooltipCard";
import ChartState from "./ChartState";
import {
  handleChartContextSync,
  resolveChartActions,
  shouldHideTooltipForInteractionLock,
} from "./chartActions";
import LassoInteractionOverlay from "./LassoInteractionOverlay";
import LassoToolbar from "./LassoToolbar";
import {
  fetchTimedChartData,
  fetchTooltipData,
  parseMockData,
} from "./utils";
// import useChartState from "@/hooks/useChartState";

type ModuleSchema<M extends ModuleRegistryKeys> =
  (typeof moduleRegistry)[M]["dataSchema"];

const EMPTY_ACTIONS: ChartAction[] = [];

function ChartWrapper<M extends ModuleRegistryKeys>(
  props: TabsComponentConfig & {
    moduleName: M;
    height: number;
    actions?: ChartAction[];
    chartLabels: Partial<Record<TableSchemaKey, string>>;
    chartTabs?: Partial<Record<TableSchemaKey, string>>;
  },
) {
  type ModuleChartData<M extends ModuleRegistryKeys> = z.infer<ModuleSchema<M>>;
  type DataType = ModuleChartData<M>;

  const {
    moduleName,
    mockData,
    selfFetching = false,
    filterBindings,
    lassoEnabled = true,
    actions = EMPTY_ACTIONS,
    chartLabels,
    chartTabs = {},
    ...baseProps
  } = props;
  const { chartID, chartTitle, chartDescription } = baseProps;
  const { component, dataSchema } = moduleRegistry[moduleName];
  const tooltipChartID = useTooltipStore((state) => state.chartID);
  const tooltip = useTooltipStore((state) => state.tooltip);
  const position = useTooltipStore((state) => state.position);
  const hideTooltip = useTooltipStore((state) => state.hideTooltip);
  const showTooltipOnClick = useTooltipStore(
    (state) => state.showTooltipOnClick,
  );

  const interactionSurfaceRef = useRef<HTMLDivElement>(null);
  const chartIDRef = useRef(chartID);
  const [lassoAdapter, setLassoAdapter] =
    useState<LassoAdapter<DataType> | null>(null);
  const [lassoMode, setLassoMode] = useState<LassoMode | null>(null);
  const [isInteractionLocked, setIsInteractionLocked] = useState(false);
  const [zoomedContext, setZoomedContext] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    context: string;
    rows: DataType[];
  } | null>(null);
  const [resolvedActionContributions, setResolvedActionContributions] = useState<{
    context: string;
    contributions: FilterContribution[];
    failed: boolean;
  } | null>(null);
  const selectionRef = useRef<typeof selection>(null);
  const contextMenuPositionRef = useRef<{ x: number; y: number } | null>(null);
  const actionRequestRef = useRef(0);
  const appliedContextRef = useRef<string | null>(null);
  const registerLassoAdapter = useCallback(
    (adapter: LassoAdapter<DataType> | null) => {
      if (!lassoEnabled) {
        return;
      }

      setLassoAdapter(adapter);

      if (adapter?.selectionDisabled) {
        setLassoMode((currentMode) =>
          currentMode === "selection" ? null : currentMode,
        );
      }
    },
    [lassoEnabled],
  );
  const effectiveLassoMode =
    lassoMode === "selection" && lassoAdapter?.selectionDisabled
      ? null
      : lassoMode;

  useEffect(() => {
    chartIDRef.current = chartID;
  }, [chartID]);

  //TODO: remove or replace with proper chart state management
  // const [filters, setFilters] = useChartState(baseProps.filterConfig);

  const activeTab = useFilterStore((state) => state.activeTab);
  const applicableContributions = useFilterStore(
    useShallow((state) =>
      Object.values(state.appliedContributions).filter(
        (contribution) =>
          filterBindings?.[contribution.dimensionId] !== undefined &&
          contributionAppliesTo(contribution, {
            chartID,
            tab: state.activeTab,
          }),
      ),
    ),
  );
  const hasApplied = useFilterStore((state) => state.hasApplied);
  const dimensions = useFilterStore((state) => state.dimensions);
  // Applied, in-scope filters this chart does not bind: its data ignores them.
  const unappliedFilterLabels = useFilterStore(
    useShallow((state) => {
      const dimensionsById = new Map(
        state.dimensions.map((dimension) => [dimension.id, dimension]),
      );
      const labels = new Set<string>();

      for (const contribution of Object.values(state.appliedContributions)) {
        if (filterBindings?.[contribution.dimensionId] !== undefined) {
          continue;
        }
        if (isEmptyFilterValue(contribution.value)) {
          continue;
        }
        if (
          !contributionAppliesTo(contribution, {
            chartID,
            tab: state.activeTab,
          })
        ) {
          continue;
        }

        const dimension = dimensionsById.get(contribution.dimensionId);
        labels.add(dimension?.label ?? contribution.dimensionId);
      }

      return Array.from(labels).sort();
    }),
  );
  const executeAction = useFilterStore((state) => state.executeAction);
  const stagePendingAction = useFilterStore(
    (state) => state.stagePendingAction,
  );
  const applyActionContributions = useFilterStore(
    (state) => state.applyActionContributions,
  );
  const clearPendingAction = useFilterStore(
    (state) => state.clearPendingAction,
  );
  const clearActionSource = useFilterStore(
    (state) => state.clearActionSource,
  );
  const removeContribution = useFilterStore(
    (state) => state.removeContribution,
  );
  const recordTiming = useQueryTimingStore((state) => state.recordTiming);

  const outgoingActions = useMemo(
    () => actions.filter((action) => action.fromChartID === props.chartID),
    [actions, props.chartID],
  );

  const manualOutgoingActions = useMemo(
    () => outgoingActions.filter((action) => (action.trigger ?? "manual") === "manual"),
    [outgoingActions],
  );

  // Read from `props` directly: the destructured copies come from a rest object
  // that React Compiler cannot prove is unmodified, which breaks this memo.
  const resolvedFilters = useMemo(
    () =>
      resolveChartFilters({
        chartID: props.chartID,
        tab: activeTab,
        dimensions,
        contributions: applicableContributions,
        bindings: props.filterBindings,
      }),
    [
      props.chartID,
      activeTab,
      dimensions,
      applicableContributions,
      props.filterBindings,
    ],
  );
  const params: Record<string, ChartQueryValue> = resolvedFilters.params;
  const conflictLabels = resolvedFilters.conflicts.map(
    (dimensionId) =>
      dimensions.find((dimension) => dimension.id === dimensionId)?.label ??
      dimensionId,
  );

  const handleInteractionLockChange = useCallback(
    (locked: boolean) => {
      setIsInteractionLocked(locked);

      if (
        shouldHideTooltipForInteractionLock(
          locked,
          chartIDRef.current,
          useTooltipStore.getState().chartID,
        )
      ) {
        hideTooltip();
      }
    },
    [hideTooltip],
  );

  useEffect(() => {
    const interactionSurface = interactionSurfaceRef.current;

    if (!isInteractionLocked || !interactionSurface) {
      return;
    }

    const preventBrowserZoom = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    interactionSurface.addEventListener("wheel", preventBrowserZoom, {
      capture: true,
      passive: false,
    });

    return () => {
      interactionSurface.removeEventListener("wheel", preventBrowserZoom, {
        capture: true,
      });
    };
  }, [isInteractionLocked]);

  const lasso: LassoController<DataType> = {
    mode: effectiveLassoMode,
    registerAdapter: registerLassoAdapter,
    onInteractionLockChange: handleInteractionLockChange,
    onZoomChange: (hasZoom) => setZoomedContext(hasZoom ? zoomContext : null),
  };

  const toggleLassoMode = (nextMode: LassoMode) => {
    if (nextMode === "selection" && lassoAdapter?.selectionDisabled) {
      return;
    }

    hideTooltip();
    setLassoMode((currentMode) => (currentMode === nextMode ? null : nextMode));
  };

  const resetZoom = () => {
    lassoAdapter?.resetZoom?.();
    setZoomedContext(null);
  };

  const undoZoom = () => {
    const hasPreviousZoom = lassoAdapter?.undoZoom?.() ?? false;

    setZoomedContext(hasPreviousZoom ? zoomContext : null);
  };

  const handleZoomApplied = () => {
    setZoomedContext(zoomContext);
    setLassoMode(null);
  };

  const Module = component as unknown as React.ComponentType<
    ChartWrapperInjectedProps<DataType, ChartConfigs>
  >;

  const parsedMockData = parseMockData<DataType>(
    mockData,
    dataSchema as unknown as z.ZodType<DataType>,
    chartID,
  );

  const {
    data: chartData = parsedMockData ?? [],
    isLoading,
    isFetching,
    isError,
    error,
    dataUpdatedAt,
  } = useQuery<DataType[], Error>({
    queryKey: ["chart-data", chartID, params],
    queryFn: () =>
      fetchTimedChartData(
        chartID,
        chartTitle,
        params,
        dataSchema as unknown as z.ZodType<DataType>,
        recordTiming,
      ),
    enabled:
      !selfFetching &&
      parsedMockData === undefined &&
      hasApplied &&
      !resolvedFilters.impossible,
    initialData: parsedMockData,
  });

  const zoomContext = `${dataUpdatedAt}:${JSON.stringify(baseProps.chartConfig)}`;
  const hasZoom = zoomedContext === zoomContext;
  const emptySelectedRows = useMemo(() => [] as DataType[], []);
  const selectedRows =
    selection?.context === zoomContext ? selection.rows : emptySelectedRows;
  const selectedActionContributions =
    resolvedActionContributions?.context === zoomContext &&
    resolvedActionContributions.contributions.length > 0
      ? resolvedActionContributions.contributions
      : null;
  const actionResolutionFailed =
    resolvedActionContributions?.context === zoomContext
      ? resolvedActionContributions.failed
      : false;

  // Only a genuine context change invalidates the selection. Mounting must not
  // clear it, or switching back to this chart's tab would silently drop the
  // action filters it applied to charts on another tab.
  useEffect(() => {
    handleChartContextSync({
      chartID,
      zoomContext,
      appliedContextRef,
      actionRequestRef,
      outgoingActions,
      clearActionSource,
      onInvalidateSelection: () => {
        selectionRef.current = null;
      },
    });
  }, [chartID, outgoingActions, clearActionSource, zoomContext]);

  // Applied contributions outlive the chart so cross-tab targets keep them;
  // only the in-flight request and this chart's staged action are dropped.
  useEffect(
    () => () => {
      actionRequestRef.current += 1;
      clearPendingAction(chartID);
    },
    [chartID, clearPendingAction],
  );

  const resolveActions = async (rows: DataType[]) => {
    await resolveChartActions({
      chartID,
      zoomContext,
      dimensions,
      outgoingActions,
      rows: rows as Record<string, unknown>[],
      fetchTooltip: fetchTooltipData,
      actionRequestRef,
      setResolvedActionContributions,
      stagePendingAction,
      clearPendingAction,
      applyActionContributions,
      clearActionSource,
    });
  };

  const handleSelectionChange = (
    rows: DataType[],
    options?: SelectionChangeOptions,
  ) => {
    const previousSelection = selectionRef.current;
    const base =
      previousSelection?.context === zoomContext ? previousSelection.rows : [];
    let nextRows = rows;

    if (options?.additive) {
      const next = new Set(base);

      for (const row of rows) {
        if (next.has(row)) {
          next.delete(row);
        } else {
          next.add(row);
        }
      }

      nextRows = [...next];
    }

    const nextSelection = { context: zoomContext, rows: nextRows };

    selectionRef.current = nextSelection;
    setSelection(nextSelection);
    void resolveActions(nextRows);
  };

  const handleLassoSelection = (
    rows: DataType[],
    tooltipPosition: { x: number; y: number },
  ) => {
    handleSelectionChange(rows);

    if (!baseProps.enhancedTooltip) {
      return;
    }

    showTooltipOnClick({
      chartID,
      dataPoints: rows as TooltipDataPoint[],
      position: tooltipPosition,
    });
  };

  const showSelectedTooltip = () => {
    const tooltipPosition = contextMenuPositionRef.current;

    if (
      !baseProps.enhancedTooltip ||
      selectedRows.length === 0 ||
      !tooltipPosition
    ) {
      return;
    }

    showTooltipOnClick({
      chartID,
      dataPoints: selectedRows as TooltipDataPoint[],
      position: tooltipPosition,
    });

    if (selectedActionContributions) {
      stagePendingAction(chartID, selectedActionContributions);
    }
  };

  const clearSelection = () => {
    handleSelectionChange([]);

    if (useTooltipStore.getState().chartID === chartID) {
      hideTooltip();
    }
  };

  const getExecutableActionContributions = (action: ChartAction): FilterContribution[] | null => {
    // clientRow needs no warehouse roundtrip, so it stays executable while a
    // sibling tooltipLookup on the same chart is still resolving.
    if (action.sourceResolution === "clientRow") {
      if (selectedRows.length === 0) {
        return null;
      }
      return resolveActionContributions(
        dimensions,
        action,
        selectedRows as Record<string, unknown>[],
      );
    }

    if (!selectedActionContributions) {
      return null;
    }
    const actionContribs = selectedActionContributions.filter(
      (c) => "actionId" in c.source && c.source.actionId === action.id,
    );
    return actionContribs.length > 0 ? actionContribs : null;
  };

  const getActionDisabledReason = (action: ChartAction): string | null => {
    if (selectedRows.length === 0) {
      return "Keine Auswahl";
    }
    if (action.sourceResolution === "clientRow") {
      const gate = canExecuteAction(dimensions, action, selectedRows as Record<string, unknown>[]);
      if (!gate.ok) {
        switch (gate.reason) {
          case "noSelection":
            return "Keine Auswahl";
          case "multipleValuesForSingleSelect":
            return "Mehrere Werte ausgewählt";
          case "valueLimitExceeded":
            return "Wertgrenze überschritten";
          case "nonPrimitiveField":
            return "Ungültiges Datenfeld";
          case "undrillableDimension":
            return "Nicht filterbare Dimension";
          case "unknownDimension":
            return "Unbekannte Dimension";
        }
      }
      return null;
    }
    // tooltipLookup
    if (actionResolutionFailed) {
      return "Fehler beim Laden der Werte";
    }
    if (!selectedActionContributions) {
      return "Werte werden geladen...";
    }
    const contribs = getExecutableActionContributions(action);
    if (!contribs || contribs.length === 0) {
      return "Keine übereinstimmenden Daten";
    }
    return null;
  };

  const handleExecuteAction = (action: ChartAction) => {
    const contribs = getExecutableActionContributions(action);
    if (!contribs) {
      return;
    }
    executeAction(action, contribs, chartTitle);
  };

  const currentTabActions = useMemo(() => {
    return manualOutgoingActions.filter((action) => {
      if (action.target.kind === "dashboard") {
        return false;
      }
      if (action.target.kind === "chart") {
        const targetTab = chartTabs[action.target.chartID];
        return targetTab === activeTab;
      }
      return action.target.tab === activeTab;
    });
  }, [manualOutgoingActions, chartTabs, activeTab]);

  const otherTabActions = useMemo(() => {
    return manualOutgoingActions.filter((action) => {
      if (action.target.kind === "dashboard") {
        return false;
      }
      if (action.target.kind === "chart") {
        const targetTab = chartTabs[action.target.chartID];
        return targetTab !== undefined && targetTab !== activeTab;
      }
      return action.target.tab !== activeTab;
    });
  }, [manualOutgoingActions, chartTabs, activeTab]);

  const dashboardActions = useMemo(() => {
    return manualOutgoingActions.filter(
      (action) => action.target.kind === "dashboard",
    );
  }, [manualOutgoingActions]);

  const isActionExecutable = useCallback(
    (action: ChartAction) => {
      if (action.sourceResolution === "clientRow") {
        return (
          resolveActionContributions(
            dimensions,
            action,
            selectedRows as Record<string, unknown>[],
          ) !== null
        );
      }
      if (!selectedActionContributions) {
        return false;
      }
      return selectedActionContributions.some(
        (contribution) =>
          "actionId" in contribution.source &&
          contribution.source.actionId === action.id,
      );
    },
    [dimensions, selectedActionContributions, selectedRows],
  );

  const executableCurrentTabActions = useMemo(() => {
    return currentTabActions.filter(isActionExecutable);
  }, [currentTabActions, isActionExecutable]);

  const executableDashboardActions = useMemo(() => {
    return dashboardActions.filter(isActionExecutable);
  }, [dashboardActions, isActionExecutable]);

  const applyAllCurrentTabActions = () => {
    if (executableCurrentTabActions.length === 0) {
      return;
    }
    const allContribs = executableCurrentTabActions.flatMap(
      (action) => getExecutableActionContributions(action) ?? [],
    );
    const actionIds = executableCurrentTabActions.map((action) => action.id);
    applyActionContributions(chartID, allContribs, actionIds);
  };

  const applyAllDashboardActions = () => {
    if (executableDashboardActions.length === 0) {
      return;
    }
    const allContribs = executableDashboardActions.flatMap(
      (action) => getExecutableActionContributions(action) ?? [],
    );
    const actionIds = executableDashboardActions.map((action) => action.id);
    applyActionContributions(chartID, allContribs, actionIds);
  };

  if (error) {
    console.error("Error fetching chart data:", error);
  }

  return (
    <Card className="h-full w-full" id={chartID}>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className={cn(chartTitle ? "" : "hidden")}>
            {chartTitle}
          </CardTitle>

          {hasApplied && unappliedFilterLabels.length > 0 ? (
            <TooltipProvider delay={150}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      className="inline-flex shrink-0 text-amber-500"
                      aria-label="Nicht alle aktiven Filter gelten für dieses Diagramm"
                      tabIndex={0}>
                      <TriangleAlert className="size-4" />
                    </span>
                  }
                />

                <TooltipContent>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">
                      Nicht alle aktiven Filter gelten für dieses Diagramm.
                    </span>

                    <span>
                      Ignoriert: {unappliedFilterLabels.join(", ")}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>

        <CardDescription className="sr-only">
          {chartDescription}
        </CardDescription>

        {lassoAdapter ? (
          <LassoToolbar
            adapter={lassoAdapter}
            mode={effectiveLassoMode}
            hasZoom={hasZoom}
            disabled={isInteractionLocked}
            onModeChange={toggleLassoMode}
            onUndoZoom={undoZoom}
            onResetZoom={resetZoom}
          />
        ) : null}
      </CardHeader>

      <CardContent
        className="flex flex-col gap-4"
        style={{ minHeight: `${props.height || 15}svh` }}>
        {/* TODO: REMOVE OR ENABLE FILTERS */}

        {/* {filterConfig.length > 0 && (
          <ChartFilters
            filterConfig={filterConfig}
            filters={filters}
            setFilter={setFilters}
          />
        )} */}

        {!hasApplied && parsedMockData === undefined ? (
          <ChartState height={props.height}>
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Bereit zum Abfragen</EmptyTitle>

                <EmptyDescription>
                  Passen Sie die Filter an und klicken Sie auf „Anwenden“, um
                  die Daten zu laden.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </ChartState>
        ) : null}

        {!selfFetching && hasApplied && !resolvedFilters.impossible && (isLoading || isFetching) ? (
          <ChartState height={props.height}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
            </div>
          </ChartState>
        ) : null}

        {!selfFetching && hasApplied && resolvedFilters.impossible ? (
          <ChartState height={props.height}>
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Widersprüchliche Filter</EmptyTitle>

                <EmptyDescription>
                  Die Filter für {conflictLabels.join(", ")} haben keine
                  gemeinsamen Werte.
                </EmptyDescription>
              </EmptyHeader>

              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    for (const key of resolvedFilters.conflictKeys) {
                      removeContribution(key);
                    }
                  }}>
                  Widersprüchliche Filter entfernen
                </Button>
              </EmptyContent>
            </Empty>
          </ChartState>
        ) : null}

        {!selfFetching && isError ? (
          <ChartState height={props.height}>
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Fehler beim Laden der Daten</EmptyTitle>

                <EmptyDescription>
                  {
                    "Ein unbekannter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut."
                  }
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </ChartState>
        ) : null}

        {!selfFetching &&
        hasApplied &&
        !resolvedFilters.impossible &&
        chartData.length === 0 &&
        !isLoading &&
        !isFetching &&
        !isError ? (
          <ChartState height={props.height}>
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Keine Daten verfügbar</EmptyTitle>

                <EmptyDescription>
                  Für die ausgewählten Filter sind keine Diagrammdaten
                  verfügbar.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </ChartState>
        ) : null}

        {!isLoading &&
        !isFetching &&
        !isError &&
        ((selfFetching && hasApplied) || chartData.length > 0) ? (
          <ContextMenu>
            <ContextMenuTrigger
              render={
                <div
                  ref={interactionSurfaceRef}
                  className="relative"
                  onContextMenu={(event) => {
                    contextMenuPositionRef.current = {
                      x: event.clientX,
                      y: event.clientY,
                    };
                  }}
                />
              }>
              <Module
                key={zoomContext}
                {...baseProps}
                chartData={isError ? [] : chartData}
                error={error}
                isLoading={isLoading}
                isFetching={isFetching}
                isError={isError}
                selfFetching={selfFetching}
                filterParams={params}
                selectedRows={selectedRows}
                onSelectionChange={handleSelectionChange}
                lasso={lasso}
              />

              {isInteractionLocked ? (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 z-70 cursor-wait"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                />
              ) : (
                <LassoInteractionOverlay
                  mode={effectiveLassoMode}
                  adapter={lassoAdapter}
                  surfaceRef={interactionSurfaceRef}
                  onSelectionChange={handleLassoSelection}
                  onInteractionStart={hideTooltip}
                  onZoomApplied={handleZoomApplied}
                />
              )}
            </ContextMenuTrigger>

            <ContextMenuContent className="w-64">
              <ContextMenuItem
                disabled={
                  !baseProps.enhancedTooltip || selectedRows.length === 0
                }
                onClick={showSelectedTooltip}>
                <Eye />
                Tooltip anzeigen
              </ContextMenuItem>

              <ContextMenuItem
                disabled={selectedRows.length === 0}
                onClick={clearSelection}>
                <XCircle />
                Auswahl aufheben
              </ContextMenuItem>

              <ContextMenuSeparator />

              <ContextMenuSub>
                <ContextMenuSubTrigger
                  disabled={
                    manualOutgoingActions.length === 0 ||
                    selectedRows.length === 0 ||
                    (manualOutgoingActions.every(
                      (action) => action.sourceResolution !== "clientRow",
                    ) &&
                      !selectedActionContributions)
                  }>
                  <ListFilter />
                  Filtern
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-72">
                  {currentTabActions.length > 0 ? (
                    <ContextMenuGroup>
                      <ContextMenuLabel>Auf diesem Tab</ContextMenuLabel>
                      {executableCurrentTabActions.length > 1 ? (
                        <ContextMenuItem onClick={applyAllCurrentTabActions}>
                          <ListFilter />
                          Alle filtern
                        </ContextMenuItem>
                      ) : null}

                      {currentTabActions.map((action) => {
                        const targetChartID =
                          action.target.kind === "chart"
                            ? action.target.chartID
                            : undefined;
                        const label =
                          action.label ??
                          (targetChartID
                            ? (chartLabels[targetChartID] ?? targetChartID)
                            : action.target.kind === "tab"
                              ? `Tab "${action.target.tab}"`
                              : "Diagramm filtern");
                        const disabledReason = getActionDisabledReason(action);
                        const isDisabled = disabledReason !== null;

                        return (
                          <ContextMenuItem
                            key={action.id}
                            disabled={isDisabled}
                            onClick={() => handleExecuteAction(action)}>
                            <ListFilter />
                            <span className="flex-1 truncate">{label}</span>
                            {isDisabled && selectedRows.length > 0 ? (
                              <span className="text-[10px] text-muted-foreground ml-auto pl-2">
                                ({disabledReason})
                              </span>
                            ) : null}
                          </ContextMenuItem>
                        );
                      })}
                    </ContextMenuGroup>
                  ) : null}

                  {currentTabActions.length > 0 && otherTabActions.length > 0 ? (
                    <ContextMenuSeparator />
                  ) : null}

                  {otherTabActions.length > 0 ? (
                    <ContextMenuGroup>
                      <ContextMenuLabel>Auf anderen Tabs</ContextMenuLabel>
                      {otherTabActions.map((action) => {
                        const targetTab =
                          action.target.kind === "chart"
                            ? chartTabs[action.target.chartID] ?? "Anderer Tab"
                            : action.target.kind === "tab"
                              ? action.target.tab
                              : "Anderer Tab";

                        const label =
                          action.label ??
                          (action.navigate
                            ? `Details in "${targetTab}" ansehen`
                            : action.target.kind === "chart"
                              ? `"${chartLabels[action.target.chartID] ?? action.target.chartID}" auf Tab "${targetTab}" filtern`
                              : `Auf Tab "${targetTab}" filtern`);

                        const disabledReason = getActionDisabledReason(action);
                        const isDisabled = disabledReason !== null;

                        return (
                          <ContextMenuItem
                            key={action.id}
                            disabled={isDisabled}
                            onClick={() => handleExecuteAction(action)}>
                            {action.navigate ? (
                              <ExternalLink />
                            ) : (
                              <ListFilter />
                            )}
                            <span className="flex-1 truncate">{label}</span>
                            {isDisabled && selectedRows.length > 0 ? (
                              <span className="text-[10px] text-muted-foreground ml-auto pl-2">
                                ({disabledReason})
                              </span>
                            ) : null}
                          </ContextMenuItem>
                        );
                      })}
                    </ContextMenuGroup>
                  ) : null}

                  {dashboardActions.length > 0 &&
                  (currentTabActions.length > 0 ||
                    otherTabActions.length > 0) ? (
                    <ContextMenuSeparator />
                  ) : null}

                  {dashboardActions.length > 0 ? (
                    <ContextMenuGroup>
                      <ContextMenuLabel>Dashboardweit</ContextMenuLabel>
                      {executableDashboardActions.length > 1 ? (
                        <ContextMenuItem onClick={applyAllDashboardActions}>
                          <ListFilter />
                          Alle filtern
                        </ContextMenuItem>
                      ) : null}

                      {dashboardActions.map((action) => {
                        const label =
                          action.label ??
                          `Dashboardweit filtern (${action.mappings
                            .map((mapping) => mapping.targetDimensionId)
                            .join(", ")})`;
                        const disabledReason = getActionDisabledReason(action);
                        const isDisabled = disabledReason !== null;

                        return (
                          <ContextMenuItem
                            key={action.id}
                            disabled={isDisabled}
                            onClick={() => handleExecuteAction(action)}>
                            <ListFilter />
                            <span className="flex-1 truncate">{label}</span>
                            {isDisabled && selectedRows.length > 0 ? (
                              <span className="text-[10px] text-muted-foreground ml-auto pl-2">
                                ({disabledReason})
                              </span>
                            ) : null}
                          </ContextMenuItem>
                        );
                      })}
                    </ContextMenuGroup>
                  ) : null}
                </ContextMenuSubContent>
              </ContextMenuSub>
            </ContextMenuContent>
          </ContextMenu>
        ) : null}

        {tooltipChartID === chartID ? (
          <TooltipCard
            tooltip={tooltip}
            position={position}
            executableActionCount={executableCurrentTabActions.length}
            onApplyActions={applyAllCurrentTabActions}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export default ChartWrapper;
