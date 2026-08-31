"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import useFilterStore, { globalKey, tabKey } from "@/stores/filterProvider";
import type {
  DateRangeValue,
  FilterDimension,
  FilterValue,
} from "@/types/filters";

type ActiveFiltersProps = {
  dimensions: FilterDimension[];
};

function isEmpty(value: FilterValue | undefined): boolean {
  if (value === null || value === undefined || value === "") {
    return true;
  }

  if (typeof value === "object") {
    return !value.from && !value.to;
  }

  return false;
}

function formatValue(dimension: FilterDimension, value: FilterValue): string {
  if (dimension.type === "select" && typeof value === "string") {
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

export function ActiveFilters({ dimensions }: ActiveFiltersProps) {
  const values = useFilterStore((state) => state.values);
  const activeTab = useFilterStore((state) => state.activeTab);
  const clearDimension = useFilterStore((state) => state.clearDimension);
  const clearAll = useFilterStore((state) => state.clearAll);

  const {} = useFilterStore();

  const active = dimensions
    .filter(
      (dimension) =>
        dimension.scope === "global" ||
        (dimension.scope === "tab" && dimension.tab === activeTab),
    )
    .map((dimension) => {
      const key =
        dimension.scope === "global"
          ? globalKey(dimension.id)
          : tabKey(activeTab, dimension.id);

      return { dimension, key, value: values[key] };
    })
    .filter((entry) => !isEmpty(entry.value));

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

      {active.map(({ dimension, key, value }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-full border border-input bg-muted px-2 py-0.5 text-xs">
          <span className="font-medium">{dimension.label}:</span>

          <span>{formatValue(dimension, value as FilterValue)}</span>

          <button
            type="button"
            onClick={() => clearDimension(key)}
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
