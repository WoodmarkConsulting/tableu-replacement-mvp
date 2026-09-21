"use client";

import { useMemo } from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  contributionAppliesTo,
  isEmptyFilterValue,
} from "@/lib/filters/contributions";
import useFilterStore from "@/stores/filterProvider";

type ActiveFiltersProps = {
  dimensions: FilterDimension[];
  tabs: TabsConfig[];
};

function formatValue(dimension: FilterDimension, value: FilterValue): string {
  if (dimension.type === "multiselect" && Array.isArray(value)) {
    const labels = value.map(
      (entry) =>
        dimension.options?.find((option) => option.value === entry)?.label ??
        entry,
    );

    return labels.length > 3
      ? `${labels.length} ausgewählt`
      : labels.join(", ");
  }

  if (
    (dimension.type === "select" || dimension.type === "option") &&
    typeof value === "string"
  ) {
    return (
      dimension.options?.find((option) => option.value === value)?.label ??
      value
    );
  }

  if (dimension.type === "dateRange" && value && typeof value === "object") {
    const range = value as DateRangeValue;
    return `${range.from ?? "…"} – ${range.to ?? "…"}`;
  }

  return String(value);
}

export function ActiveFilters({ dimensions, tabs }: ActiveFiltersProps) {
  const contributions = useFilterStore(
    (state) => state.appliedContributions,
  );
  const activeTab = useFilterStore((state) => state.activeTab);
  const removeContribution = useFilterStore(
    (state) => state.removeContribution,
  );
  const clearAll = useFilterStore((state) => state.clearAll);

  const chartIDsOnActiveTab = useMemo(
    () =>
      new Set(
        (tabs.find((tab) => tab.trigger === activeTab)?.rows ?? []).flatMap(
          (row) => row.components.map((component) => component.chartID),
        ),
      ),
    [tabs, activeTab],
  );

  const dimensionsById = new Map(
    dimensions.map((dimension) => [dimension.id, dimension]),
  );
  // Chips summarize the whole tab, so any chart-targeted contribution on the
  // active tab is shown, not just the one aimed at a single chart.
  const active = Object.values(contributions)
    .filter((contribution) =>
      contributionAppliesTo(contribution, {
        tab: activeTab,
        chartIDsOnTab: chartIDsOnActiveTab,
      }),
    )
    .map((contribution) => ({
      contribution,
      dimension: dimensionsById.get(contribution.dimensionId),
    }))
    .filter(
      (entry): entry is typeof entry & { dimension: FilterDimension } =>
        entry.dimension !== undefined &&
        !isEmptyFilterValue(entry.contribution.value),
    );

  if (active.length === 0) {
    return null;
  }

  return (
    <div
      data-slot="active-filters"
      className="flex flex-wrap items-center gap-2">
      <span className="hidden text-sm font-medium print:inline">
        Angewendete Filter:
      </span>

      {active.map(({ dimension, contribution }) => (
        <span
          key={contribution.key}
          className="inline-flex items-center gap-1 rounded-full border border-input bg-muted px-2 py-0.5 text-xs">
          <span className="font-medium">{dimension.label}:</span>

          <span>{formatValue(dimension, contribution.value)}</span>

          {contribution.source.kind !== "control" ? (
            <span className="text-muted-foreground">
              {contribution.source.kind === "tabJump"
                ? "via Drilldown"
                : "via Auswahl"}
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => removeContribution(contribution.key)}
            aria-label={`Filter ${dimension.label} entfernen`}
            className="ml-1 rounded-full p-0.5 hover:bg-accent print:hidden">
            <XIcon className="size-3" />
          </button>
        </span>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={clearAll}
        className="h-6 px-2 text-xs print:hidden">
        Alle zurücksetzen
      </Button>
    </div>
  );
}
