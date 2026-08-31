import type { NextRequest } from "next/server";

import { buildErrorMessage } from "../../../router/errorhandler";
import { loadSnapshot } from "../../snapshotStore";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/filters/snapshot/[id]">,
) {
  const { id } = await ctx.params;

  if (!id) {
    return buildErrorMessage({
      message: "Missing snapshot id",
      httpStatus: 400,
    });
  }

  let snapshot;

  try {
    snapshot = await loadSnapshot(id);
  } catch (error) {
    console.error(`Failed to load filter snapshot "${id}":`, error);

    return buildErrorMessage({
      message: "Failed to load filter snapshot",
      httpStatus: 500,
    });
  }

  if (!snapshot) {
    return buildErrorMessage({
      message: "Filter snapshot not found",
      httpStatus: 404,
    });
  }

  return Response.json(snapshot);
}
