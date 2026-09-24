import { contributionKey } from "./contributions";

export const ACTION_VALUE_LIMIT = 500;

export type ActionGateReason =
  | "noSelection"
  | "unknownDimension"
  | "undrillableDimension"
  | "nonPrimitiveField"
  | "multipleValuesForSingleSelect"
  | "valueLimitExceeded";

export type ActionGateResult =
  | { ok: true }
  | { ok: false; reason: ActionGateReason };

const isPrimitive = (value: unknown): value is string | number | boolean =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

function extractPrimitivesForMapping(
  action: ChartAction,
  mapping: FilterActionMapping,
  rows: Record<string, unknown>[],
):
  | { ok: true; primitives: (string | number | boolean)[] }
  | { ok: false; reason: ActionGateReason } {
  if (action.sourceResolution === "clientRow") {
    const rawValues: unknown[] = [];
    for (const row of rows) {
      let val: unknown = undefined;
      if (mapping.sourceField.startsWith("values.")) {
        const key = mapping.sourceField.slice("values.".length);
        val = (row.values as Record<string, unknown> | undefined)?.[key];
      } else {
        val = row[mapping.sourceField];
        if (
          val === undefined &&
          typeof row.values === "object" &&
          row.values !== null
        ) {
          val = (row.values as Record<string, unknown>)[mapping.sourceField];
        }
      }
      rawValues.push(val);
    }

    if (rawValues.every((v) => v === undefined)) {
      return { ok: false, reason: "nonPrimitiveField" };
    }
    if (rawValues.some((v) => v != null && !isPrimitive(v))) {
      return { ok: false, reason: "nonPrimitiveField" };
    }
    const primitives = rawValues.filter(
      (v): v is string | number | boolean => v != null,
    );
    if (primitives.length === 0) {
      return { ok: false, reason: "nonPrimitiveField" };
    }
    return { ok: true, primitives };
  }

  // tooltipLookup
  const primitives: (string | number | boolean)[] = [];
  let anyDefined = false;
  for (const row of rows) {
    const val = row[mapping.sourceField];
    if (val === undefined) {
      continue;
    }
    anyDefined = true;
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item == null) {
          continue;
        }
        if (!isPrimitive(item)) {
          return { ok: false, reason: "nonPrimitiveField" };
        }
        primitives.push(item);
      }
    } else if (val !== null) {
      if (!isPrimitive(val)) {
        return { ok: false, reason: "nonPrimitiveField" };
      }
      primitives.push(val);
    }
  }

  if (!anyDefined || primitives.length === 0) {
    return { ok: false, reason: "nonPrimitiveField" };
  }
  return { ok: true, primitives };
}

/**
 * Checks whether an action can be executed against the given rows.
 * Returns { ok: true } or { ok: false, reason } to explain why it is disabled.
 */
export function canExecuteAction(
  dimensions: FilterDimension[],
  action: ChartAction,
  rows: Record<string, unknown>[],
): ActionGateResult {
  if (rows.length === 0) {
    return { ok: false, reason: "noSelection" };
  }

  const limit = action.maxDistinctValues ?? ACTION_VALUE_LIMIT;

  for (const mapping of action.mappings) {
    const dimension = dimensions.find(
      (candidate) => candidate.id === mapping.targetDimensionId,
    );
    if (!dimension) {
      return { ok: false, reason: "unknownDimension" };
    }
    if (
      dimension.type === "dateString" ||
      dimension.type === "dateRange"
    ) {
      return { ok: false, reason: "undrillableDimension" };
    }

    const extraction = extractPrimitivesForMapping(action, mapping, rows);
    if (!extraction.ok) {
      return extraction;
    }

    const uniqueValues = Array.from(new Set(extraction.primitives));
    if (uniqueValues.length > limit) {
      return { ok: false, reason: "valueLimitExceeded" };
    }

    if (dimension.type !== "multiselect" && uniqueValues.length > 1) {
      return { ok: false, reason: "multipleValuesForSingleSelect" };
    }

    if (dimension.type === "number") {
      const numeric =
        typeof uniqueValues[0] === "number"
          ? uniqueValues[0]
          : Number(uniqueValues[0]);
      if (Number.isNaN(numeric)) {
        return { ok: false, reason: "nonPrimitiveField" };
      }
    }
  }

  return { ok: true };
}

/**
 * Resolves the FilterContribution entries an action would apply, or null when
 * the action cannot be executed. Values are deterministically deduplicated,
 * type-normalized, and sorted.
 */
export function resolveActionContributions(
  dimensions: FilterDimension[],
  action: ChartAction,
  rows: Record<string, unknown>[],
): FilterContribution[] | null {
  const gate = canExecuteAction(dimensions, action, rows);
  if (!gate.ok) {
    return null;
  }

  const contributions: FilterContribution[] = [];

  for (const mapping of action.mappings) {
    const dimension = dimensions.find(
      (candidate) => candidate.id === mapping.targetDimensionId,
    )!;

    const extraction = extractPrimitivesForMapping(action, mapping, rows);
    if (!extraction.ok) {
      return null;
    }

    const uniqueValues = Array.from(new Set(extraction.primitives));

    let value: FilterValue;
    if (dimension.type === "multiselect") {
      value = uniqueValues.map(String).sort();
    } else if (dimension.type === "number") {
      value =
        typeof uniqueValues[0] === "number"
          ? uniqueValues[0]
          : Number(uniqueValues[0]);
    } else {
      value = String(uniqueValues[0]);
    }

    const source: FilterSource = {
      kind: action.navigate ? "tabJump" : "chartSelection",
      actionId: action.id,
      sourceChartID: action.fromChartID as TableSchemaKey,
    };

    const target: FilterTarget =
      action.target.kind === "tab"
        ? { kind: "tab", tab: action.target.tab }
        : action.target.kind === "chart"
          ? { kind: "chart", chartID: action.target.chartID as TableSchemaKey }
          : { kind: "dashboard" };

    contributions.push({
      key: contributionKey(source, target, dimension.id),
      dimensionId: dimension.id,
      source,
      target,
      value,
    });
  }

  return contributions;
}
