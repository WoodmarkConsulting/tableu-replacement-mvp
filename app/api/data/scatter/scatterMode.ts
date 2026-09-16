export function getScatterMode(
  totalCount: number,
  pointLimit: number,
): "points" | "raster" {
  return totalCount <= pointLimit ? "points" : "raster";
}
