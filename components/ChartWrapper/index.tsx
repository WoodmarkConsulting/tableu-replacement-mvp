"use client";

import { useMemo } from "react";
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

import type { FilterValue } from "@/types/filters";
import { apiFetch } from "@/app/api/utils/apiFetch";
// import useChartState from "@/hooks/useChartState";

type ModuleSchema<M extends ModuleRegistryKeys> =
  (typeof moduleRegistry)[M]["dataSchema"];

type ChartStateProps = {
  height?: number;
  children: React.ReactNode;
};

function ChartWrapper<M extends ModuleRegistryKeys>(
  props: TabsComponentConfig & {
    moduleName: M;
    height: number;
  },
) {
  type ModuleChartData<M extends ModuleRegistryKeys> = z.infer<ModuleSchema<M>>;
  type DataType = ModuleChartData<M>;

  const { moduleName, mockData, filterBindings, drill, ...baseProps } = props;
  const { chartID, chartTitle, chartDescription } = baseProps;
  const { component, dataSchema } = moduleRegistry[moduleName];

  //TODO: remove or replace with proper chart state management
  // const [filters, setFilters] = useChartState(baseProps.filterConfig);

  const filterValues = useFilterStore((state) => state.values);
  const activeTab = useFilterStore((state) => state.activeTab);
  const dimensions = useFilterStore((state) => state.dimensions);
  const applySelection = useFilterStore((state) => state.applySelection);
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

  const handleSelectionChange = useMemo(() => {
    if (!drill) {
      return undefined;
    }

    return (rows: DataType[]) => {
      const entries: Record<string, FilterValue> = {};

      for (const [selectionKey, dimensionId] of Object.entries(
        drill.selectionBindings,
      )) {
        const selected = rows
          .map((row) => (row as Record<string, unknown>)[selectionKey])
          .filter(
            (value): value is string | number =>
              value !== null && value !== undefined,
          )
          .map(String);

        if (selected.length === 0) {
          continue;
        }

        const dimension = dimensions.find((entry) => entry.id === dimensionId);

        // Write at the dimension's own scope: global filters every tab,
        // a tab dimension filters its own page.
        const key =
          dimension?.scope === "global"
            ? globalKey(dimension.id)
            : dimension?.tab
              ? tabKey(dimension.tab, dimension.id)
              : null;

        if (!key) {
          continue;
        }

        entries[key] =
          drill.selectionMode === "multi" ? selected.join(",") : selected[0];
      }

      if (Object.keys(entries).length > 0) {
        // targetTab omitted -> cross-filter in place; set -> navigate (drill).
        applySelection(entries, drill.targetTab);
      }
    };
  }, [drill, dimensions, applySelection]);

  const Module = component as unknown as React.ComponentType<
    ChartWrapperInjectedProps<DataType, ChartConfigs>
  >;

  const parsedMockData = useMemo(() => {
    if (mockData === undefined) {
      return undefined;
    }

    const result = z.array(dataSchema).safeParse(mockData);

    if (!result.success) {
      throw new Error(
        `Invalid mockData for chartID "${chartID}": ${result.error.message}`,
      );
    }

    return result.data as DataType[];
  }, [mockData, dataSchema, chartID]);

  const {
    data: chartData = parsedMockData ?? [],
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery<DataType[], Error>({
    queryKey: ["chart-data", chartID, params],
    queryFn: async () => {
      const start = performance.now();

      const result = await fetchChartData(
        chartID,
        params,
        dataSchema as unknown as z.ZodType<DataType>,
      );

      if (process.env.NODE_ENV === "development") {
        recordTiming({
          chartID,
          label: chartTitle,
          durationMs: performance.now() - start,
          timestamp: Date.now(),
        });
      }

      return result;
    },
    enabled: parsedMockData === undefined,
    initialData: parsedMockData,
  });

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

        {isLoading || isFetching ? (
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

        {chartData.length === 0 && !isLoading && !isFetching && !isError ? (
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
          <Module
            {...baseProps}
            chartData={isError ? [] : chartData}
            error={error}
            isLoading={isLoading}
            isFetching={isFetching}
            isError={isError}
            selectionMode={drill?.selectionMode}
            onSelectionChange={handleSelectionChange}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export default ChartWrapper;

function toQueryParam(value: FilterValue | undefined): string | number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  // dateRange values are resolved by dedicated bindings in a later phase.
  return null;
}

async function fetchChartData<TSchema extends z.ZodTypeAny>(
  chartID: string,
  filters: Record<string, string | number | null>,
  dataSchema: TSchema,
): Promise<z.infer<TSchema>[]> {
  const response = await apiFetch(`/api/data/${chartID}`, {
    method: "POST",
    body: {
      filters,
    },
  });

  const validationResult = z.array(dataSchema).safeParse(response);

  if (!validationResult.success) {
    throw new Error(
      `Invalid chart data returned by the API: ${validationResult.error.message}`,
    );
  }

  return validationResult.data;
}

function ChartState({ height, children }: ChartStateProps) {
  return (
    <div
      className="flex w-full items-center justify-center"
      style={{
        height: `${height}svh`,
      }}>
      {children}
    </div>
  );
}
