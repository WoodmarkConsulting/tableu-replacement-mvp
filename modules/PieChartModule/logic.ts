import type { PieChartData } from "./chartDataSchema";

export type RenderSlice =
  | { kind: "source"; row: PieChartData }
  | {
      kind: "others";
      row: PieChartData;
      absorbedRows: readonly PieChartData[];
    };

function groupSlices(
  slices: RenderSlice[],
  config: PieChartConfig["groupOthers"],
): RenderSlice[] {
  if (!config?.enabled || slices.length === 0) {
    return slices;
  }

  let absorbedRows: PieChartData[];
  let keptSlices: RenderSlice[];

  if (config.mode === "topN") {
    const ranked = [...slices].sort((left, right) => {
      const difference = right.row.value - left.row.value;
      return difference === 0
        ? slices.indexOf(left) - slices.indexOf(right)
        : difference;
    });
    const keptRows = new Set(
      ranked
        .slice(0, Math.max(0, Math.floor(config.value)))
        .map((slice) => slice.row),
    );

    keptSlices = slices.filter((slice) => keptRows.has(slice.row));
    absorbedRows = slices
      .filter((slice) => !keptRows.has(slice.row))
      .map((slice) => slice.row);
  } else {
    const total = slices.reduce((sum, slice) => sum + slice.row.value, 0);

    keptSlices = slices.filter(
      (slice) => total > 0 && slice.row.value / total >= config.value,
    );
    absorbedRows = slices
      .filter((slice) => total === 0 || slice.row.value / total < config.value)
      .map((slice) => slice.row);
  }

  if (absorbedRows.length === 0) {
    return keptSlices;
  }

  return [
    ...keptSlices,
    {
      kind: "others",
      row: {
        name: config.label ?? "Sonstige",
        value: absorbedRows.reduce((sum, row) => sum + row.value, 0),
      },
      absorbedRows,
    },
  ];
}

function sortSlices(
  slices: RenderSlice[],
  sort: PieChartConfig["sort"],
): RenderSlice[] {
  if (!sort || sort.by === "none") {
    return slices;
  }

  const direction = sort.direction === "asc" ? 1 : -1;

  return [...slices].sort((left, right) => {
    const comparison =
      sort.by === "value"
        ? left.row.value - right.row.value
        : left.row.name.localeCompare(right.row.name);

    return comparison * direction;
  });
}

export function derivePieSlices(
  chartData: readonly PieChartData[],
  groupOthers: PieChartConfig["groupOthers"],
  sort: PieChartConfig["sort"],
): { slices: RenderSlice[]; total: number } {
  const sourceSlices: RenderSlice[] = chartData
    .filter((row) => row.value > 0)
    .map((row) => ({ kind: "source", row }));
  const slices = sortSlices(groupSlices(sourceSlices, groupOthers), sort);

  return {
    slices,
    total: slices.reduce((sum, slice) => sum + slice.row.value, 0),
  };
}

export function getSelectableSliceRow(
  slices: readonly RenderSlice[],
  index: number,
): PieChartData | null {
  const slice = slices[index];

  return slice?.kind === "source" ? slice.row : null;
}