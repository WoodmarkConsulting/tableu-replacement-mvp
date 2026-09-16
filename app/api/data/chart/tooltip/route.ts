import { NextRequest } from "next/server";
import {
  APIEndpoint,
  TooltipPath,
  TooltipStreamEvent,
} from "../../../utils/types";
import { buildErrorMessage } from "@/app/api/router/errorhandler";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { runQuery } from "@/app/api/warehouse/connection";
import {
  buildTooltipQueryParameters,
  getUniqueDataPoints,
} from "./tooltipBatching";

type RequestBody = APIEndpoint<TooltipPath>["POST"]["body"];

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

const TOOLTIP_BATCH_SIZE = getPositiveInteger(
  process.env.TOOLTIP_BATCH_SIZE,
  6000,
  // 12_000,
);
const TOOLTIP_STREAM_CHUNK_SIZE = getPositiveInteger(
  process.env.TOOLTIP_STREAM_CHUNK_SIZE,
  250,
);
const MAX_CONCURRENT_TOOLTIP_QUERIES = getPositiveInteger(
  process.env.TOOLTIP_MAX_CONCURRENT_QUERIES,
  5,
);
const SQL_PARAMETER_PATTERN = /(?<!:):([A-Za-z_][A-Za-z0-9_]*)/g;

let activeTooltipQueries = 0;
const tooltipQueryWaiters: Array<() => void> = [];

const pathToSqlDir = path.join(
  process.cwd(),
  "pagesConfig",
  "sql",
  "tooltipSql",
);

async function withTooltipQuerySlot<T>(query: () => Promise<T>): Promise<T> {
  if (activeTooltipQueries >= MAX_CONCURRENT_TOOLTIP_QUERIES) {
    await new Promise<void>((resolve) => tooltipQueryWaiters.push(resolve));
  } else {
    activeTooltipQueries += 1;
  }

  try {
    return await query();
  } finally {
    const nextWaiter = tooltipQueryWaiters.shift();

    if (nextWaiter) {
      nextWaiter();
    } else {
      activeTooltipQueries -= 1;
    }
  }
}

function getSqlParameterNames(sqlQuery: string): string[] {
  return Array.from(
    new Set(
      Array.from(sqlQuery.matchAll(SQL_PARAMETER_PATTERN), (match) => match[1]),
    ),
  );
}

function createBatches<T>(values: T[], batchSize: number): T[][] {
  const batches: T[][] = [];

  for (let start = 0; start < values.length; start += batchSize) {
    batches.push(values.slice(start, start + batchSize));
  }

  return batches;
}

function encodeStreamEvent(
  encoder: TextEncoder,
  event: TooltipStreamEvent,
): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

export async function POST(_req: NextRequest) {
  let dataPoints: RequestBody["dataPoints"];
  let chartID: RequestBody["chartID"];

  try {
    const body = (await _req.json()) as RequestBody;
    dataPoints = body.dataPoints;
    chartID = body.chartID;
  } catch (error) {
    console.error("Error parsing request body:", error);
    return buildErrorMessage({
      message: "Invalid request body",
      httpStatus: 400,
    });
  }

  if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
    return buildErrorMessage({
      message: "Missing dataPoints parameter",
      httpStatus: 400,
    });
  }

  const sqlFilePath = path.resolve(pathToSqlDir, `${chartID}.tooltip.sql`);

  // Prevent access to files outside the SQL directory.
  if (!sqlFilePath.startsWith(`${path.resolve(pathToSqlDir)}${path.sep}`)) {
    return buildErrorMessage({
      message: "Invalid chartID parameter",
      httpStatus: 400,
    });
  }

  let sqlQuery: string;

  try {
    sqlQuery = await readFile(sqlFilePath, "utf8");
  } catch (error) {
    console.error(`Failed to read SQL file for chartID "${chartID}":`, error);

    return buildErrorMessage({
      message: `SQL file not found for chartID: ${chartID}`,
      httpStatus: 404,
    });
  }

  const parameterNames = getSqlParameterNames(sqlQuery);

  if (parameterNames.length === 0) {
    return buildErrorMessage({
      message: `Tooltip SQL has no named parameters for chartID: ${chartID}`,
      httpStatus: 400,
    });
  }

  const uniqueDataPoints = getUniqueDataPoints(dataPoints, parameterNames);
  const batches = createBatches(uniqueDataPoints, TOOLTIP_BATCH_SIZE);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let completedBatches = 0;
      let failedBatches = 0;
      let nextBatchIndex = 0;

      const processNextBatch = async () => {
        while (nextBatchIndex < batches.length) {
          const batchIndex = nextBatchIndex;
          const batch = batches[nextBatchIndex];
          nextBatchIndex += 1;

          try {
            const data = await withTooltipQuerySlot(() =>
              runQuery<Record<string, unknown>[]>(
                sqlQuery,
                buildTooltipQueryParameters(batch, parameterNames),
                false,
              ),
            );

            completedBatches += 1;

            for (const dataPoint of createBatches(
              data,
              TOOLTIP_STREAM_CHUNK_SIZE,
            )) {
              controller.enqueue(
                encodeStreamEvent(encoder, {
                  type: "batch",
                  batchIndex,
                  dataPoint,
                }),
              );
              await new Promise<void>((resolve) => setImmediate(resolve));
            }
          } catch (error) {
            failedBatches += 1;
            console.error(
              `Failed to execute tooltip batch ${batchIndex} for chartID "${chartID}":`,
              error,
            );
            controller.enqueue(
              encodeStreamEvent(encoder, {
                type: "error",
                batchIndex,
                message:
                  "Ein Teil der Tooltip-Daten konnte nicht geladen werden.",
              }),
            );
          }
        }
      };

      void Promise.all(
        Array.from(
          { length: Math.min(MAX_CONCURRENT_TOOLTIP_QUERIES, batches.length) },
          processNextBatch,
        ),
      ).then(() => {
        controller.enqueue(
          encodeStreamEvent(encoder, {
            type: "done",
            completedBatches,
            failedBatches,
            totalBatches: batches.length,
          }),
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
