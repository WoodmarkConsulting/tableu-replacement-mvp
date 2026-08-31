"use client";

import { Suspense } from "react";

import { ActiveFilters } from "@/components/ActiveFilters";
import { ShareButton } from "@/components/ShareButton";
import { TabFilters } from "@/components/TabFilters";
import { TabsWrapper } from "@/components/TabsWrapper";
import { useFilterUrlSync } from "@/hooks/useFilterUrlSync";
import useFilterStore from "@/stores/filterProvider";

type DashboardShellProps = {
  config: DashboardConfig;
};

// useSearchParams (inside useFilterUrlSync) must sit under a Suspense boundary.
function FilterUrlSync() {
  useFilterUrlSync();
  return null;
}

export function DashboardShell({ config }: DashboardShellProps) {
  const { reportName, filters, tabs } = config;

  const activeTab = useFilterStore((state) => state.activeTab);
  const setActiveTab = useFilterStore((state) => state.setActiveTab);

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

      <TabsWrapper
        tabsConfig={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {urlSync}

      {header}

      {applied}

      {main}
    </div>
  );
}
