import type { SnapshotRequestBody } from "../filters/snapshot/route";
import type { FilterSnapshot } from "@/types/filters";

// --------------- Chart data API types ---------------
export type QueryParameters = Record<string, unknown>;
export type ChartDataPath = `/api/data/chart/${string}`;
export type ChartDataPathResponse = unknown[];

// --------------- Tooltip API types ---------------
export type TooltipPath = "/api/data/chart/tooltip";
export type TooltipPathRequestBody = {
  dataPoint?: Record<string, unknown | null> | null;
  chartID: string;
};
export type TooltipPathResponse = Record<string, unknown>;

// --------------- Snapshot API types ---------------
export type SnapshotPath = `/api/filters/snapshot`;
export type SnapshotRequestBody = {
  dashboard?: string;
  state?: FilterSnapshot;
};
export type SnapshotPathResponse = Record<"id", string>;

export type SnapshotIdPath = `/api/filters/snapshot/${string}`;
export type SnapshotIdPathResponse = FilterSnapshot;

// --------------- API endpoint types ---------------
type Endpoints = ChartDataPath | TooltipPath | SnapshotPath | SnapshotIdPath;

export type APIEndpoint<Path extends Endpoints> = Path extends TooltipPath
  ? {
      POST: {
        body: TooltipPathRequestBody;
        response: TooltipPathResponse;
      };
    }
  : Path extends SnapshotPath
    ? {
        POST: {
          body: SnapshotRequestBody;
          response: SnapshotPathResponse;
        };
      }
    : Path extends SnapshotIdPath
      ? {
          GET: {
            response: SnapshotIdPathResponse;
          };
        }
      : Path extends ChartDataPath
        ? {
            POST: {
              body: {
                filters?: QueryParameters;
              };
              response: ChartDataPathResponse;
            };
          }
        : never;

export type APIMethod<Path extends Endpoints> = keyof APIEndpoint<Path>;
