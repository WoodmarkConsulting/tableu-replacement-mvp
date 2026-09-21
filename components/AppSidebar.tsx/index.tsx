"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
} from "@/components/ui/sidebar";
import useFiltersStore, {
  controlContributionKey,
} from "@/stores/filterProvider";
import { FilterControl } from "../FilterControl";
import { FilterActions } from "../FilterActions";
import { QueryTimer } from "../QueryTimer";
import { TabFilters } from "../TabFilters";

export function AppSidebar() {
  const { dimensions, draftContributions, setDraftFilter } = useFiltersStore();
  const globalFilters = dimensions.filter(
    (dimension) => dimension.control?.location === "dashboard",
  );

  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarContent>
        {globalFilters.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Globale Filter</SidebarGroupLabel>

            {globalFilters.map((dimension) => {
              const key = controlContributionKey(dimension);

              return (
                <FilterControl
                  key={dimension.id}
                  dimension={dimension}
                  value={key ? draftContributions[key]?.value : undefined}
                  onChange={(value: FilterValue) =>
                    setDraftFilter(dimension.id, value)
                  }
                />
              );
            })}
          </SidebarGroup>
        ) : null}

        <TabFilters />
      </SidebarContent>
      <SidebarFooter>
        <FilterActions />
        <QueryTimer />
      </SidebarFooter>
    </Sidebar>
  );
}
