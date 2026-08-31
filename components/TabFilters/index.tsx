"use client";

import { FilterControl } from "@/components/FilterControl";
import type { FilterDimension, FilterValue } from "@/types/filters";
import useFilterStore, { tabKey } from "@/stores/filterProvider";

type TabFiltersProps = {
  dimensions: FilterDimension[];
};

export function TabFilters({ dimensions }: TabFiltersProps) {
  const activeTab = useFilterStore((state) => state.activeTab);
  const values = useFilterStore((state) => state.draftValues);
  const setDraftFilter = useFilterStore((state) => state.setDraftFilter);

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
            onChange={(value: FilterValue) => setDraftFilter(key, value)}
          />
        );
      })}
    </div>
  );
}
