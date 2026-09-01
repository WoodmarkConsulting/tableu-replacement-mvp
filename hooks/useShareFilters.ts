"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";

import useFiltersStore from "@/stores/filterProvider";
import { apiFetch } from "@/app/api/utils/apiFetch";

type ShareStatus = "idle" | "sharing" | "copied" | "error";

export function useShareFilters(dashboard: string) {
  const pathname = usePathname();
  const [status, setStatus] = useState<ShareStatus>("idle");

  const share = useCallback(async () => {
    setStatus("sharing");

    try {
      const { values, activeTab } = useFiltersStore.getState();

      const { id } = await apiFetch("/api/filters/snapshot", {
        method: "POST",

        body: JSON.stringify({
          dashboard,
          state: { values, activeTab },
        }),
      });

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
