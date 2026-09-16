import type { ChartQueryValue } from "@/app/api/utils/types";

export type ScatterBounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

type ScatterResponseBase = {
  bounds: ScatterBounds;
  totalCount: number;
};

export type ScatterPointsResponse = ScatterResponseBase & {
  mode: "points";
  pointCount: number;
  positions: Float32Array;
  ids: Float64Array;
  colorIndexes: Uint8Array;
};

export type ScatterRasterResponse = ScatterResponseBase & {
  mode: "raster";
  png: ArrayBuffer;
};

export type ScatterResponse = ScatterPointsResponse | ScatterRasterResponse;

type ScatterRequest = {
  filters: Record<string, ChartQueryValue>;
  viewport: ScatterBounds | null;
  pointLimit: number;
  imageSize: { width: number; height: number };
  colorValues: number[];
  hiddenColorValues: number[];
  colors: string[];
};

const HEADER_SIZE = 28;

function readBounds(view: DataView): ScatterBounds {
  return {
    xMin: view.getFloat32(8, true),
    xMax: view.getFloat32(12, true),
    yMin: view.getFloat32(16, true),
    yMax: view.getFloat32(20, true),
  };
}

function parseScatterResponse(buffer: ArrayBuffer): ScatterResponse {
  if (buffer.byteLength < HEADER_SIZE + 4) {
    throw new Error("Scatter response is too short");
  }

  const view = new DataView(buffer);
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  );

  if (magic !== "SCP1") {
    throw new Error("Scatter response has an invalid format");
  }

  const mode = view.getUint8(4);
  const bounds = readBounds(view);
  const totalCount = view.getUint32(24, true);

  if (mode === 0) {
    const pointCount = view.getUint32(HEADER_SIZE, true);
    const xOffset = HEADER_SIZE + 4;
    const yOffset = xOffset + pointCount * Float32Array.BYTES_PER_ELEMENT;
    const idOffset = yOffset + pointCount * Float32Array.BYTES_PER_ELEMENT;
    const colorOffset = idOffset + pointCount * Float64Array.BYTES_PER_ELEMENT;
    const expectedSize = colorOffset + pointCount;

    if (buffer.byteLength !== expectedSize) {
      throw new Error("Scatter point response has an invalid length");
    }

    const xValues = new Float32Array(buffer, xOffset, pointCount);
    const yValues = new Float32Array(buffer, yOffset, pointCount);
    const positions = new Float32Array(pointCount * 2);

    for (let index = 0; index < pointCount; index += 1) {
      positions[index * 2] = xValues[index];
      positions[index * 2 + 1] = yValues[index];
    }

    return {
      mode: "points",
      bounds,
      totalCount,
      pointCount,
      positions,
      ids: new Float64Array(buffer, idOffset, pointCount),
      colorIndexes: new Uint8Array(buffer, colorOffset, pointCount),
    };
  }

  if (mode === 1) {
    const pngLength = view.getUint32(HEADER_SIZE, true);
    const pngOffset = HEADER_SIZE + 4;

    if (buffer.byteLength !== pngOffset + pngLength) {
      throw new Error("Scatter raster response has an invalid length");
    }

    return {
      mode: "raster",
      bounds,
      totalCount,
      png: buffer.slice(pngOffset),
    };
  }

  throw new Error(`Unsupported scatter response mode: ${mode}`);
}

export async function fetchScatterData(
  chartID: string,
  request: ScatterRequest,
  signal: AbortSignal,
): Promise<ScatterResponse> {
  const response = await fetch(
    `/api/data/scatter/${encodeURIComponent(chartID)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    },
  );

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(
      errorBody?.error ?? `Scatter request failed (${response.status})`,
    );
  }

  return parseScatterResponse(await response.arrayBuffer());
}
