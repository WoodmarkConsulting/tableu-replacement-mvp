"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TableCellValue } from "./chartDataSchema";
import type { TableTreeRow } from "./tree";
import { computeBarGeometry, type BarDomain } from "./dataBar";
import { formatCellValue, getColumnValueKey, isNumericType } from "./format";

type ColumnConfig = TableChartConfig["columns"][number];

export type TableColumnMeta = {
  align: "left" | "center" | "right";
  groupId?: string;
  isExpandColumn: boolean;
};

export function alignClass(align: "left" | "center" | "right"): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

function isTruthy(value: TableCellValue | undefined): boolean {
  return value === true || value === "true" || value === 1;
}

function matchesColumnFilter(
  value: TableCellValue | undefined,
  filterValue: unknown,
): boolean {
  if (filterValue === null || filterValue === undefined || filterValue === "") {
    return true;
  }

  if (value === null || value === undefined) {
    return false;
  }

  return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
}

function DataBarCell({
  value,
  formatted,
  domain,
  column,
}: {
  value: number;
  formatted: string;
  domain: BarDomain;
  column: ColumnConfig;
}) {
  const dataBar = column.dataBar!;
  const geometry = computeBarGeometry(value, domain, column);
  const showValue = dataBar.showValue ?? true;
  const heightRatio = dataBar.heightRatio ?? 1;

  return (
    <div className="relative flex h-5 w-full min-w-[60px] items-center">
      {geometry && geometry.widthPct > 0 ? (
        <div
          className="pointer-events-none absolute inset-y-0 my-auto"
          style={{
            left: `${geometry.leftPct}%`,
            width: `${geometry.widthPct}%`,
            height: `${heightRatio * 100}%`,
            backgroundColor: geometry.color,
            borderRadius: dataBar.radius ?? 2,
            opacity: 0.4,
          }}
        />
      ) : null}
      {showValue ? (
        <span className="relative z-10 ml-auto tabular-nums">{formatted}</span>
      ) : null}
    </div>
  );
}

function renderCellContent(
  value: TableCellValue | undefined,
  column: ColumnConfig,
  emptyPlaceholder: string,
  domain: BarDomain | undefined,
): { node: React.ReactNode; plainText: boolean } {
  const placeholder = (
    <span className="text-muted-foreground">{emptyPlaceholder}</span>
  );

  if (column.type === "boolean") {
    if (value === null || value === undefined || value === "") {
      return { node: placeholder, plainText: false };
    }

    const truthy = isTruthy(value);
    const display = column.boolean?.display ?? "icon";

    if (display === "text") {
      return {
        node: truthy
          ? column.boolean?.trueLabel ?? "Ja"
          : column.boolean?.falseLabel ?? "Nein",
        plainText: true,
      };
    }

    return {
      node: truthy ? (
        <CheckIcon className="size-4 text-emerald-600" aria-label="Ja" />
      ) : (
        <XIcon className="size-4 text-muted-foreground" aria-label="Nein" />
      ),
      plainText: false,
    };
  }

  const formatted = formatCellValue(value, column);

  if (column.dataBar?.enabled && domain && typeof value === "number") {
    return {
      node: (
        <DataBarCell
          value={value}
          formatted={formatted ?? ""}
          domain={domain}
          column={column}
        />
      ),
      plainText: false,
    };
  }

  if (formatted === null) {
    return { node: placeholder, plainText: false };
  }

  return { node: formatted, plainText: true };
}

export function buildColumnDefs(
  config: TableChartConfig,
  domains: Map<string, BarDomain>,
): ColumnDef<TableTreeRow>[] {
  const emptyPlaceholder = config.appearance.emptyPlaceholder ?? "-";
  const hierarchyEnabled = config.hierarchy.enabled;
  const expandColumnId =
    config.hierarchy.expandColumnId ?? config.columns[0]?.id;
  const indentSize = config.hierarchy.indentSize ?? 16;

  const groupOf = new Map<string, string>();
  for (const group of config.columnGroups ?? []) {
    for (const memberId of group.memberColumnIds) {
      groupOf.set(memberId, group.id);
    }
  }

  return config.columns.map((column): ColumnDef<TableTreeRow> => {
    const valueKey = getColumnValueKey(column);
    const align: TableColumnMeta["align"] =
      column.align ?? (isNumericType(column.type) ? "right" : "left");
    const isExpandColumn = hierarchyEnabled && column.id === expandColumnId;

    return {
      id: column.id,
      accessorFn: (row) => row.values[valueKey] ?? null,
      enableSorting: config.sorting.enabled && (column.sortable ?? false),
      enableColumnFilter: config.filtering.perColumn && (column.filterable ?? false),
      filterFn: (row, _columnId, filterValue) =>
        matchesColumnFilter(row.original.values[valueKey], filterValue),
      meta: {
        align,
        groupId: groupOf.get(column.id),
        isExpandColumn,
      } satisfies TableColumnMeta,
      header: column.header,
      cell: ({ row, getValue }) => {
        const value = getValue() as TableCellValue | undefined;
        const { node, plainText } = renderCellContent(
          value,
          column,
          emptyPlaceholder,
          domains.get(column.id),
        );

        const rendered =
          plainText && !column.wrap ? (
            <span
              className="block truncate"
              title={typeof node === "string" ? node : undefined}
            >
              {node}
            </span>
          ) : plainText && column.wrap ? (
            <span className="block break-words whitespace-normal">{node}</span>
          ) : (
            node
          );

        if (!isExpandColumn) {
          return rendered;
        }

        const canExpand = row.getCanExpand();
        const isExpanded = row.getIsExpanded();

        return (
          <div
            className="flex items-center gap-1"
            style={{ paddingLeft: row.depth * indentSize }}
          >
            {canExpand ? (
              <button
                type="button"
                aria-label={isExpanded ? "Zeile einklappen" : "Zeile ausklappen"}
                aria-expanded={isExpanded}
                onClick={(event) => {
                  event.stopPropagation();
                  row.getToggleExpandedHandler()();
                }}
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded",
                  "text-muted-foreground hover:text-foreground",
                )}
              >
                {isExpanded ? (
                  <ChevronDownIcon className="size-4" />
                ) : (
                  <ChevronRightIcon className="size-4" />
                )}
              </button>
            ) : (
              <span
                className="inline-block shrink-0"
                style={{ width: "1rem" }}
              />
            )}
            <span className="min-w-0 flex-1">{rendered}</span>
          </div>
        );
      },
    };
  });
}
