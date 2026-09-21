import { contributionAppliesTo, isEmptyFilterValue } from "./contributions";

export type ResolvedChartFilters = {
  dimensionValues: Record<string, FilterValue>;
  params: Record<string, string | number | null>;
  impossible: boolean;
  // Dimension ids whose contributions cannot be satisfied together.
  conflicts: string[];
  // Contribution keys behind `conflicts`, so the UI can offer removal.
  conflictKeys: string[];
};

type ResolveChartFiltersArgs = {
  chartID: string;
  tab: string;
  dimensions: FilterDimension[];
  contributions: FilterContribution[];
  bindings?: Record<string, string>;
};

const asValues = (value: FilterValue): string[] => {
  const values = Array.isArray(value) ? value : [value];
  return Array.from(new Set(values.map(String))).sort();
};

const composeSets = (
  sets: string[][],
  rule: CompositionRule,
): string[] => {
  if (sets.length === 0) {
    return [];
  }

  if (rule === "union") {
    return Array.from(new Set(sets.flat())).sort();
  }

  const remaining = new Set(sets[0]);
  for (const values of sets.slice(1)) {
    const current = new Set(values);
    for (const value of remaining) {
      if (!current.has(value)) {
        remaining.delete(value);
      }
    }
  }

  return Array.from(remaining).sort();
};

const resolveEnumerable = (
  dimension: FilterDimension,
  contributions: FilterContribution[],
): string[] => {
  const bySourceKind = new Map<FilterSource["kind"], string[][]>();

  for (const contribution of contributions) {
    const sourceValues = bySourceKind.get(contribution.source.kind) ?? [];
    sourceValues.push(asValues(contribution.value));
    bySourceKind.set(contribution.source.kind, sourceValues);
  }

  const sameSourceRule = dimension.composition?.sameSourceKind ?? "union";
  const sourceConstraints = Array.from(bySourceKind.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, values]) => composeSets(values, sameSourceRule));

  return composeSets(
    sourceConstraints,
    dimension.composition?.crossSourceKind ?? "intersect",
  );
};

const serializeValue = (
  dimension: FilterDimension,
  value: FilterValue,
): string | number | null => {
  if (dimension.type === "multiselect") {
    return Array.isArray(value) && value.length > 0 ? value.join(",") : null;
  }

  return typeof value === "string" || typeof value === "number" ? value : null;
};

export function resolveChartFilters({
  chartID,
  tab,
  dimensions,
  contributions,
  bindings = {},
}: ResolveChartFiltersArgs): ResolvedChartFilters {
  const dimensionValues: Record<string, FilterValue> = {};
  const params: Record<string, string | number | null> = {};
  const conflicts: string[] = [];
  const conflictKeys = new Set<string>();
  const dimensionsById = new Map(
    dimensions.map((dimension) => [dimension.id, dimension]),
  );

  for (const dimensionId of Object.keys(bindings).sort()) {
    const dimension = dimensionsById.get(dimensionId);
    if (!dimension) {
      continue;
    }

    const applicable = contributions
      .filter(
        (contribution) =>
          contribution.dimensionId === dimensionId &&
          !isEmptyFilterValue(contribution.value) &&
          contributionAppliesTo(contribution, { chartID, tab }),
      )
      .sort((left, right) => left.key.localeCompare(right.key));

    if (applicable.length === 0) {
      params[bindings[dimensionId]] = null;
      continue;
    }

    const markConflict = () => {
      conflicts.push(dimensionId);
      for (const contribution of applicable) {
        conflictKeys.add(contribution.key);
      }
    };

    let value: FilterValue;
    if (["select", "multiselect", "option"].includes(dimension.type)) {
      const values = resolveEnumerable(dimension, applicable);
      if (values.length === 0) {
        markConflict();
        continue;
      }
      if (dimension.type !== "multiselect" && values.length !== 1) {
        markConflict();
        continue;
      }
      value = dimension.type === "multiselect" ? values : values[0];
    } else if (dimension.type === "dateRange") {
      // One SQL field cannot carry a range. Config validation rejects this
      // binding, so surface it as a conflict rather than an unfiltered query.
      markConflict();
      continue;
    } else {
      // Multiple producers are fine as long as they all agree on the value.
      const distinct = new Map(
        applicable.map((contribution) => [
          JSON.stringify(contribution.value),
          contribution.value,
        ]),
      );
      if (distinct.size !== 1) {
        markConflict();
        continue;
      }
      value = applicable[0].value;
    }

    dimensionValues[dimensionId] = value;
    params[bindings[dimensionId]] = serializeValue(dimension, value);
  }

  return {
    dimensionValues,
    params,
    impossible: conflicts.length > 0,
    conflicts: conflicts.sort(),
    conflictKeys: Array.from(conflictKeys).sort(),
  };
}