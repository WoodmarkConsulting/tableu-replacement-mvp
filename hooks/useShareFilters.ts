"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";

import useFiltersStore from "@/stores/filterProvider";

type ShareStatus = "idle" | "sharing" | "copied" | "error";

export function useShareFilters(dashboard: string) {
  const pathname = usePathname();
  const [status, setStatus] = useState<ShareStatus>("idle");

  const share = useCallback(async () => {
    setStatus("sharing");

    try {
      const { appliedValues, activeTab } = useFiltersStore.getState();

      const response = await fetch("/api/filters/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboard,
          state: { values: appliedValues, activeTab },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create snapshot");
      }

      const { id } = (await response.json()) as { id: string };

      const params = new URLSearchParams();
      params.set("s", id);

      if (activeTab) {
        params.set("tab", activeTab);
      }

      const url = `${window.location.origin}${pathname}?${params.toString()}`;

      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    } finally {
      window.setTimeout(() => setStatus("idle"), 2000);
    }
  }, [dashboard, pathname]);

  return { share, status };
}
