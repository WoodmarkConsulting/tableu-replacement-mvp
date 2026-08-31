"use client";

import { FilterControl } from "@/components/FilterControl";
import { tabKey, useFilterStore } from "@/stores/filterProvider";
import type { FilterDimension, FilterValue } from "@/types/filters";

type TabFiltersProps = {
  dimensions: FilterDimension[];
};

export function TabFilters({ dimensions }: TabFiltersProps) {
  const activeTab = useFilterStore((state) => state.activeTab);
  const values = useFilterStore((state) => state.values);
  const setFilter = useFilterStore((state) => state.setFilter);

  const tabDimensions = dimensions.filter(
    (dimension) => dimension.scope === "tab" && dimension.tab === activeTab,
  );

  if (tabDimensions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-4">
      {tabDimensions.map((dimension) => {
        const key = tabKey(activeTab, dimension.id);

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
