-- Dashboard: Strip Plot Test (synthetic)
-- Chart: Value distribution per month
-- Data: Synthetic per-record values across 37 monthly buckets (2023-07 .. 2026-07).
-- Shape: StripPlotModule rows { bucket: string, y: number } (one row per record)
--
-- The data is generated in SQL so the demo renders without a source table and
-- exercises the canvas renderer with a high point count (37 buckets * 13514 ≈ 500k).
WITH generated AS (
  SELECT
    date_format(add_months(DATE'2023-07-01', months.m), 'yyyy-MM') AS bucket,
    months.m AS month_index,
    CAST(
      (8000 + months.m * 5000) * pow(rand(), 2.2) + rand() * 3000 AS DOUBLE
    ) AS y
  FROM (SELECT explode(sequence(0, 36)) AS m) months
  LATERAL VIEW explode(sequence(1, 13514)) points AS n
)
WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<min_value: DOUBLE, max_value: DOUBLE>'
  ) AS params
),
generated AS (
  SELECT
    date_format(add_months(DATE'2023-07-01', months.m), 'yyyy-MM') AS bucket,
    months.m AS month_index,
    CAST(
      (8000 + months.m * 5000) * pow(rand(), 2.2) + rand() * 3000 AS DOUBLE
    ) AS y
  FROM (SELECT explode(sequence(0, 36)) AS m) months
  LATERAL VIEW explode(sequence(1, 13514)) points AS n
)
SELECT
  bucket,
  y
FROM generated
CROSS JOIN chart_input
WHERE (chart_input.params.min_value IS NULL OR y >= chart_input.params.min_value)
  AND (chart_input.params.max_value IS NULL OR y <= chart_input.params.max_value)
ORDER BY month_index
