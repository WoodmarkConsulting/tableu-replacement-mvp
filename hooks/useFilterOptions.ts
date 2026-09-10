"use client";

import { useQuery } from "@tanstack/react-query";

import useQueryTimingStore, {
  type QueryTiming,
} from "@/stores/queryTimingStore";

async function fetchFilterOptions(
  source: string,
  label: string,
  recordTiming: (timing: QueryTiming) => void,
): Promise<FilterOption[]> {
  const start = performance.now();

  const response = await fetch(
    `/api/filters/options/${encodeURIComponent(source)}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to load filter options for "${source}"`);
  }

  const options = (await response.json()) as FilterOption[];

  if (process.env.NODE_ENV === "development") {
    recordTiming({
      // Prefixed so it never collides with a chart's timing entry.
      chartID: `filter:${source}`,
      label: `Filter: ${label}`,
      durationMs: performance.now() - start,
      timestamp: Date.now(),
    });
  }

  return options;
}

export type UseFilterOptionsResult = {
  options: FilterOption[];
  /** True while the warehouse-backed options query is in flight. */
  isLoading: boolean;
};

/**
 * Resolves the options for a filter dimension. When `optionsSource` is set the
 * options are loaded from the warehouse (eagerly, on dashboard open) and the
 * static `options` act as a fallback while loading. Non-dependent: the query
 * runs once with no filter parameters.
 */
export function useFilterOptions(
  dimension: FilterDimension,
): UseFilterOptionsResult {
  const source = dimension.optionsSource;
  const recordTiming = useQueryTimingStore((state) => state.recordTiming);

  const { data, isLoading } = useQuery<FilterOption[], Error>({
    queryKey: ["filter-options", source],
    queryFn: () =>
      fetchFilterOptions(source as string, dimension.label, recordTiming),
    enabled: Boolean(source),
    staleTime: 5 * 60_000,
  });

  return {
    options: data ?? dimension.options ?? [],
    // Only warehouse-backed filters can be in a loading state.
    isLoading: Boolean(source) && isLoading,
  };
}
