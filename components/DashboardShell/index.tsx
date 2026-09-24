"use client";

import { Suspense, useMemo } from "react";

import { ActiveFilters } from "@/components/ActiveFilters";
import { ShareButton } from "@/components/ShareButton";
import { TabBreadcrumb } from "@/components/TabBreadcrumb";
import { TabsWrapper } from "@/components/TabsWrapper";
import { useFilterUrlSync } from "@/hooks/useFilterUrlSync";
import { validateDashboardConfig } from "@/lib/validateDashboardConfig";
import useFilterStore from "@/stores/filterProvider";

import { useLayoutEffect } from "react";
import { useShallow } from "zustand/shallow";

type DashboardShellProps = {
  config: DashboardConfig;
  initialTab: string;
};

// useSearchParams (inside useFilterUrlSync) must sit under a Suspense boundary.
function FilterUrlSync({ dashboard }: { dashboard: string }) {
  useFilterUrlSync(dashboard);
  return null;
}

export function DashboardShell({ config, initialTab }: DashboardShellProps) {
  const { initFilterStore, resetFilterStore } = useFilterStore(
    useShallow((state) => ({
      initFilterStore: state.initFilterStore,
      resetFilterStore: state.resetFilterStore,
    })),
  );

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

  useLayoutEffect(() => {
    initFilterStore({
      dimensions: [],
      initialActiveTab: initialTab,
    });

    return resetFilterStore;
  }, [initFilterStore, resetFilterStore, initialTab]);

  return (
    <div className="flex flex-col gap-2">
      {urlSync}

      {header}

      {applied}

      {main}
    </div>
  );
}
