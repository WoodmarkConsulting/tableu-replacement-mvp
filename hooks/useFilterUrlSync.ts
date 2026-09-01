"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import useFiltersStore, { FilterStoreState } from "@/stores/filterProvider";
import { apiFetch } from "@/app/api/utils/apiFetch";

const SNAPSHOT_PARAM = "s";
const TAB_PARAM = "tab";

// Restores shareable state from a permalink token (`?s=<id>`) and keeps the
// (small) active tab in the URL. Large filter selections are never placed in the
// URL directly; they are persisted server-side as snapshots (see /api/filters).
export function useFilterUrlSync(): void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydratedRef = useRef(false);

  // Hydrate once from the URL on mount.
  useEffect(() => {
    if (hydratedRef.current) {
      return;
    }

    hydratedRef.current = true;

    const state = useFiltersStore.getState();
    const snapshotId = searchParams.get(SNAPSHOT_PARAM);
    const tab = searchParams.get(TAB_PARAM);

    if (tab) {
      state.setActiveTab(tab);
    }

    if (!snapshotId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const snapshot = await apiFetch(`/api/filters/snapshot/${snapshotId}`, {
          method: "GET",
        });

        if (cancelled) {
          return;
        }

        const current = useFiltersStore.getState();

        for (const [key, value] of Object.entries(snapshot.values ?? {})) {
          current.setDraftFilter(key, value);
        }

        if (snapshot.activeTab) {
          current.setActiveTab(snapshot.activeTab);
        }

        // Auto-apply so the recipient sees data without pressing Apply.
        useFiltersStore.getState().applyFilters();
      } catch {
        // Ignore snapshot load failures; the dashboard renders with defaults.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // Keep only the active tab in the URL; drop the consumed snapshot token.
  useEffect(() => {
    const write = (
      state: FilterStoreState,
      previousState: FilterStoreState,
    ) => {
      if (state.activeTab === previousState.activeTab) {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      params.delete(SNAPSHOT_PARAM);
      params.set(TAB_PARAM, state.activeTab);

      router.replace(`${pathname}?${params.toString()}`, {
        scroll: false,
      });
    };

    return useFiltersStore.subscribe(write);
  }, [pathname, router]);
}
