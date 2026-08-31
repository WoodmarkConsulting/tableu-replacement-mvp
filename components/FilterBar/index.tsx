"use client";

import { FilterControl } from "@/components/FilterControl";
import { globalKey, useFilterStore } from "@/stores/filterProvider";
import type { FilterDimension, FilterValue } from "@/types/filters";

type FilterBarProps = {
  dimensions: FilterDimension[];
  orientation?: "vertical" | "horizontal";
};

export function FilterBar({
  dimensions,
  orientation = "vertical",
}: FilterBarProps) {
  const values = useFilterStore((state) => state.values);
  const setFilter = useFilterStore((state) => state.setFilter);

  const globalDimensions = dimensions.filter(
    (dimension) => dimension.scope === "global",
  );

  if (globalDimensions.length === 0) {
    return null;
  }

  return (
    <div
      className={
        orientation === "horizontal"
          ? "flex flex-wrap gap-4"
          : "flex flex-col gap-4"
      }>
      {globalDimensions.map((dimension) => {
        const key = globalKey(dimension.id);

        return (
          <FilterControl
            key={dimension.id}
            dimension={dimension}
            value={values[key]}
            onChange={(value: FilterValue) => setFilter(key, value)}
          />
        );
      })}
    </div>
  );
}
