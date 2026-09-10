import type { TableRowData } from "./chartDataSchema";

export type TableTreeRow = TableRowData & { subRows: TableTreeRow[] };

type AggregateKind = "sum" | "avg" | "min" | "max" | "count";

function createsCycle(
  parentOf: Map<string, string | null>,
  childId: string,
  parentId: string,
): boolean {
  let current: string | null = parentId;
  const seen = new Set<string>();

  while (current) {
    if (current === childId) {
      return true;
    }

    if (seen.has(current)) {
      return true;
    }

    seen.add(current);
    current = parentOf.get(current) ?? null;
  }

  return false;
}

/**
 * Builds a nested tree from a flat adjacency list. Orphan parents are treated as
 * top-level rows and cyclic edges are dropped (the row becomes top-level).
 */
export function buildTree(rows: TableRowData[]): TableTreeRow[] {
  const nodes = new Map<string, TableTreeRow>();
  const parentOf = new Map<string, string | null>();

  for (const row of rows) {
    nodes.set(row.id, { ...row, subRows: [] });
    parentOf.set(row.id, row.parentId);
  }

  const roots: TableTreeRow[] = [];

  for (const row of rows) {
    const node = nodes.get(row.id)!;
    const parentId = row.parentId;

    if (
      parentId &&
      parentId !== row.id &&
      nodes.has(parentId) &&
      !createsCycle(parentOf, row.id, parentId)
    ) {
      nodes.get(parentId)!.subRows.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function collectDescendantValues(node: TableTreeRow, valueKey: string): number[] {
  const values: number[] = [];

  for (const child of node.subRows) {
    const value = child.values[valueKey];

    if (typeof value === "number" && Number.isFinite(value)) {
      values.push(value);
    }

    values.push(...collectDescendantValues(child, valueKey));
  }

  return values;
}

export function aggregate(values: number[], kind: AggregateKind): number | null {
  if (kind === "count") {
    return values.length;
  }

  if (values.length === 0) {
    return null;
  }

  switch (kind) {
    case "sum":
      return values.reduce((total, value) => total + value, 0);
    case "avg":
      return values.reduce((total, value) => total + value, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      return null;
  }
}

/** Aggregates a numeric column over all descendants of a node (excluding the node). */
export function aggregateSubtree(
  node: TableTreeRow,
  valueKey: string,
  kind: AggregateKind,
): number | null {
  return aggregate(collectDescendantValues(node, valueKey), kind);
}
