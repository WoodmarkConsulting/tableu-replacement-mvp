"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

import { Spinner } from "@/components/ui/spinner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  ArrowRightCircle,
  ExternalLink,
  Eye,
  ListFilter,
  XCircle,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { cn } from "@/lib/utils";
import {
  type ConnectionFilters,
  type ConnectionFilterValue,
} from "@/stores/chartConnectionsStore";

import {
  moduleRegistry,
  type ChartConfigs,
  type ModuleRegistryKeys,
} from "@/modules/modulRegistry";

import useFilterStore, { globalKey, tabKey } from "@/stores/filterProvider";
import useChartConnectionsStore from "@/stores/chartConnectionsStore";
import useQueryTimingStore from "@/stores/queryTimingStore";

import useTooltipStore from "@/stores/tooltip";
import type { ChartQueryValue, TooltipDataPoint } from "@/app/api/utils/types";
import TooltipCard from "../TooltipCard";
import ChartState from "./ChartState";
import {
  applyResolvedConnectionFilters,
  shouldHideTooltipForInteractionLock,
} from "./connectionApplication";
import LassoInteractionOverlay from "./LassoInteractionOverlay";
import LassoToolbar from "./LassoToolbar";
import {
  fetchTimedChartData,
  fetchTooltipData,
  parseMockData,
  toQueryParam,
} from "./utils";
// import useChartState from "@/hooks/useChartState";

type ModuleSchema<M extends ModuleRegistryKeys> =
  (typeof moduleRegistry)[M]["dataSchema"];

const EMPTY_CONNECTIONS: ChartConnection[] = [];
const EMPTY_TAB_JUMPS: TabJumpConfig[] = [];

function isConnectionFilterValue(
  value: unknown,
): value is ConnectionFilterValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function getConnectionValues(value: unknown): ConnectionFilterValue[] {
  const values = Array.isArray(value) ? value : [value];

  return values.filter(isConnectionFilterValue);
}

