import { useLayoutEffect, useRef, useState } from "react";

import type { Tooltip, TooltipPosition } from "@/stores/tooltip";
import { Spinner } from "../ui/spinner";
import useTooltipStore from "@/stores/tooltip";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  tooltip: Tooltip | null;
  position: TooltipPosition | null;
};

const GAP = 12;
const VIEWPORT_PADDING = 8;

const TooltipCard = ({ tooltip, position }: Props) => {
  const isStaticTooltip = useTooltipStore((state) => state.isStaticTooltip);
  const hideTooltip = useTooltipStore((state) => state.hideTooltip);

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
        "fixed z-50 max-h-96 max-w-xl overflow-auto rounded-md border bg-background p-3 shadow-md text-xs",
        isStaticTooltip ? "" : "pointer-events-none",
      )}
      style={{
        left: resolvedPosition?.x ?? position.x + GAP,
        top: resolvedPosition?.y ?? position.y + GAP,
      }}>
      {tooltip.state === "pending" && <Spinner />}

      {tooltip.state === "rejected" && (
        <div className="text-sm">Tooltip konnte nicht geladen werden.</div>
      )}

      {tooltip.state === "fulfilled" && (
        <div className="flex flex-col">
          {isStaticTooltip ? (
            <div className="ml-auto">
              <X
                className="size-4 hover:border hover:border-gray-300 rounded p-0.5"
                onClick={hideTooltip}
              />
            </div>
          ) : null}
          <TooltipValue value={tooltip.tooltipData.dataPoint} />
        </div>
      )}
    </div>
  );
};

export default TooltipCard;

function TooltipValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (typeof value === "string") {
    return <span>{value}</span>;
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

  return (
    <div className="flex flex-col gap-1">
      {value.map((entry, index) => (
        <TooltipValue key={index} value={entry} />
      ))}
    </div>
  );
}

function TooltipTable({ value }: { value: Record<string, unknown>[] }) {
  const columns = Array.from(new Set(value.flatMap((row) => Object.keys(row))));

  return (
    <table className="text-sm">
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column}
              className="border-b px-2 py-1 text-left font-medium text-xs">
              {formatLabel(column)}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {value.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((column) => (
              <td key={column} className="px-2 py-1 align-top text-xs ">
                <TooltipValue value={row[column]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
