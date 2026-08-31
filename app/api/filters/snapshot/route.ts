import type { NextRequest } from "next/server";

import { buildErrorMessage } from "../../router/errorhandler";
import { saveSnapshot } from "../snapshotStore";
import type { FilterSnapshot } from "@/types/filters";

type SnapshotRequestBody = {
  dashboard?: string;
  state?: FilterSnapshot;
};

export async function POST(req: NextRequest) {
  let body: SnapshotRequestBody;

  try {
    body = (await req.json()) as SnapshotRequestBody;
  } catch {
    return buildErrorMessage({
      message: "Invalid JSON body",
      httpStatus: 400,
    });
  }

  const { dashboard, state } = body;

  if (
    typeof dashboard !== "string" ||
    dashboard.trim() === "" ||
    !state ||
    typeof state !== "object" ||
    typeof state.values !== "object"
  ) {
    return buildErrorMessage({
      message: "Missing or invalid snapshot payload",
      httpStatus: 400,
    });
  }

  try {
    const id = await saveSnapshot(dashboard, {
      values: state.values,
      activeTab: typeof state.activeTab === "string" ? state.activeTab : "",
    });

    return Response.json({ id });
  } catch (error) {
    console.error("Failed to save filter snapshot:", error);

    return buildErrorMessage({
      message: "Failed to save filter snapshot",
      httpStatus: 500,
    });
  }
}
