"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from "@/components/ui/sidebar";
import useFiltersStore, { globalKey } from "@/stores/filterProvider";
import { FilterControl } from "../FilterControl";
import { FilterActions } from "../FilterActions";
import { QueryTimer } from "../QueryTimer";
import { FilterValue } from "@/types/filters";

export function AppSidebar() {
  const { dimensions, draftValues, setDraftFilter } = useFiltersStore();
  const globalFilters = dimensions.filter((dim) => dim.scope === "global");

  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarContent>
        <SidebarGroup>
          {globalFilters.map((dimension) => {
            const key = globalKey(dimension.id);

            return (
              <FilterControl
                key={dimension.id}
                dimension={dimension}
                value={draftValues[key]}
                onChange={(value: FilterValue) => setDraftFilter(key, value)}
              />
            );
          })}
        </SidebarGroup>
        <SidebarGroup />
      </SidebarContent>
      <SidebarFooter>
        <FilterActions />
        <QueryTimer />
      </SidebarFooter>
    </Sidebar>
  );
}
