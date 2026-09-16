import type { QueryParameters } from "@/app/api/utils/types";

export function buildChartInputParameters(
  input: QueryParameters | undefined,
): QueryParameters {
  return {
    input: JSON.stringify(input ?? {}),
  };
}
