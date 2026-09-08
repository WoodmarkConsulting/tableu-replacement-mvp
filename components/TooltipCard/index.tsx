import { useLayoutEffect, useRef, useState } from "react";

import type { Tooltip, TooltipPosition } from "@/stores/tooltip";
import { Spinner } from "../ui/spinner";
import { Button } from "../ui/button";
import useTooltipStore from "@/stores/tooltip";
import useChartConnectionsStore from "@/stores/chartConnectionsStore";
import { ListFilter, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  tooltip: Tooltip | null;
  position: TooltipPosition | null;
  amountOfChartConnections: number;
};

const GAP = 12;
const VIEWPORT_PADDING = 8;

const TooltipCard = ({
  tooltip,
  position,
  amountOfChartConnections = 0,
}: Props) => {
  const isStaticTooltip = useTooltipStore((state) => state.isStaticTooltip);
  const hideTooltip = useTooltipStore((state) => state.hideTooltip);
  const pendingSourceFilters = useChartConnectionsStore(
    (state) => state.pendingSourceFilters,
  );
  const applyPendingSourceFilters = useChartConnectionsStore(
    (state) => state.applyPendingSourceFilters,
  );

  const ref = useRef<HTMLDivElement>(null);
  const [resolvedPosition, setResolvedPosition] =
    useState<TooltipPosition | null>(null);

  useLayoutEffect(() => {
    if (!position || !tooltip || !ref.current) {
      setResolvedPosition(null);
      return;
    }

    const rect = ref.current.getBoundingClientRect();

    let x = position.x + GAP;
    let y = position.y + GAP;

    // Rechts kein Platz -> links von der Maus anzeigen
    if (x + rect.width > window.innerWidth - VIEWPORT_PADDING) {
      x = position.x - rect.width - GAP;
    }

    // Unten kein Platz -> über der Maus anzeigen
    if (y + rect.height > window.innerHeight - VIEWPORT_PADDING) {
      y = position.y - rect.height - GAP;
    }

    // Sicherheit für linken / oberen Rand
    x = Math.max(VIEWPORT_PADDING, x);
    y = Math.max(VIEWPORT_PADDING, y);

    setResolvedPosition({ x, y });
  }, [position, tooltip]);

  if (!position || !tooltip) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "fixed z-70 flex max-h-[min(16rem,35vh)] w-[min(56rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-md border bg-background shadow-md text-xs",
        isStaticTooltip ? "" : "pointer-events-none",
      )}
      style={{
        left: resolvedPosition?.x ?? position.x + GAP,
        top: resolvedPosition?.y ?? position.y + GAP,
      }}>
      {isStaticTooltip ? (
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
          <span className="font-medium">Details</span>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Tooltip schließen"
            title="Tooltip schließen"
            onClick={hideTooltip}>
            <X />
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {tooltip.state === "pending" && <Spinner />}

        {tooltip.state === "rejected" && (
          <div className="text-sm">Tooltip konnte nicht geladen werden.</div>
        )}

        {tooltip.state === "fulfilled" && (
          <TooltipValue value={tooltip.tooltipData.dataPoint} />
        )}
      </div>

      {isStaticTooltip && pendingSourceFilters && amountOfChartConnections ? (
        <div className="flex shrink-0 border-t bg-background p-3">
          <Button
            className="ml-auto mt-3 w-fit"
            onClick={() => {
              applyPendingSourceFilters();
              hideTooltip();
            }}>
            <ListFilter data-icon="inline-start" />
            Verknüpfte Diagramme filtern
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default TooltipCard;

function TooltipValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (typeof value === "string") {
    return (
      <span className="block max-w-80 truncate" title={value}>
        {value}
      </span>
    );
  }

  if (typeof value === "number") {
    return <span>{value.toLocaleString()}</span>;
  }

  if (typeof value === "boolean") {
    return <span>{value ? "Ja" : "Nein"}</span>;
  }

  if (Array.isArray(value)) {
    return <TooltipArray value={value} />;
  }

  if (typeof value === "object") {
    return <TooltipObject value={value as Record<string, unknown>} />;
  }

  return <span>{String(value)}</span>;
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

function TooltipObject({ value }: { value: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {Object.entries(value).map(([key, entry]) => (
        <div key={key} className="contents">
          <span className="font-medium text-muted-foreground text-xs">
            {formatLabel(key)}
          </span>

          <TooltipValue value={entry} />
        </div>
      ))}
    </div>
  );
}

function TooltipArray({ value }: { value: unknown[] }) {
  if (value.length === 0) {
    return <span className="text-muted-foreground">Keine Daten</span>;
  }

  const containsOnlyObjects = value.every(
    (entry) =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );

  if (containsOnlyObjects) {
    return <TooltipTable value={value as Record<string, unknown>[]} />;
  }

  const displayValue = value.map(String).join(", ");

  return (
    <span className="block max-w-80 truncate" title={displayValue}>
      {displayValue}
    </span>
  );
}

function TooltipTable({ value }: { value: Record<string, unknown>[] }) {
  const columns = Array.from(new Set(value.flatMap((row) => Object.keys(row))));

  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column}
              className="border-b px-3 py-2 text-left font-medium text-xs">
              {formatLabel(column)}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {value.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((column) => (
              <td key={column} className="px-3 py-2 align-top text-xs">
                <TooltipValue value={row[column]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
