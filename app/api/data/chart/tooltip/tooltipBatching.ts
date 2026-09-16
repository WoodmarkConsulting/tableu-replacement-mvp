import type { QueryParameters, TooltipDataPoint } from "@/app/api/utils/types";

export function getUniqueDataPoints(
  dataPoints: TooltipDataPoint[],
  parameterNames: string[],
): TooltipDataPoint[] {
  const seenValues = new Set<string>();

  return dataPoints.filter((dataPoint) => {
    const valueKey = JSON.stringify(
      parameterNames.map((name) =>
        Object.hasOwn(dataPoint, name) ? dataPoint[name] : null,
      ),
    );

    if (seenValues.has(valueKey)) {
      return false;
    }

    seenValues.add(valueKey);
    return true;
  });
}

export function buildTooltipQueryParameters(
  dataPoints: TooltipDataPoint[],
  parameterNames: string[],
): QueryParameters {
  return Object.fromEntries(
    parameterNames.map((name) => [
      name,
      JSON.stringify(
        dataPoints.map((dataPoint) =>
          Object.hasOwn(dataPoint, name) ? dataPoint[name] : null,
        ),
      ),
    ]),
  );
}
