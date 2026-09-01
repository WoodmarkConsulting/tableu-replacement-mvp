type ChartDataQueryParams = string | number | boolean | bigint | Date | null;

type Endpoints = ChartDataPath | TooltipPath;

export type ChartDataPath = `/api/data/${string}`;
export type TooltipPath = `/api/tooltip`;

export type QueryParameters = Record<string, ChartDataQueryParams>;

export type APIEndpoint<Path extends Endpoints> = Path extends ChartDataPath
  ? {
      POST: {
        body: {
          filters?: QueryParameters;
        };
        response: unknown[];
      };
    }
  : Path extends TooltipPath
    ? {
        GET: {
          response: string;
        };
      }
    : never;

export type APIMethod<Path extends Endpoints> = keyof APIEndpoint<Path>;
