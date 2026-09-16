export function buildScatterSummarySql(
  baseSql: string,
  viewportClause: string,
  colorVisibilityPredicate: string,
): string {
  return `
    WITH scatter_source AS (${baseSql}),
    viewport_points AS (
      SELECT x, y, id, color
      FROM scatter_source
      ${viewportClause}
    )
    SELECT
      COUNT(*) AS total_count,
      COALESCE(SUM(CASE WHEN ${colorVisibilityPredicate} THEN 1 ELSE 0 END), 0) AS visible_count,
      MIN(x) AS x_min,
      MAX(x) AS x_max,
      MIN(y) AS y_min,
      MAX(y) AS y_max
    FROM viewport_points
  `;
}

export function buildScatterPointsSql(
  baseSql: string,
  viewportClause: string,
  pointLimit: number,
): string {
  return `
    WITH scatter_source AS (${baseSql})
    SELECT x, y, id, color
    FROM scatter_source
    ${viewportClause}
    LIMIT ${pointLimit}
  `;
}

export function buildScatterRasterSql(
  baseSql: string,
  colorVisibilityPredicate: string,
): string {
  return `
    WITH scatter_source AS (${baseSql}),
    visible_points AS (
      SELECT x, y, color
      FROM scatter_source
      WHERE x BETWEEN :scatterBoundsXMin AND :scatterBoundsXMax
        AND y BETWEEN :scatterBoundsYMin AND :scatterBoundsYMax
        AND (${colorVisibilityPredicate})
    )
    SELECT
      CAST(FLOOR((x - :scatterBoundsXMin) / :scatterBoundsXRange * (:scatterRasterWidth - 1)) AS INT) AS pixel_x,
      CAST(FLOOR((y - :scatterBoundsYMin) / :scatterBoundsYRange * (:scatterRasterHeight - 1)) AS INT) AS pixel_y,
      color,
      COUNT(*) AS point_count
    FROM visible_points
    GROUP BY pixel_x, pixel_y, color
  `;
}
