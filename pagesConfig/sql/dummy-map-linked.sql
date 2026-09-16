-- Linked target for the map test page.
-- Self-contained region data (no external table) so the demo works standalone.
-- The incoming `regionCode` connection value arrives via the framework `:input`
-- marker as a JSON array of ISO alpha-2 codes, or NULL when nothing is linked
-- (show all regions).
WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<regionCode: ARRAY<STRING>>'
  ) AS params
),
region_data AS (
  SELECT * FROM VALUES
    ('US', 82, 'United States'),
    ('DE', 64, 'Germany'),
    ('FR', 58, 'France'),
    ('JP', 76, 'Japan'),
    ('BR', 45, 'Brazil'),
    ('CA', 30, 'Canada'),
    ('AU', 52, 'Australia'),
    ('IN', 68, 'India'),
    ('CN', 71, 'China'),
    ('GB', 60, 'United Kingdom')
  AS t(regionCode, value, label)
)
SELECT
  'region' AS kind,
  regionCode,
  CAST(value AS DOUBLE) AS value,
  label
FROM region_data
CROSS JOIN chart_input
WHERE (
  chart_input.params.regionCode IS NULL
  OR array_contains(chart_input.params.regionCode, regionCode)
)
ORDER BY regionCode;
