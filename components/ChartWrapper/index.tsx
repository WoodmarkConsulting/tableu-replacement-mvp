"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import useChartState, { type ChartFiltersState } from "@/hooks/useChartState";

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

import ChartFilters from "../ChartFilters";

import { cn } from "@/lib/utils";

import {
  moduleRegistry,
  type ChartConfigs,
  type ModuleRegistryKeys,
} from "@/modules/modulRegistry";

import type { TabsComponentConfig } from "@/types/tabs";
import type { ChartWrapperInjectedProps } from "@/types/baseChart";

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

  const { moduleName, mockData, ...baseProps } = props;
  const [filters, setFilters] = useChartState(baseProps.filterConfig);
  const { chartID, chartTitle, chartDescription, filterConfig } = baseProps;
  const { component, dataSchema } = moduleRegistry[moduleName];

  const Module = component as React.ComponentType<
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
    queryKey: ["chart-data", chartID, filters],
    queryFn: () =>
      fetchChartData(
        chartID,
        filters,
        dataSchema as unknown as z.ZodType<DataType>,
      ),
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
        {filterConfig.length > 0 && (
          <ChartFilters
            filterConfig={filterConfig}
            filters={filters}
            setFilter={setFilters}
          />
        )}

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
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export default ChartWrapper;

async function fetchChartData<TSchema extends z.ZodTypeAny>(
  chartID: string,
  filters: ChartFiltersState,
  dataSchema: TSchema,
): Promise<z.infer<TSchema>[]> {
  const response = await fetch(`/api/data/${chartID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filters,
    }),
  });

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch {
    throw new Error(
      "Failed to load chart data: API response is not valid JSON.",
    );
  }

  if (!response.ok) {
    const errorMessage =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "error" in responseBody &&
      typeof responseBody.error === "string"
        ? responseBody.error
        : "Unknown error";

    throw new Error(`Failed to load chart data: ${errorMessage}`);
  }

  const validationResult = z.array(dataSchema).safeParse(responseBody);

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
