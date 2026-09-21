"use client";

import { Suspense, useMemo } from "react";

import { ActiveFilters } from "@/components/ActiveFilters";
import { ShareButton } from "@/components/ShareButton";
import { TabBreadcrumb } from "@/components/TabBreadcrumb";
import { TabsWrapper } from "@/components/TabsWrapper";
import { useFilterUrlSync } from "@/hooks/useFilterUrlSync";
import { validateDashboardConfig } from "@/lib/validateDashboardConfig";
import useFilterStore from "@/stores/filterProvider";

type DashboardShellProps = {
  config: DashboardConfig;
};

// useSearchParams (inside useFilterUrlSync) must sit under a Suspense boundary.
function FilterUrlSync({ dashboard }: { dashboard: string }) {
  useFilterUrlSync(dashboard);
  return null;
}

export function DashboardShell({ config }: DashboardShellProps) {
  // The page generator validates too; this is a dev-only safety net.
  useMemo(() => {
    if (process.env.NODE_ENV !== "production") {
      validateDashboardConfig(config);
    }
  }, [config]);

  const { reportName, filters, tabs, actions } = config;

  const activeTab = useFilterStore((state) => state.activeTab);
  const setActiveTab = useFilterStore((state) => state.setActiveTab);
  const urlSync = (
    <Suspense fallback={null}>
      <FilterUrlSync dashboard={reportName} />
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

  const applied = <ActiveFilters dimensions={filters} tabs={tabs} />;

  const main = (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <TabBreadcrumb />

      <TabsWrapper
        tabsConfig={tabs}
        actions={actions}
        value={activeTab}
        onValueChange={setActiveTab}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {urlSync}

      {header}

      {applied}

      {main}
    </div>
  );
}
