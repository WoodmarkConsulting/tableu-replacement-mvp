"use client";

import { SidebarGroupLabel, SidebarSeparator } from "@/components/ui/sidebar";
import useQueryTimingStore from "@/stores/queryTimingStore";

const formatMs = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;

export function QueryTimer() {
  const timings = useQueryTimingStore((state) => state.timings);
  const entries = Object.values(timings).sort(
    (a, b) => b.timestamp - a.timestamp,
  );

  // Dev-only tool: excluded from production builds.
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  if (entries.length === 0) {
    return null;
  }

  const total = entries.reduce((sum, entry) => sum + entry.durationMs, 0);

  return (
    <div className="px-2 py-1 text-xs text-muted-foreground">
      <SidebarSeparator className="mx-0 mb-2" />

      <SidebarGroupLabel className="h-auto px-0">
        Query Timer
      </SidebarGroupLabel>

      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry.chartID} className="flex items-center justify-between gap-2">
            <span className="truncate">{entry.label || entry.chartID}</span>
            <span className="tabular-nums text-foreground">
              {formatMs(entry.durationMs)}
            </span>
          </li>
        ))}
      </ul>

      {entries.length > 1 ? (
        <div className="mt-1 flex items-center justify-between gap-2 font-medium text-foreground">
          <span>Total</span>
          <span className="tabular-nums">{formatMs(total)}</span>
        </div>
      ) : null}
    </div>
  );
}
