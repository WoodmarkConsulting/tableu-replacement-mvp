import type { SnapshotRequestBody } from "../filters/snapshot/route";

// --------------- Chart data API types ---------------
export type ChartQueryScalar = string | number | boolean | null;
export type ChartQueryValue = ChartQueryScalar | ChartQueryScalar[];
export type QueryParameters = Record<string, ChartQueryValue>;
export type ChartDataPath = `/api/data/chart/${string}`;
export type ChartDataPathResponse = unknown[];

// --------------- Tooltip API types ---------------
export type TooltipValue =
  | string
  | number
  | boolean
  | null
  | TooltipValue[]
  | { [key: string]: TooltipValue };
export type TooltipDataPoint = Record<string, TooltipValue>;
export type TooltipPath = "/api/data/chart/tooltip";
export type TooltipPathRequestBody = {
  dataPoints: TooltipDataPoint[];
  chartID: string;
};
export type TooltipPathResponse = {
  dataPoint: Record<string, unknown>[];
  failedBatches?: number;
};
export type TooltipStreamEvent =
  | {
      type: "batch";
      batchIndex: number;
      dataPoint: Record<string, unknown>[];
    }
  | {
      type: "error";
      batchIndex: number;
      message: string;
    }
  | {
      type: "done";
      completedBatches: number;
      failedBatches: number;
      totalBatches: number;
    };

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
