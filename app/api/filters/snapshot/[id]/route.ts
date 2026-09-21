import type { NextRequest } from "next/server";

import { buildErrorMessage } from "../../../router/errorhandler";
import { loadSnapshot } from "../../snapshotStore";
import { APIEndpoint, SnapshotIdPath } from "@/app/api/utils/types";

type Response = APIEndpoint<SnapshotIdPath>["GET"]["response"];

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/filters/snapshot/[id]">,
) {
  const { id } = await ctx.params;

  if (!id) {
    return buildErrorMessage({
      message: "Missing snapshot id",
      httpStatus: 400,
    });
  }

  let storedSnapshot;

  try {
    storedSnapshot = await loadSnapshot(id);
  } catch (error) {
    console.error(`Failed to load filter snapshot "${id}":`, error);

    return buildErrorMessage({
      message: "Failed to load filter snapshot",
      httpStatus: 500,
    });
  }

  if (!storedSnapshot) {
    return buildErrorMessage({
      message: "Filter snapshot not found",
      httpStatus: 404,
    });
  }

  const dashboard = req.nextUrl.searchParams.get("dashboard");
  if (!dashboard || dashboard !== storedSnapshot.dashboard) {
    return buildErrorMessage({
      message: "Filter snapshot belongs to another dashboard",
      httpStatus: 403,
    });
  }

  return Response.json(storedSnapshot.snapshot satisfies Response);
}
