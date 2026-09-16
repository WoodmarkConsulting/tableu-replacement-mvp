"use client";

import { FilterControl } from "@/components/FilterControl";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import useFilterStore, { tabKey } from "@/stores/filterProvider";

export function TabFilters() {
  const dimensions = useFilterStore((state) => state.dimensions);
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
    <>
      <SidebarSeparator />

      <SidebarGroup>
        <SidebarGroupLabel>Filter für &quot;{activeTab}&quot;</SidebarGroupLabel>

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
      </SidebarGroup>
    </>
  );
}

export default TabFilters;
