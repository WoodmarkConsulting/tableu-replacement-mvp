import { readFile } from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";
import sharp from "sharp";
import { z } from "zod";

import { buildErrorMessage } from "@/app/api/router/errorhandler";
import { runQuery } from "@/app/api/warehouse/connection";
import { buildChartInputParameters } from "@/app/api/data/chart/chartInput";
import { getScatterMode } from "@/app/api/data/scatter/scatterMode";
import {
  buildScatterPointsSql,
  buildScatterRasterSql,
  buildScatterSummarySql,
} from "@/app/api/data/scatter/scatterQueries";
import {
  getAutomaticColorIndex,
  SCATTER_POINT_PALETTE,
} from "@/modules/ScatterPlotModule/colors";

const SQL_DIRECTORY = path.join(process.cwd(), "pagesConfig", "sql");
const MAX_IMAGE_DIMENSION = 4096;
const MAX_POINT_LIMIT = 5_000_000;
const HEADER_SIZE = 28;
const filterScalarSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const requestSchema = z.object({
  filters: z.record(
    z.string(),
    z.union([filterScalarSchema, z.array(filterScalarSchema)]),
  ),
  viewport: z
    .object({
      xMin: z.number().finite(),
      xMax: z.number().finite(),
      yMin: z.number().finite(),
      yMax: z.number().finite(),
    })
    .nullable(),
  pointLimit: z.number().int().min(1).max(MAX_POINT_LIMIT),
  imageSize: z.object({
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
  }),
  colorValues: z.array(z.number().int()).max(255).default([]),
  hiddenColorValues: z.array(z.number().finite()).max(255).default([]),
  colors: z
    .array(z.string().regex(/^#[\da-f]{6}$/i))
    .max(256)
    .default([]),
});

type Bounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

type SummaryRow = {
  total_count: unknown;
  visible_count: unknown;
  x_min: unknown;
  x_max: unknown;
  y_min: unknown;
  y_max: unknown;
};

type PointRow = {
  x: unknown;
  y: unknown;
  id: unknown;
  color: unknown;
};

type RasterRow = {
  pixel_x: unknown;
  pixel_y: unknown;
  color: unknown;
  point_count: unknown;
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeBounds(bounds: Bounds): Bounds {
  const xPadding = bounds.xMin === bounds.xMax ? 0.5 : 0;
  const yPadding = bounds.yMin === bounds.yMax ? 0.5 : 0;

  return {
    xMin: bounds.xMin - xPadding,
    xMax: bounds.xMax + xPadding,
    yMin: bounds.yMin - yPadding,
    yMax: bounds.yMax + yPadding,
  };
}

function writeHeader(
  view: DataView,
  mode: 0 | 1,
  bounds: Bounds,
  totalCount: number,
): void {
  view.setUint8(0, "S".charCodeAt(0));
  view.setUint8(1, "C".charCodeAt(0));
  view.setUint8(2, "P".charCodeAt(0));
  view.setUint8(3, "1".charCodeAt(0));
  view.setUint8(4, mode);
  view.setFloat32(8, bounds.xMin, true);
  view.setFloat32(12, bounds.xMax, true);
  view.setFloat32(16, bounds.yMin, true);
  view.setFloat32(20, bounds.yMax, true);
  view.setUint32(24, Math.min(totalCount, 0xffffffff), true);
}

function encodePoints(
  rows: PointRow[],
  bounds: Bounds,
  totalCount: number,
  colorValues: number[],
  colors: string[],
): ArrayBuffer {
  const pointCount = rows.length;
  const xOffset = HEADER_SIZE + 4;
  const yOffset = xOffset + pointCount * Float32Array.BYTES_PER_ELEMENT;
  const idOffset = yOffset + pointCount * Float32Array.BYTES_PER_ELEMENT;
  const colorOffset = idOffset + pointCount * Float64Array.BYTES_PER_ELEMENT;
  const buffer = new ArrayBuffer(colorOffset + pointCount);
  const view = new DataView(buffer);
  const xValues = new Float32Array(buffer, xOffset, pointCount);
  const yValues = new Float32Array(buffer, yOffset, pointCount);
  const idValues = new Float64Array(buffer, idOffset, pointCount);
  const colorIndexes = new Uint8Array(buffer, colorOffset, pointCount);
  const colorIndexByValue = new Map(
    colorValues.map((value, index) => [value, index]),
  );
  const automaticColorCount = Math.max(colors.length - colorValues.length, 0);

  writeHeader(view, 0, bounds, totalCount);
  view.setUint32(HEADER_SIZE, pointCount, true);

  for (let index = 0; index < pointCount; index += 1) {
    const row = rows[index];

    xValues[index] = toFiniteNumber(row.x);
    yValues[index] = toFiniteNumber(row.y);
    idValues[index] = toFiniteNumber(row.id);
    colorIndexes[index] =
      colorIndexByValue.get(toFiniteNumber(row.color)) ??
      (automaticColorCount > 0
        ? colorValues.length +
          getAutomaticColorIndex(row.color, automaticColorCount)
        : 255);
  }

  return buffer;
}

function parseHexColor(value: string): [number, number, number] {
  const normalized = value.replace(/^#/, "");

  if (!/^[\da-f]{6}$/i.test(normalized)) {
    return [37, 99, 235];
  }

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

async function encodeRaster(
  rows: RasterRow[],
  bounds: Bounds,
  totalCount: number,
  width: number,
  height: number,
  colorValues: number[],
  colors: string[],
): Promise<ArrayBuffer> {
  const pixels = new Uint8Array(width * height * 4);
  const resolvedColors = colors.length ? colors : [...SCATTER_POINT_PALETTE];
  const colorIndexByValue = new Map(
    colorValues.map((value, index) => [value, index]),
  );
  const automaticColorCount = Math.max(
    resolvedColors.length - colorValues.length,
    0,
  );

  for (const row of rows) {
    const x = Math.min(
      Math.max(Math.round(toFiniteNumber(row.pixel_x)), 0),
      width - 1,
    );
    const sourceY = Math.min(
      Math.max(Math.round(toFiniteNumber(row.pixel_y)), 0),
      height - 1,
    );
    const y = height - 1 - sourceY;
    const pixelOffset = (y * width + x) * 4;
    const colorIndex =
      colorIndexByValue.get(toFiniteNumber(row.color)) ??
      (automaticColorCount > 0
        ? colorValues.length +
          getAutomaticColorIndex(row.color, automaticColorCount)
        : 0);
    const [red, green, blue] = parseHexColor(
      resolvedColors[colorIndex] ?? SCATTER_POINT_PALETTE[0],
    );
    const alpha = Math.min(
      255,
      48 + Math.round(Math.log2(toFiniteNumber(row.point_count, 1) + 1) * 32),
    );
    const existingAlpha = pixels[pixelOffset + 3] / 255;
    const incomingAlpha = alpha / 255;
    const combinedAlpha = incomingAlpha + existingAlpha * (1 - incomingAlpha);

    pixels[pixelOffset] = Math.round(
      (red * incomingAlpha +
        pixels[pixelOffset] * existingAlpha * (1 - incomingAlpha)) /
        combinedAlpha,
    );
    pixels[pixelOffset + 1] = Math.round(
      (green * incomingAlpha +
        pixels[pixelOffset + 1] * existingAlpha * (1 - incomingAlpha)) /
        combinedAlpha,
    );
    pixels[pixelOffset + 2] = Math.round(
      (blue * incomingAlpha +
        pixels[pixelOffset + 2] * existingAlpha * (1 - incomingAlpha)) /
        combinedAlpha,
    );
    pixels[pixelOffset + 3] = Math.round(combinedAlpha * 255);
  }

  const png = await sharp(pixels, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
  const buffer = new ArrayBuffer(HEADER_SIZE + 4 + png.byteLength);
  const view = new DataView(buffer);

  writeHeader(view, 1, bounds, totalCount);
  view.setUint32(HEADER_SIZE, png.byteLength, true);
  new Uint8Array(buffer, HEADER_SIZE + 4).set(png);

  return buffer;
}

function binaryResponse(buffer: ArrayBuffer): Response {
  return new Response(buffer, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/octet-stream",
    },
  });
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/data/scatter/[chartID]">,
) {
  const parsedBody = requestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedBody.success) {
    return buildErrorMessage({
      message: "Invalid scatter request body",
      httpStatus: 400,
    });
  }

  const { chartID } = await context.params;
  const sqlFilePath = path.resolve(SQL_DIRECTORY, `${chartID}.sql`);

  if (!sqlFilePath.startsWith(`${path.resolve(SQL_DIRECTORY)}${path.sep}`)) {
    return buildErrorMessage({
      message: "Invalid chartID parameter",
      httpStatus: 400,
    });
  }

  let baseSql: string;

  try {
    baseSql = (await readFile(sqlFilePath, "utf8")).trim().replace(/;$/, "");
  } catch (error) {
    console.error(
      `Failed to read scatter SQL for chartID "${chartID}":`,
      error,
    );
    return buildErrorMessage({
      message: `SQL file not found for chartID: ${chartID}`,
      httpStatus: 404,
    });
  }

  const {
    filters,
    viewport,
    pointLimit,
    imageSize,
    colorValues,
    hiddenColorValues,
    colors,
  } = parsedBody.data;
  const width = Math.min(
    Math.max(Math.round(imageSize.width), 1),
    MAX_IMAGE_DIMENSION,
  );
  const height = Math.min(
    Math.max(Math.round(imageSize.height), 1),
    MAX_IMAGE_DIMENSION,
  );
  const viewportClause = viewport
    ? "WHERE x BETWEEN :scatterVpXMin AND :scatterVpXMax AND y BETWEEN :scatterVpYMin AND :scatterVpYMax"
    : "";
  const colorVisibilityPredicate = hiddenColorValues.length
    ? "color IS NULL OR NOT array_contains(from_json(CAST(:scatterHiddenColorValues AS STRING), 'array<double>'), CAST(color AS DOUBLE))"
    : "TRUE";
  const inputParameters = buildChartInputParameters(filters);
  const parameters = {
    ...inputParameters,
    scatterHiddenColorValues: JSON.stringify(hiddenColorValues),
    ...(viewport
      ? {
          scatterVpXMin: viewport.xMin,
          scatterVpXMax: viewport.xMax,
          scatterVpYMin: viewport.yMin,
          scatterVpYMax: viewport.yMax,
        }
      : {}),
  };
  const summarySql = buildScatterSummarySql(
    baseSql,
    viewportClause,
    colorVisibilityPredicate,
  );

  try {
    const [summary] = await runQuery<SummaryRow[]>(summarySql, parameters);
    const totalCount = Math.max(
      0,
      Math.round(toFiniteNumber(summary?.total_count)),
    );
    const visibleCount = Math.max(
      0,
      Math.round(toFiniteNumber(summary?.visible_count)),
    );
    const fallbackBounds = viewport ?? { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    const bounds = normalizeBounds({
      xMin: toFiniteNumber(summary?.x_min, fallbackBounds.xMin),
      xMax: toFiniteNumber(summary?.x_max, fallbackBounds.xMax),
      yMin: toFiniteNumber(summary?.y_min, fallbackBounds.yMin),
      yMax: toFiniteNumber(summary?.y_max, fallbackBounds.yMax),
    });
    const mode = getScatterMode(totalCount, pointLimit);

    if (mode === "points" && totalCount === 0) {
      return binaryResponse(encodePoints([], bounds, 0, colorValues, colors));
    }

    if (mode === "points") {
      const pointsSql = buildScatterPointsSql(
        baseSql,
        viewportClause,
        pointLimit,
      );
      const rows = await runQuery<PointRow[]>(pointsSql, parameters);

      return binaryResponse(
        encodePoints(rows, bounds, totalCount, colorValues, colors),
      );
    }

    const rasterBounds = viewport ?? bounds;
    const rasterParameters = {
      ...parameters,
      scatterBoundsXMin: rasterBounds.xMin,
      scatterBoundsXMax: rasterBounds.xMax,
      scatterBoundsYMin: rasterBounds.yMin,
      scatterBoundsYMax: rasterBounds.yMax,
      scatterBoundsXRange: rasterBounds.xMax - rasterBounds.xMin,
      scatterBoundsYRange: rasterBounds.yMax - rasterBounds.yMin,
      scatterRasterWidth: width,
      scatterRasterHeight: height,
    };
    const rasterSql = buildScatterRasterSql(baseSql, colorVisibilityPredicate);
    const rows = await runQuery<RasterRow[]>(rasterSql, rasterParameters);
    const buffer = await encodeRaster(
      rows,
      rasterBounds,
      visibleCount,
      width,
      height,
      colorValues,
      colors,
    );

    return binaryResponse(buffer);
  } catch (error) {
    console.error(`Failed to execute scatter query for "${chartID}":`, error);
    return buildErrorMessage({
      message: `Failed to execute scatter query for chartID: ${chartID}`,
      httpStatus: 500,
    });
  }
}
