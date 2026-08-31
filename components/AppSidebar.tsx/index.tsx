"use client";

import useGlobalFilters from "@/app/context/globalFilter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from "@/components/ui/sidebar";
import ChartFilters from "../ChartFilters";

export function AppSidebar() {
  const { globalFilterConfig, globalFilters, setFilter } = useGlobalFilters();

  console.log("globalFilters", globalFilters);

  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarContent>
        <SidebarGroup>
          <ChartFilters
            filterConfig={globalFilterConfig}
            filters={globalFilters}
            setFilter={setFilter}
          />
        </SidebarGroup>
        <SidebarGroup />
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