function ChartWrapper<M extends ModuleRegistryKeys>(
  props: TabsComponentConfig & {
    moduleName: M;
    height: number;
    connections?: ChartConnection[];
    tabJumps?: TabJumpConfig[];
    chartLabels: Partial<Record<TableSchemaKey, string>>;
  },
) {
  type ModuleChartData<M extends ModuleRegistryKeys> = z.infer<ModuleSchema<M>>;
  type DataType = ModuleChartData<M>;

  const {
    moduleName,
    mockData,
    selfFetching = false,
    filterBindings,
    autoApplyConnections = false,
    lassoEnabled = true,
    connections = EMPTY_CONNECTIONS,
    tabJumps = EMPTY_TAB_JUMPS,
    chartLabels,
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
  const filtersByChart = useChartConnectionsStore(
    (state) => state.filtersByChart,
  );
  const setSourceFilters = useChartConnectionsStore(
    (state) => state.setSourceFilters,
  );
  const stageSourceFilters = useChartConnectionsStore(
    (state) => state.stageSourceFilters,
  );
  const applyPendingSourceFilters = useChartConnectionsStore(
    (state) => state.applyPendingSourceFilters,
  );
  const clearPendingSourceFilters = useChartConnectionsStore(
    (state) => state.clearPendingSourceFilters,
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
  const [resolvedConnectionFilters, setResolvedConnectionFilters] = useState<{
    context: string;
    filters: ConnectionFilters;
  } | null>(null);
  const selectionRef = useRef<typeof selection>(null);
  const contextMenuPositionRef = useRef<{ x: number; y: number } | null>(null);
  const connectionRequestRef = useRef(0);
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

  const filterValues = useFilterStore((state) => state.appliedValues);
  const activeTab = useFilterStore((state) => state.activeTab);
  const hasApplied = useFilterStore((state) => state.hasApplied);
  const dimensions = useFilterStore((state) => state.dimensions);
  const executeTabJump = useFilterStore((state) => state.executeTabJump);
  const recordTiming = useQueryTimingStore((state) => state.recordTiming);

  const matchingJumps = tabJumps.filter((jump) => jump.fromChartID === chartID);

  const incomingColumns = Array.from(
    new Set(
      connections
        .filter((connection) => connection.toChartID === chartID)
        .flatMap((connection) => connection.expectedColumns),
    ),
  );

  const outgoingConnections = connections.filter(
    (connection) => connection.fromChartID === chartID,
  );
  const outgoingChartIDs = Array.from(
    new Set(outgoingConnections.map((connection) => connection.toChartID)),
  );

  const connectionFilters = filtersByChart[chartID];

  const params: Record<string, ChartQueryValue> = {};

  if (filterBindings) {
    for (const [dimensionId, sqlParam] of Object.entries(filterBindings)) {
      const value =
        filterValues[globalKey(dimensionId)] ??
        filterValues[tabKey(activeTab, dimensionId)];

      params[sqlParam] = toQueryParam(value);
    }
  }

  for (const column of incomingColumns) {
    const values = connectionFilters?.[column];

    params[column] =
      connectionFilters && Object.hasOwn(connectionFilters, column)
        ? (values ?? [])
        : null;
  }

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
    enabled: !selfFetching && parsedMockData === undefined && hasApplied,
    initialData: parsedMockData,
  });

  const zoomContext = `${dataUpdatedAt}:${JSON.stringify(baseProps.chartConfig)}`;
  const hasZoom = zoomedContext === zoomContext;
  const selectedRows =
    selection?.context === zoomContext ? selection.rows : ([] as DataType[]);
  const selectedConnectionFilters =
    resolvedConnectionFilters?.context === zoomContext
      ? resolvedConnectionFilters.filters
      : null;

  useEffect(() => {
    connectionRequestRef.current += 1;
    selectionRef.current = null;

    if (connections.some((connection) => connection.fromChartID === chartID)) {
      setSourceFilters(chartID, {});
    }
  }, [chartID, connections, setSourceFilters, zoomContext]);

  useEffect(
    () => () => {
      connectionRequestRef.current += 1;
      setSourceFilters(chartID, {});
    },
    [chartID, setSourceFilters],
  );

  const resolveConnectionFilters = async (rows: DataType[]) => {
    if (outgoingConnections.length === 0) {
      setResolvedConnectionFilters(null);
      return;
    }

    const requestID = ++connectionRequestRef.current;

    if (rows.length === 0) {
      setResolvedConnectionFilters(null);

      if (autoApplyConnections) {
        clearPendingSourceFilters();
        setSourceFilters(chartID, {});
      } else {
        stageSourceFilters(chartID, {});
      }
      return;
    }

    setResolvedConnectionFilters(null);
    clearPendingSourceFilters();

    try {
      const tooltipResult = await fetchTooltipData(
        chartID,
        rows as TooltipDataPoint[],
      );

      if (requestID !== connectionRequestRef.current) {
        return;
      }

      const nextFilters: ConnectionFilters = {};

      for (const connection of outgoingConnections) {
        const targetFilters = (nextFilters[connection.toChartID] ??= {});

        for (const column of connection.expectedColumns) {
          const values = tooltipResult.dataPoint.flatMap((dataPoint) =>
            getConnectionValues(dataPoint[column]),
          );

          targetFilters[column] = Array.from(new Set(values));
        }
      }

      setResolvedConnectionFilters({
        context: zoomContext,
        filters: nextFilters,
      });
      applyResolvedConnectionFilters({
        autoApply: autoApplyConnections,
        sourceChartID: chartID,
        filters: nextFilters,
        setSourceFilters,
        stageSourceFilters,
      });
    } catch (connectionError) {
      if (requestID !== connectionRequestRef.current) {
        return;
      }

      setResolvedConnectionFilters(null);
      clearPendingSourceFilters();
      console.error(
        `Failed to resolve chart connections for "${chartID}":`,
        connectionError,
      );
    }
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
    void resolveConnectionFilters(nextRows);
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

    if (selectedConnectionFilters) {
      stageSourceFilters(chartID, selectedConnectionFilters);
    }
  };

  const clearSelection = () => {
    handleSelectionChange([]);

    if (useTooltipStore.getState().chartID === chartID) {
      hideTooltip();
    }
  };

  const applyConnectionToChart = (targetChartID: TableSchemaKey) => {
    const targetFilters = selectedConnectionFilters?.[targetChartID];

    if (!targetFilters) {
      return;
    }

    stageSourceFilters(chartID, { [targetChartID]: targetFilters });
    applyPendingSourceFilters();
  };

  const canExecuteJump = (jump: TabJumpConfig, rows: DataType[]) => {
    if (rows.length === 0) {
      return false;
    }

    for (const mapping of jump.mappings) {
      const raw = rows.map(
        (r) => (r as Record<string, unknown>)[mapping.sourceField],
      );
      if (raw.every((v) => v === undefined)) {
        return false;
      }
      if (
        raw.some(
          (v) =>
            v != null &&
            typeof v !== "string" &&
            typeof v !== "number" &&
            typeof v !== "boolean",
        )
      ) {
        return false;
      }

      const uniqueValues = Array.from(new Set(raw.filter((v) => v != null)));
      if (uniqueValues.length === 0) {
        return false;
      }

      const targetDim = dimensions.find(
        (d) =>
          d.id === mapping.targetDimensionId &&
          d.scope === "tab" &&
          d.tab === jump.targetTab,
      );
      if (!targetDim) {
        return false;
      }

      const hasGlobalShadow = dimensions.some(
        (d) => d.id === mapping.targetDimensionId && d.scope === "global",
      );
      if (hasGlobalShadow) {
        return false;
      }

      if (targetDim.type === "dateString" || targetDim.type === "dateRange") {
        return false;
      }

      if (targetDim.type !== "multiselect" && uniqueValues.length > 1) {
        return false;
      }
    }

    return true;
  };

  const handleTabJump = (jump: TabJumpConfig) => {
    executeTabJump(jump, selectedRows as Record<string, unknown>[], chartTitle);
  };

  const applyConnectionsToAllCharts = () => {
    if (!selectedConnectionFilters) {
      return;
    }

    stageSourceFilters(chartID, selectedConnectionFilters);
    applyPendingSourceFilters();
  };

  if (error) {
    console.error("Error fetching chart data:", error);
  }

  return (
    <Card className="h-full w-full" id={chartID}>
      <CardHeader>
        <CardTitle className={cn(chartTitle ? "" : "hidden")}>
          {chartTitle}
        </CardTitle>

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

        {!selfFetching && hasApplied && (isLoading || isFetching) ? (
          <ChartState height={props.height}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
            </div>
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
                    outgoingChartIDs.length === 0 ||
                    selectedRows.length === 0 ||
                    !selectedConnectionFilters
                  }>
                  <ListFilter />
                  Verlinktes Diagramm filtern
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-64">
                  <ContextMenuItem onClick={applyConnectionsToAllCharts}>
                    <ListFilter />
                    Alle filtern
                  </ContextMenuItem>
                  <ContextMenuSeparator />

                  {outgoingChartIDs.map((targetChartID) => (
                    <ContextMenuItem
                      key={targetChartID}
                      disabled={!selectedConnectionFilters?.[targetChartID]}
                      onClick={() => applyConnectionToChart(targetChartID)}>
                      {chartLabels[targetChartID] ?? targetChartID}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>

              {matchingJumps.length === 1 ? (
                <ContextMenuItem
                  disabled={!canExecuteJump(matchingJumps[0], selectedRows)}
                  onClick={() => handleTabJump(matchingJumps[0])}>
                  <ExternalLink className="size-4 mr-2" />
                  {matchingJumps[0].label ??
                    `Selektion in "${matchingJumps[0].targetTab}" ansehen`}
                </ContextMenuItem>
              ) : null}

              {matchingJumps.length > 1 ? (
                <ContextMenuSub>
                  <ContextMenuSubTrigger disabled={selectedRows.length === 0}>
                    <ArrowRightCircle className="size-4 mr-2" />
                    Auf Tab springen
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-64">
                    {matchingJumps.map((jump, index) => (
                      <ContextMenuItem
                        key={`${jump.targetTab}:${index}`}
                        disabled={!canExecuteJump(jump, selectedRows)}
                        onClick={() => handleTabJump(jump)}>
                        {jump.label ?? jump.targetTab}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              ) : null}
            </ContextMenuContent>
          </ContextMenu>
        ) : null}

        {tooltipChartID === chartID ? (
          <TooltipCard
            tooltip={tooltip}
            position={position}
            amountOfChartConnections={outgoingConnections.length}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export default ChartWrapper;
