import type { Tooltip, TooltipPosition } from "@/stores/tooltip";
import { Spinner } from "../ui/spinner";

type Props = {
  tooltip: Tooltip | null;
  position: TooltipPosition | null;
};

const TooltipCard = ({ tooltip, position }: Props) => {
  if (!position || !tooltip) {
    return null;
  }

  return (
    <div
      className="fixed z-50 pointer-events-none max-h-96 max-w-xl overflow-auto rounded-md border bg-background p-3 shadow-md"
      style={{
        left: position.x + 12,
        top: position.y + 12,
      }}>
      {tooltip.state === "pending" && <Spinner />}

      {tooltip.state === "rejected" && (
        <div className="text-sm">Tooltip konnte nicht geladen werden.</div>
      )}

      {tooltip.state === "fulfilled" && (
        <TooltipValue value={tooltip.tooltipData.dataPoint} />
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
          <span className="font-medium text-muted-foreground">
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
              className="border-b px-2 py-1 text-left font-medium">
              {formatLabel(column)}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {value.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((column) => (
              <td key={column} className="px-2 py-1 align-top">
                <TooltipValue value={row[column]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
