import { contributionKey } from "./contributions";

const isPrimitive = (value: unknown): value is string | number | boolean =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

/**
 * Builds the contributions a tab jump would apply, or `null` when the jump is
 * not applicable. Menu gating and store execution share this single rule set so
 * an enabled drilldown can never silently no-op.
 */
export function resolveTabJumpContributions(
  dimensions: FilterDimension[],
  jump: TabJumpConfig,
  selectedRows: Record<string, unknown>[],
): FilterContribution[] | null {
  if (selectedRows.length === 0) {
    return null;
  }

  const contributions: FilterContribution[] = [];

  for (const mapping of jump.mappings) {
    const raw = selectedRows.map((row) => row[mapping.sourceField]);
    if (
      raw.every((value) => value === undefined) ||
      raw.some((value) => value != null && !isPrimitive(value))
    ) {
      return null;
    }

    const uniqueValues = Array.from(
      new Set(raw.filter((value) => value != null)),
    ) as (string | number | boolean)[];
    if (uniqueValues.length === 0) {
      return null;
    }

    const dimension = dimensions.find(
      (candidate) => candidate.id === mapping.targetDimensionId,
    );
    if (
      !dimension ||
      dimension.type === "dateString" ||
      dimension.type === "dateRange"
    ) {
      return null;
    }

    let value: FilterValue;
    if (dimension.type === "multiselect") {
      value = uniqueValues.map(String);
    } else if (uniqueValues.length > 1) {
      return null;
    } else if (dimension.type === "number") {
      const numeric =
        typeof uniqueValues[0] === "number"
          ? uniqueValues[0]
          : Number(uniqueValues[0]);
      if (Number.isNaN(numeric)) {
        return null;
      }
      value = numeric;
    } else {
      value = String(uniqueValues[0]);
    }

    const source: FilterSource = {
      kind: "tabJump",
      actionId: jump.id,
      sourceChartID: jump.fromChartID,
    };
    const target: FilterTarget = { kind: "tab", tab: jump.targetTab };

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
