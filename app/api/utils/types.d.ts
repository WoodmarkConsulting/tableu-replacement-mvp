import type { SnapshotRequestBody } from "../filters/snapshot/route";
import type { FilterSnapshot } from "@/types/filters";

// --------------- Chart data API types ---------------
type ChartDataQueryParams = string | number | boolean | bigint | Date | null;
export type QueryParameters = Record<string, ChartDataQueryParams>;
export type ChartDataPath = `/api/data/chart/${string}`;

// --------------- Tooltip API types ---------------
export type TooltipPath = "/api/data/chart/tooltip";

// --------------- Snapshot API types ---------------
export type SnapshotRequestBody = {
  dashboard?: string;
  state?: FilterSnapshot;
};
export type SnapshotPath = `/api/filters/snapshot`;
export type SnapshotIdPath = `/api/filters/snapshot/${string}`;

// --------------- API endpoint types ---------------
type Endpoints = ChartDataPath | TooltipPath | SnapshotPath | SnapshotIdPath;

export type APIEndpoint<Path extends Endpoints> = Path extends TooltipPath
  ? {
      POST: {
        body: {
          dataPoint?: QueryParameters;
        };
        response: Record<string, unknown>;
      };
    }
  : Path extends SnapshotPath
    ? {
        POST: {
          body: SnapshotRequestBody;
          response: Record<"id", string>;
        };
      }
    : Path extends SnapshotIdPath
      ? {
          GET: {
            response: FilterSnapshot;
          };
        }
      : Path extends ChartDataPath
        ? {
            POST: {
              body: {
                filters?: QueryParameters;
              };
              response: unknown[];
            };
          }
        : never;

export type APIMethod<Path extends Endpoints> = keyof APIEndpoint<Path>;
