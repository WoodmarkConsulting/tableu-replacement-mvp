"use client";

import { FilterControl } from "@/components/FilterControl";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import useFilterStore, {
  controlContributionKey,
} from "@/stores/filterProvider";

export function TabFilters() {
  const dimensions = useFilterStore((state) => state.dimensions);
  const activeTab = useFilterStore((state) => state.activeTab);
  const contributions = useFilterStore((state) => state.draftContributions);
  const setDraftFilter = useFilterStore((state) => state.setDraftFilter);

  const tabDimensions = dimensions.filter(
    (dimension) =>
      dimension.control?.location === "tab" &&
      dimension.control.tab === activeTab,
  );

  if (tabDimensions.length === 0) {
    return null;
  }

  return (
    <>
      <SidebarSeparator />

      <SidebarGroup>
        <SidebarGroupLabel>Filter für &quot;{activeTab}&quot;</SidebarGroupLabel>

        {tabDimensions.map((dimension) => {
          const key = controlContributionKey(dimension);

          return (
            <FilterControl
              key={dimension.id}
              dimension={dimension}
              value={key ? contributions[key]?.value : undefined}
              onChange={(value: FilterValue) =>
                setDraftFilter(dimension.id, value)
              }
            />
          );
        })}
      </SidebarGroup>
    </>
  );
}

export default TabFilters;
