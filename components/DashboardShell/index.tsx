"use client";

import { Suspense } from "react";

import { ActiveFilters } from "@/components/ActiveFilters";
import { FilterBar } from "@/components/FilterBar";
import { ShareButton } from "@/components/ShareButton";
import { TabFilters } from "@/components/TabFilters";
import { TapsWrapper } from "@/components/TapsWrapper";
import { useFilterUrlSync } from "@/hooks/useFilterUrlSync";
import { useFilterStore } from "@/stores/filterProvider";
import type { DashboardConfig } from "@/types/tabs";

type DashboardShellProps = {
  config: DashboardConfig;
};

// useSearchParams (inside useFilterUrlSync) must sit under a Suspense boundary.
function FilterUrlSync() {
  useFilterUrlSync();
  return null;
}

export function DashboardShell({ config }: DashboardShellProps) {
  const { reportName, filterLayout, filters, tabs } = config;

  const activeTab = useFilterStore((state) => state.activeTab);
  const setActiveTab = useFilterStore((state) => state.setActiveTab);

  const hasGlobalFilters = filters.some(
    (dimension) => dimension.scope === "global",
  );

  const urlSync = (
    <Suspense fallback={null}>
      <FilterUrlSync />
    </Suspense>
  );

  const header = (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold">{reportName}</h1>

      <span className="print:hidden">
        <ShareButton dashboard={reportName} />
      </span>
    </div>
  );

  const applied = <ActiveFilters dimensions={filters} />;

  const main = (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="print:hidden">
        <TabFilters dimensions={filters} />
      </div>

      <TapsWrapper
        tabsConfig={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
      />
    </div>
  );

  if (filterLayout === "sidebar") {
    return (
      <div className="flex flex-col gap-6">
        {urlSync}

        {header}

        {applied}

        <div className="flex gap-6">
          {hasGlobalFilters ? (
            <aside className="w-64 shrink-0 print:hidden">
              <FilterBar dimensions={filters} orientation="vertical" />
            </aside>
          ) : null}

          {main}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {urlSync}

      {header}

      {hasGlobalFilters ? (
        <div className="print:hidden">
          <FilterBar dimensions={filters} orientation="horizontal" />
        </div>
      ) : null}

      {applied}

      {main}
    </div>
  );
}
