"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ExpandedState,
  type PaginationState,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Eye, SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { TableRowData } from "./chartDataSchema";
import { aggregate, buildTree, type TableTreeRow } from "./tree";
import { resolveDomain, type BarDomain } from "./dataBar";
import {
  alignClass,
  buildColumnDefs,
  type TableColumnMeta,
} from "./columns";
import { formatCellValue, getColumnValueKey } from "./format";

type Props = ChartWrapperInjectedProps<TableRowData, TableChartConfig>;

function toCleanRow(row: TableTreeRow): TableRowData {
  return { id: row.id, parentId: row.parentId, values: row.values };
}

function computeInitialExpanded(
  nodes: TableTreeRow[],
  maxDepth: number,
  depth = 0,
  acc: Record<string, boolean> = {},
): Record<string, boolean> {
  for (const node of nodes) {
    if (node.subRows.length > 0 && depth < maxDepth) {
      acc[node.id] = true;
      computeInitialExpanded(node.subRows, maxDepth, depth + 1, acc);
    }
  }

  return acc;
}

function TableModule(props: Props) {
  const { chartConfig, chartData, height, onSelectionChange, selectedRows } =
    props;

  const selectionEnabled = typeof onSelectionChange === "function";

  const tree = useMemo(() => buildTree(chartData), [chartData]);

  const domains = useMemo(() => {
    const map = new Map<string, BarDomain>();

    for (const column of chartConfig.columns) {
      if (column.dataBar?.enabled) {
        map.set(column.id, resolveDomain(column, chartData));
      }
    }

    return map;
  }, [chartConfig.columns, chartData]);

  const columns = useMemo(
    () => buildColumnDefs(chartConfig, domains),
    [chartConfig, domains],
  );

  // User-driven column hide/show layer (initialised from `hidden`).
  const [userVisibility, setUserVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(
      chartConfig.columns.map((column) => [column.id, !column.hidden]),
    ),
  );

  // Column-group fold/unfold layer (true = folded).
  const [foldedGroups, setFoldedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      (chartConfig.columnGroups ?? []).map((group) => [
        group.id,
        group.defaultState !== "unfolded",
      ]),
    ),
  );

  const [sorting, setSorting] = useState<SortingState>(() =>
    chartConfig.sorting.defaultSort
      ? [
          {
            id: chartConfig.sorting.defaultSort.columnId,
            desc: chartConfig.sorting.defaultSort.direction === "desc",
          },
        ]
      : [],
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [expanded, setExpanded] = useState<ExpandedState>(() =>
    chartConfig.hierarchy.enabled
      ? computeInitialExpanded(tree, chartConfig.hierarchy.defaultExpandedDepth)
      : {},
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: chartConfig.pagination.pageSize || 25,
  });

  // Merge the user-visibility and group-fold layers into a single map.
  const columnVisibility = useMemo<VisibilityState>(() => {
    const merged: VisibilityState = { ...userVisibility };

    for (const group of chartConfig.columnGroups ?? []) {
      if (!foldedGroups[group.id]) {
        continue;
      }

      for (const memberId of group.memberColumnIds) {
        merged[memberId] = memberId === group.summaryColumnId;
      }
    }

    return merged;
  }, [userVisibility, foldedGroups, chartConfig.columnGroups]);

  const table = useReactTable<TableTreeRow>({
    data: tree,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      expanded,
      columnVisibility,
      pagination,
    },
    getRowId: (row) => row.id,
    getSubRows: (row) => row.subRows,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: chartConfig.pagination.enabled
      ? getPaginationRowModel()
      : undefined,
    globalFilterFn: (row, _columnId, filterValue) => {
      const needle = String(filterValue ?? "").toLowerCase();

      if (!needle) {
        return true;
      }

      return Object.values(row.original.values).some(
        (value) =>
          value !== null &&
          value !== undefined &&
          String(value).toLowerCase().includes(needle),
      );
    },
    enableGlobalFilter: chartConfig.filtering.globalSearch,
    filterFromLeafRows: true,
    paginateExpandedRows: false,
    autoResetExpanded: false,
    autoResetPageIndex: false,
    enableSortingRemoval: false,
  });

  const selectedIds = useMemo(
    () => new Set(selectedRows.map((row) => row.id)),
    [selectedRows],
  );

  const visibleLeafColumns = table.getVisibleLeafColumns();

  const footerCells = useMemo(() => {
    if (!chartConfig.footer.show) {
      return null;
    }

    const leafRows = table
      .getFilteredRowModel()
      .flatRows.filter((row) => !row.getCanExpand());

    const configById = new Map(
      chartConfig.columns.map((column) => [column.id, column]),
    );

    return visibleLeafColumns.map((leafColumn, index) => {
      const column = configById.get(leafColumn.id);

      if (index === 0) {
        return {
          id: leafColumn.id,
          content: chartConfig.footer.label ?? "Gesamt",
          align: "left" as const,
        };
      }

      const kind = column?.footerAggregate ?? "none";

      if (!column || kind === "none") {
        return { id: leafColumn.id, content: "", align: "left" as const };
      }

      const valueKey = getColumnValueKey(column);
      const values = leafRows
        .map((row) => row.original.values[valueKey])
        .filter(
          (value): value is number =>
            typeof value === "number" && Number.isFinite(value),
        );

      const result = aggregate(values, kind);
      const content =
        result === null ? "" : formatCellValue(result, column) ?? "";
      const align: TableColumnMeta["align"] =
        (leafColumn.columnDef.meta as TableColumnMeta | undefined)?.align ??
        "left";

      return { id: leafColumn.id, content, align };
    });
  }, [chartConfig.footer, chartConfig.columns, table, visibleLeafColumns]);

  const toggleableColumns = chartConfig.columns.filter(
    (column) => !column.lockVisibility,
  );

  const densityCellClass =
    chartConfig.appearance.density === "compact" ? "py-1" : "py-2";

  const handleRowClick = (
    row: Row<TableTreeRow>,
    event: React.MouseEvent<HTMLTableRowElement>,
  ) => {
    if (!onSelectionChange) {
      return;
    }

    onSelectionChange([toCleanRow(row.original)], {
      additive: event.ctrlKey || event.metaKey,
    });
  };

  const firstColumnId = visibleLeafColumns[0]?.id;
  const stickyFirst = chartConfig.appearance.stickyFirstColumn;
  const stickyHeader = chartConfig.appearance.stickyHeader;

  return (
    <div className="flex w-full flex-col gap-2">
      {(chartConfig.filtering.globalSearch ||
        chartConfig.columnMenu.show ||
        (chartConfig.columnGroups?.length ?? 0) > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {chartConfig.filtering.globalSearch && (
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                placeholder={
                  chartConfig.filtering.searchPlaceholder ?? "Suchen..."
                }
                className="h-8 w-52 pl-8"
              />
            </div>
          )}

          {(chartConfig.columnGroups ?? []).map((group) => (
            <Button
              key={group.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setFoldedGroups((previous) => ({
                  ...previous,
                  [group.id]: !previous[group.id],
                }))
              }
            >
              {group.header}: {foldedGroups[group.id] ? "ausklappen" : "einklappen"}
            </Button>
          ))}

          {chartConfig.columnMenu.show && toggleableColumns.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="ml-auto size-8"
                  aria-label={chartConfig.columnMenu.label ?? "Spalten"}
                >
                  <Eye className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52">
                <div className="flex flex-col gap-1">
                  {toggleableColumns.map((column) => (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={userVisibility[column.id] ?? true}
                        onChange={(event) =>
                          setUserVisibility((previous) => ({
                            ...previous,
                            [column.id]: event.target.checked,
                          }))
                        }
                      />
                      {column.header}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      <div
        className={cn("w-full overflow-auto rounded-md border")}
        style={{ height: `${height || 15}svh` }}
      >
        <table className="w-full caption-bottom text-xs">
          <TableHeader
            className={cn(stickyHeader && "sticky top-0 z-20 bg-background")}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    | TableColumnMeta
                    | undefined;
                  const canSort = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  const isFirst = header.column.id === firstColumnId;

                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sortDirection === "asc"
                          ? "ascending"
                          : sortDirection === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        alignClass(meta?.align ?? "left"),
                        stickyHeader && "bg-background",
                        isFirst &&
                          stickyFirst &&
                          "sticky left-0 z-10 bg-background",
                      )}
                    >
                      <div
                        className={cn(
                          "flex flex-col gap-1",
                          meta?.align === "right" && "items-end",
                          meta?.align === "center" && "items-center",
                        )}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            <span aria-hidden="true">
                              {sortDirection === "asc"
                                ? "▲"
                                : sortDirection === "desc"
                                  ? "▼"
                                  : "↕"}
                            </span>
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}

                        {header.column.getCanFilter() && (
                          <Input
                            value={(header.column.getFilterValue() as string) ?? ""}
                            onChange={(event) =>
                              header.column.setFilterValue(event.target.value)
                            }
                            placeholder="Filter"
                            className="h-6 w-full min-w-[80px] text-xs font-normal"
                          />
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleLeafColumns.length}
                  className="py-6 text-center text-muted-foreground"
                >
                  Keine Daten
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row, rowIndex) => {
                const isSelected = selectedIds.has(row.original.id);

                return (
                  <TableRow
                    key={row.id}
                    data-state={isSelected ? "selected" : undefined}
                    onClick={
                      selectionEnabled
                        ? (event) => handleRowClick(row, event)
                        : undefined
                    }
                    className={cn(
                      selectionEnabled && "cursor-pointer",
                      chartConfig.appearance.zebraStripes &&
                        rowIndex % 2 === 1 &&
                        "bg-muted/40",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as
                        | TableColumnMeta
                        | undefined;
                      const isFirst = cell.column.id === firstColumnId;

                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            alignClass(meta?.align ?? "left"),
                            densityCellClass,
                            isFirst &&
                              stickyFirst &&
                              "sticky left-0 z-10 bg-background",
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>

          {footerCells && (
            <TableFooter
              className={cn(stickyHeader && "sticky bottom-0 z-20 bg-muted")}
            >
              <TableRow>
                {footerCells.map((footerCell, index) => (
                  <TableCell
                    key={footerCell.id}
                    className={cn(
                      alignClass(footerCell.align),
                      densityCellClass,
                      index === 0 &&
                        stickyFirst &&
                        "sticky left-0 z-10 bg-muted",
                    )}
                  >
                    {footerCell.content}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </table>
      </div>

      {chartConfig.pagination.enabled && table.getPageCount() > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Zurück
          </Button>
          <span>
            Seite {table.getState().pagination.pageIndex + 1} von{" "}
            {table.getPageCount()}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Weiter
          </Button>
        </div>
      )}
    </div>
  );
}

export default TableModule;
