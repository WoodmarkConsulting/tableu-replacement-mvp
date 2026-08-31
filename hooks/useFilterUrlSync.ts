"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useFilterStoreApi, type FilterState } from "@/stores/filterProvider";
import type { FilterSnapshot } from "@/types/filters";

const SNAPSHOT_PARAM = "s";
const TAB_PARAM = "tab";

// Restores shareable state from a permalink token (`?s=<id>`) and keeps the
// (small) active tab in the URL. Large filter selections are never placed in the
// URL directly; they are persisted server-side as snapshots (see /api/filters).
export function useFilterUrlSync(): void {
  const store = useFilterStoreApi();
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

    const state = store.getState();
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
        const response = await fetch(`/api/filters/snapshot/${snapshotId}`);

        if (!response.ok || cancelled) {
          return;
        }

        const snapshot = (await response.json()) as FilterSnapshot;

        if (cancelled) {
          return;
        }

        const current = store.getState();

        for (const [key, value] of Object.entries(snapshot.values ?? {})) {
          current.setFilter(key, value);
        }

        if (snapshot.activeTab) {
          current.setActiveTab(snapshot.activeTab);
        }
      } catch {
        // Ignore snapshot load failures; the dashboard renders with defaults.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [store, searchParams]);

  // Keep only the active tab in the URL; drop the consumed snapshot token.
  useEffect(() => {
    const write = (state: FilterState) => {
      const params = new URLSearchParams(window.location.search);

      params.delete(SNAPSHOT_PARAM);

      if (state.activeTab) {
        params.set(TAB_PARAM, state.activeTab);
      } else {
        params.delete(TAB_PARAM);
      }

      const query = params.toString();

      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    };

    return store.subscribe(write);
  }, [store, pathname, router]);
}
