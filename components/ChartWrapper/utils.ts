import type { PointerEvent } from "react";
import { z } from "zod";

import { apiFetch } from "@/app/api/utils/apiFetch";
import type {
  ChartQueryValue,
  TooltipDataPoint,
  TooltipPathResponse,
  TooltipStreamEvent,
} from "@/app/api/utils/types";
import type { QueryTiming } from "@/stores/queryTimingStore";

let lastTooltipResponse: {
  requestKey: string;
  response: TooltipPathResponse;
} | null = null;

/**
 * Converts a dashboard filter value into a scalar value accepted by chart APIs.
 * Complex filter values return `null` until they have a dedicated binding.
 */
export function toQueryParam(
  value: FilterValue | undefined,
): string | number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(",") : null;
  }

  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  return null;
}

/**
 * Validates optional mock rows against a module schema.
 *
 * @throws When the provided rows do not satisfy the module's data schema.
 */
export function parseMockData<TData extends object>(
  mockData: unknown[] | undefined,
  dataSchema: z.ZodType<TData>,
  chartID: string,
): TData[] | undefined {
  if (mockData === undefined) {
    return undefined;
  }

  const result = z.array(dataSchema).safeParse(mockData);

  if (!result.success) {
    throw new Error(
      `Invalid mockData for chartID "${chartID}": ${result.error.message}`,
    );
  }

  return result.data;
}

export function fetchTooltipData(
  chartID: string,
  dataPoints: TooltipDataPoint[],
  signal?: AbortSignal,
  onProgress?: (response: TooltipPathResponse) => void,
): Promise<TooltipPathResponse> {
  const body = { chartID, dataPoints };
  const requestKey = JSON.stringify(body);

  if (lastTooltipResponse?.requestKey === requestKey) {
    return Promise.resolve(lastTooltipResponse.response);
  }

  return fetch("/api/data/chart/tooltip", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal,
    body: requestKey,
  }).then(async (response) => {
    if (!response.ok) {
      let errorMessage = "Unknown error";

      try {
        const responseBody = (await response.json()) as { error?: unknown };

        if (typeof responseBody.error === "string") {
          errorMessage = responseBody.error;
        }
      } catch {
        errorMessage = `HTTP ${response.status}`;
      }

      throw new Error(`API request failed: ${errorMessage}`);
    }

    if (!response.body) {
      throw new Error("Tooltip API response has no readable stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const tooltipData: TooltipPathResponse = {
      dataPoint: [],
      failedBatches: 0,
    };
    let bufferedText = "";
    let isComplete = false;

    const processLine = (line: string) => {
      if (!line.trim()) {
        return;
      }

      const event = JSON.parse(line) as TooltipStreamEvent;

      if (event.type === "batch") {
        tooltipData.dataPoint.push(...event.dataPoint);
        onProgress?.({
          dataPoint: [...tooltipData.dataPoint],
          failedBatches: tooltipData.failedBatches,
        });
      } else if (event.type === "error") {
        tooltipData.failedBatches = (tooltipData.failedBatches ?? 0) + 1;
        onProgress?.({
          dataPoint: [...tooltipData.dataPoint],
          failedBatches: tooltipData.failedBatches,
        });
      } else if (event.type === "done") {
        tooltipData.failedBatches = event.failedBatches;
        isComplete = true;
      }
    };

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      bufferedText += decoder.decode(value, { stream: true });
      const lines = bufferedText.split("\n");
      bufferedText = lines.pop() ?? "";
      lines.forEach(processLine);
    }

    bufferedText += decoder.decode();
    processLine(bufferedText);

    if (!isComplete) {
      throw new Error("Tooltip API stream ended before completion.");
    }

    if (!tooltipData.failedBatches) {
      lastTooltipResponse = { requestKey, response: tooltipData };
    }

    return tooltipData;
  });
}

/**
 * Fetches and validates chart rows while recording development query timing.
 *
 * @throws When the request fails or returned rows do not match the schema.
 */
export async function fetchTimedChartData<TSchema extends z.ZodTypeAny>(
  chartID: string,
  chartTitle: string | undefined,
  filters: Record<string, ChartQueryValue>,
  dataSchema: TSchema,
  recordTiming: (timing: QueryTiming) => void,
): Promise<z.infer<TSchema>[]> {
  const start = performance.now();
  const result = await fetchChartData(chartID, filters, dataSchema);

  if (process.env.NODE_ENV === "development") {
    recordTiming({
      chartID,
      label: chartTitle,
      durationMs: performance.now() - start,
      timestamp: Date.now(),
    });
  }

  return result;
}

/** Converts pointer viewport coordinates into interaction-surface coordinates. */
export function getSurfacePoint(
  event: PointerEvent<HTMLDivElement>,
  surface: HTMLDivElement,
): LassoPoint {
  const bounds = surface.getBoundingClientRect();

  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
}

/** Returns whether a point lies inside or on the edge of the plot bounds. */
export function isPointInBounds(
  point: LassoPoint,
  bounds: LassoPlotBounds,
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/** Restricts a point to the nearest position inside the plot bounds. */
export function clampPointToBounds(
  point: LassoPoint,
  bounds: LassoPlotBounds,
): LassoPoint {
  return {
    x: Math.min(Math.max(point.x, bounds.x), bounds.x + bounds.width),
    y: Math.min(Math.max(point.y, bounds.y), bounds.y + bounds.height),
  };
}

/**
 * Converts a pixel rectangle into plot-relative coordinates ranging from 0 to 1.
 */
export function createNormalizedRectangle(
  start: LassoPoint,
  end: LassoPoint,
  bounds: LassoPlotBounds,
): LassoRectangle {
  return {
    kind: "rectangle",
    start: {
      x: (start.x - bounds.x) / bounds.width,
      y: (start.y - bounds.y) / bounds.height,
    },
    end: {
      x: (end.x - bounds.x) / bounds.width,
      y: (end.y - bounds.y) / bounds.height,
    },
  };
}

/** Converts a pixel polygon into plot-relative coordinates ranging from 0 to 1. */
export function createNormalizedPolygon(
  points: LassoPoint[],
  bounds: LassoPlotBounds,
): LassoPolygon {
  return {
    kind: "polygon",
    points: points.map((point) => ({
      x: (point.x - bounds.x) / bounds.width,
      y: (point.y - bounds.y) / bounds.height,
    })),
  };
}

/** Requests chart rows from the API and validates every row against the schema. */
async function fetchChartData<TSchema extends z.ZodTypeAny>(
  chartID: string,
  filters: Record<string, ChartQueryValue>,
  dataSchema: TSchema,
): Promise<z.infer<TSchema>[]> {
  const response = await apiFetch(`/api/data/chart/${chartID}`, {
    method: "POST",
    body: {
      filters,
    },
  });

  const validationResult = z.array(dataSchema).safeParse(response);

  if (!validationResult.success) {
    throw new Error(
      `Invalid chart data returned by the API: ${validationResult.error.message}`,
    );
  }

  return validationResult.data;
}
