"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import useFilterStore from "@/stores/filterProvider";

export function TabBreadcrumb() {
  const breadcrumbs = useFilterStore((state) => state.breadcrumbs);
  const activeTab = useFilterStore((state) => state.activeTab);
  const navigateBack = useFilterStore((state) => state.navigateBack);

  const currentBreadcrumb =
    breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;

  if (!currentBreadcrumb || activeTab !== currentBreadcrumb.targetTab) {
    return null;
  }

  const originLabel =
    currentBreadcrumb.fromChartTitle ?? currentBreadcrumb.fromChartID;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={navigateBack}>
          <ChevronLeft className="size-4 mr-1" />
          Zurück zu {currentBreadcrumb.fromTab}
        </Button>
      </div>
      <span>Gefiltert nach Auswahl in &quot;{originLabel}&quot;</span>
    </div>
  );
}

export default TabBreadcrumb;
