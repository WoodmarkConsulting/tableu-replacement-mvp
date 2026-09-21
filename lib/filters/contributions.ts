export const contributionKey = (
  source: FilterSource,
  target: FilterTarget,
  dimensionId: string,
): string =>
  [
    source.kind,
    "actionId" in source ? source.actionId : source.dimensionId,
    target.kind,
    "tab" in target ? target.tab : "chartID" in target ? target.chartID : "",
    dimensionId,
  ].join("|");

type ApplicabilityScope = {
  tab: string;
  // Chart-targeted contributions apply when the target chart is this chart, or,
  // for tab-wide views such as the chip bar, any chart on the given tab.
  chartID?: string;
  chartIDsOnTab?: ReadonlySet<string>;
};

export const contributionAppliesTo = (
  contribution: FilterContribution,
  scope: ApplicabilityScope,
): boolean => {
  switch (contribution.target.kind) {
    case "dashboard":
      return true;
    case "tab":
      return contribution.target.tab === scope.tab;
    case "chart":
      return (
        contribution.target.chartID === scope.chartID ||
        (scope.chartIDsOnTab?.has(contribution.target.chartID) ?? false)
      );
  }
};

export const isEmptyFilterValue = (
  value: FilterValue | undefined,
): boolean =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === "object" &&
    !Array.isArray(value) &&
    value.from === null &&
    value.to === null);

const isDateRangeShape = (value: Record<string, unknown>): boolean => {
  const keys = Object.keys(value);

  return (
    keys.length === 2 &&
    keys.includes("from") &&
    keys.includes("to") &&
    (value.from === null || typeof value.from === "string") &&
    (value.to === null || typeof value.to === "string")
  );
};

export const isFilterValueShape = (value: unknown): value is FilterValue => {
  if (value === null || typeof value === "string" || typeof value === "number") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => typeof entry === "string");
  }

  return (
    typeof value === "object" && isDateRangeShape(value as Record<string, unknown>)
  );
};

// Structural check only; `matchesDimensionType` additionally validates the value
// against the dashboard's dimension definition.
export const isFilterContributionShape = (
  value: unknown,
): value is FilterContribution => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.key !== "string" ||
    typeof candidate.dimensionId !== "string" ||
    candidate.dimensionId === ""
  ) {
    return false;
  }

  const source = candidate.source;
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    return false;
  }
  const sourceRecord = source as Record<string, unknown>;
  if (sourceRecord.kind === "control") {
    if (typeof sourceRecord.dimensionId !== "string") {
      return false;
    }
  } else if (
    sourceRecord.kind === "tabJump" ||
    sourceRecord.kind === "chartSelection"
  ) {
    if (
      typeof sourceRecord.actionId !== "string" ||
      typeof sourceRecord.sourceChartID !== "string"
    ) {
      return false;
    }
  } else {
    return false;
  }

  const target = candidate.target;
  if (typeof target !== "object" || target === null || Array.isArray(target)) {
    return false;
  }
  const targetRecord = target as Record<string, unknown>;
  if (targetRecord.kind === "tab") {
    if (typeof targetRecord.tab !== "string") {
      return false;
    }
  } else if (targetRecord.kind === "chart") {
    if (typeof targetRecord.chartID !== "string") {
      return false;
    }
  } else if (targetRecord.kind !== "dashboard") {
    return false;
  }

  if (!isFilterValueShape(candidate.value)) {
    return false;
  }

  return (
    candidate.key ===
    contributionKey(
      source as FilterSource,
      target as FilterTarget,
      candidate.dimensionId,
    )
  );
};

export const matchesDimensionType = (
  dimension: FilterDimension,
  value: FilterValue,
): boolean => {
  switch (dimension.type) {
    case "multiselect":
      return Array.isArray(value);
    case "dateRange":
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    case "number":
      return typeof value === "number";
    default:
      return typeof value === "string";
  }
};

export const getControlTarget = (
  dimension: FilterDimension,
): FilterTarget | null => {
  if (!dimension.control) {
    return null;
  }

  return dimension.control.location === "dashboard"
    ? { kind: "dashboard" }
    : { kind: "tab", tab: dimension.control.tab };
};

export const createControlContribution = (
  dimension: FilterDimension,
  value: FilterValue,
): FilterContribution | null => {
  const target = getControlTarget(dimension);

  if (!target || isEmptyFilterValue(value)) {
    return null;
  }

  const source: FilterSource = {
    kind: "control",
    dimensionId: dimension.id,
  };

  return {
    key: contributionKey(source, target, dimension.id),
    dimensionId: dimension.id,
    source,
    target,
    value,
  };
};