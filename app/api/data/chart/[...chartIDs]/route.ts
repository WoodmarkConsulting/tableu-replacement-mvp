import type { NextRequest } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { buildErrorMessage } from "../../../router/errorhandler";
import { runQuery } from "../../../warehouse/connection";
import type { APIEndpoint, ChartDataPath } from "../../../utils/types";

type RequestBody = APIEndpoint<ChartDataPath>["POST"]["body"];
type Response = APIEndpoint<ChartDataPath>["POST"]["response"];

const pathToSqlDir = path.join(process.cwd(), "pagesConfig", "sql");

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/data/chart/[...chartIDs]">,
) {
  const { chartIDs } = await ctx.params;
  const { filters } = (await _req.json()) as RequestBody;
  const chartID = chartIDs[0];

  if (!chartID) {
    return buildErrorMessage({
      message: "Missing chartID parameter",
      httpStatus: 400,
    });
  }

  const sqlFilePath = path.resolve(pathToSqlDir, `${chartID}.sql`);

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

  let data;

  try {
    data = await runQuery<Response[]>(sqlQuery, filters);
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

  console.log("Data fetched for chartID:", chartID, data);

  return Response.json(data satisfies Response);
}
