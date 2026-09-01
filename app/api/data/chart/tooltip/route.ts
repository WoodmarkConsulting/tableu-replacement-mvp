import { NextRequest } from "next/server";
import {
  APIEndpoint,
  QueryParameters,
  TooltipPath,
} from "../../../utils/types";
import { buildErrorMessage } from "@/app/api/router/errorhandler";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { runQuery } from "@/app/api/warehouse/connection";

type RequestBody = APIEndpoint<TooltipPath>["POST"]["body"];

type ResponseBody = APIEndpoint<TooltipPath>["POST"]["response"];

const pathToSqlDir = path.join(
  process.cwd(),
  "pagesConfig",
  "sql",
  "tooltipSql",
);

export async function POST(_req: NextRequest) {
  let dataPoint: RequestBody["dataPoint"];
  let chartID: RequestBody["chartID"];

  try {
    const body = (await _req.json()) as RequestBody;
    dataPoint = body.dataPoint;
    chartID = body.chartID;
  } catch (error) {
    console.error("Error parsing request body:", error);
    return buildErrorMessage({
      message: "Invalid request body",
      httpStatus: 400,
    });
  }

  if (!dataPoint) {
    return buildErrorMessage({
      message: "Missing dataPoint parameter",
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

  let data: { [key: string]: unknown };

  const queryParameters: QueryParameters = Object.fromEntries(
    Object.entries(dataPoint).map(([key, value]) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        return [key, value];
      }

      return [key, JSON.stringify(value)];
    }),
  );

  try {
    data = await runQuery<{ [key: string]: unknown }>(
      sqlQuery,
      queryParameters,
    );
  } catch (error) {
    console.error(
      `Failed to execute SQL query for chartID "${chartID}":`,
      error,
    );

    return buildErrorMessage({
      message: `Failed to execute SQL query for chartID: ${chartID}`,
      httpStatus: 500,
    });
  }

  return new Response(JSON.stringify({ dataPoint: data } as ResponseBody), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
