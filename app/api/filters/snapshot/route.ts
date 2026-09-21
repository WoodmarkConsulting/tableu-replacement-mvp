import type { NextRequest } from "next/server";

import { buildErrorMessage } from "../../router/errorhandler";
import { saveSnapshot } from "../snapshotStore";
import { APIEndpoint, SnapshotPath } from "../../utils/types";
import { isFilterContributionShape } from "@/lib/filters/contributions";

type SnapshotRequestBody = APIEndpoint<SnapshotPath>["POST"]["body"];
type Response = APIEndpoint<SnapshotPath>["POST"]["response"];

const MAX_DASHBOARD_LENGTH = 200;
const MAX_TAB_LENGTH = 200;
const MAX_CONTRIBUTIONS = 500;
const MAX_VALUE_LENGTH = 500;
const MAX_VALUE_ENTRIES = 5000;

// Snapshot values expand into every bound chart query, so bound their size here
// rather than letting a crafted permalink drive warehouse load.
const isValueWithinLimits = (value: FilterValue): boolean => {
  if (typeof value === "string") {
    return value.length <= MAX_VALUE_LENGTH;
  }

  if (Array.isArray(value)) {
    return (
      value.length <= MAX_VALUE_ENTRIES &&
      value.every((entry) => entry.length <= MAX_VALUE_LENGTH)
    );
  }

  if (value && typeof value === "object") {
    return [value.from, value.to].every(
      (entry) => entry === null || entry.length <= MAX_VALUE_LENGTH,
    );
  }

  return true;
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
    dashboard.length > MAX_DASHBOARD_LENGTH ||
    !state ||
    typeof state !== "object" ||
    state.version !== 2 ||
    !state.contributions ||
    typeof state.contributions !== "object" ||
    Array.isArray(state.contributions) ||
    typeof state.activeTab !== "string" ||
    state.activeTab.length > MAX_TAB_LENGTH
  ) {
    return buildErrorMessage({
      message: "Missing or invalid snapshot payload",
      httpStatus: 400,
    });
  }

  const entries = Object.entries(state.contributions);
  const contributions: Record<string, FilterContribution> = {};

  if (entries.length > MAX_CONTRIBUTIONS) {
    return buildErrorMessage({
      message: "Missing or invalid snapshot payload",
      httpStatus: 400,
    });
  }

  for (const [key, contribution] of entries) {
    if (
      !isFilterContributionShape(contribution) ||
      key !== contribution.key ||
      !isValueWithinLimits(contribution.value)
    ) {
      return buildErrorMessage({
        message: "Missing or invalid snapshot payload",
        httpStatus: 400,
      });
    }

    contributions[key] = contribution;
  }

  try {
    const id = await saveSnapshot(dashboard, {
      version: 2,
      contributions,
      activeTab: state.activeTab,
    });

    return Response.json({ id } satisfies Response);
  } catch (error) {
    console.error("Failed to save filter snapshot:", error);

    return buildErrorMessage({
      message: "Failed to save filter snapshot",
      httpStatus: 500,
    });
  }
}
