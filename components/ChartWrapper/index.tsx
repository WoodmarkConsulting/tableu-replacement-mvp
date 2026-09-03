"use client";

import { useMemo, useRef, useState } from "react";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { cn } from "@/lib/utils";

import {
  moduleRegistry,
  type ChartConfigs,
  type ModuleRegistryKeys,
} from "@/modules/modulRegistry";

import useFilterStore, { globalKey, tabKey } from "@/stores/filterProvider";
import useQueryTimingStore from "@/stores/queryTimingStore";

import useTooltipStore from "@/stores/tooltip";
import TooltipCard from "../TooltipCard";
import ChartState from "./ChartState";
import LassoInteractionOverlay from "./LassoInteractionOverlay";
import LassoToolbar from "./LassoToolbar";
import { fetchTimedChartData, parseMockData, toQueryParam } from "./utils";
// import useChartState from "@/hooks/useChartState";

type ModuleSchema<M extends ModuleRegistryKeys> =
  (typeof moduleRegistry)[M]["dataSchema"];

function ChartWrapper<M extends ModuleRegistryKeys>(
  props: TabsComponentConfig & {
    moduleName: M;
    height: number;
  },
) {
  type ModuleChartData<M extends ModuleRegistryKeys> = z.infer<ModuleSchema<M>>;
  type DataType = ModuleChartData<M>;

  const { moduleName, mockData, filterBindings, ...baseProps } = props;
  const { chartID, chartTitle, chartDescription } = baseProps;
  const { component, dataSchema } = moduleRegistry[moduleName];
  const tooltip = useTooltipStore((state) => state.tooltip);
  const position = useTooltipStore((state) => state.position);
  const hideTooltip = useTooltipStore((state) => state.hideTooltip);

  const interactionSurfaceRef = useRef<HTMLDivElement>(null);
  const [lassoAdapter, setLassoAdapter] =
    useState<LassoAdapter<DataType> | null>(null);
  const [lassoMode, setLassoMode] = useState<LassoMode | null>(null);
  const [zoomedContext, setZoomedContext] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    context: string;
    rows: DataType[];
  } | null>(null);

  //TODO: remove or replace with proper chart state management
  // const [filters, setFilters] = useChartState(baseProps.filterConfig);

  const filterValues = useFilterStore((state) => state.appliedValues);
  const activeTab = useFilterStore((state) => state.activeTab);
  const hasApplied = useFilterStore((state) => state.hasApplied);
  const recordTiming = useQueryTimingStore((state) => state.recordTiming);

  const params = useMemo(() => {
    const resolved: Record<string, string | number | null> = {};

    if (filterBindings) {
      for (const [dimensionId, sqlParam] of Object.entries(filterBindings)) {
        const value =
          filterValues[globalKey(dimensionId)] ??
          filterValues[tabKey(activeTab, dimensionId)];

        resolved[sqlParam] = toQueryParam(value);
      }
    }

    return resolved;
  }, [filterBindings, filterValues, activeTab]);

  const lasso: LassoController<DataType> = {
    mode: lassoMode,
    registerAdapter: setLassoAdapter,
  };

  const toggleLassoMode = (nextMode: LassoMode) => {
    hideTooltip();
    setLassoMode((currentMode) => (currentMode === nextMode ? null : nextMode));
  };

  const resetZoom = () => {
    lassoAdapter?.resetZoom?.();
    setZoomedContext(null);
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
    enabled: parsedMockData === undefined && hasApplied,
    initialData: parsedMockData,
  });

  const zoomContext = `${dataUpdatedAt}:${JSON.stringify(baseProps.chartConfig)}`;
  const hasZoom = zoomedContext === zoomContext;
  const selectedRows =
    selection?.context === zoomContext ? selection.rows : ([] as DataType[]);

  const handleSelectionChange = (
    rows: DataType[],
    options?: SelectionChangeOptions,
  ) => {
    setSelection((prev) => {
      const base = prev?.context === zoomContext ? prev.rows : [];

      if (!options?.additive) {
        return { context: zoomContext, rows };
      }

      // Additive click selection: toggle each clicked row (by identity) against
      // the current selection so repeated clicks accumulate or remove rows.
      const next = new Set(base);
      for (const row of rows) {
        if (next.has(row)) {
          next.delete(row);
        } else {
          next.add(row);
        }
      }

      return { context: zoomContext, rows: [...next] };
    });
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
            mode={lassoMode}
            hasZoom={hasZoom}
            onModeChange={toggleLassoMode}
            onResetZoom={resetZoom}
          />
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
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

        {hasApplied && (isLoading || isFetching) ? (
          <ChartState height={props.height}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
            </div>
          </ChartState>
        ) : null}

        {isError ? (
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

        {hasApplied &&
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

        {!isLoading && !isFetching && !isError && chartData.length > 0 ? (
          <div ref={interactionSurfaceRef} className="relative">
            <Module
              key={zoomContext}
              {...baseProps}
              chartData={isError ? [] : chartData}
              error={error}
              isLoading={isLoading}
              isFetching={isFetching}
              isError={isError}
              selectedRows={selectedRows}
              onSelectionChange={handleSelectionChange}
              lasso={lasso}
            />

            <LassoInteractionOverlay
              mode={lassoMode}
              adapter={lassoAdapter}
              surfaceRef={interactionSurfaceRef}
              onSelectionChange={handleSelectionChange}
              onZoomApplied={() => setZoomedContext(zoomContext)}
            />
          </div>
        ) : null}

        <TooltipCard tooltip={tooltip} position={position} />
      </CardContent>
    </Card>
  );
}

export default ChartWrapper;
