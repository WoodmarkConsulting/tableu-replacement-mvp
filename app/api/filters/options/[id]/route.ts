import type { NextRequest } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { buildErrorMessage } from "../../../router/errorhandler";
import { runQuery } from "../../../warehouse/connection";

const pathToSqlDir = path.join(
  process.cwd(),
  "pagesConfig",
  "sql",
  "filterOptions",
);

function toOption(row: Record<string, unknown>): FilterOption | null {
  const rawValue = row.value ?? row.label;

  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const value = String(rawValue);
  const label = row.label === null || row.label === undefined
    ? value
    : String(row.label);

  return { label, value };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  if (!id) {
    return buildErrorMessage({
      message: "Missing options source id",
      httpStatus: 400,
    });
  }

  const sqlFilePath = path.resolve(pathToSqlDir, `${id}.sql`);

  // Prevent access to files outside the filter options SQL directory.
  if (!sqlFilePath.startsWith(`${path.resolve(pathToSqlDir)}${path.sep}`)) {
    return buildErrorMessage({
      message: "Invalid options source id",
      httpStatus: 400,
    });
  }

  let sqlQuery: string;

  try {
    sqlQuery = await readFile(sqlFilePath, "utf8");
  } catch (error) {
    console.error(`Failed to read options SQL for "${id}":`, error);

    return buildErrorMessage({
      message: `Options SQL file not found for id: ${id}`,
      httpStatus: 404,
    });
  }

  let rows: Record<string, unknown>[];

  try {
    rows = await runQuery<Record<string, unknown>[]>(sqlQuery);
  } catch (error) {
    console.error(`Failed to execute options SQL for "${id}":`, error);

    return buildErrorMessage({
      message: `Failed to execute options SQL for id: ${id}`,
      httpStatus: 500,
    });
  }

  const options = rows
    .map(toOption)
    .filter((option): option is FilterOption => option !== null);

  return Response.json(options satisfies FilterOption[]);
}
