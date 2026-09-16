-- Linked target for the map test page.
-- Self-contained region data (no external table) so the demo works standalone.
-- `:regionCode` arrives as a JSON array string of ISO alpha-2 codes selected on
-- the source map, or NULL when nothing is linked (show all regions).
WITH region_data AS (
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
WHERE (
  :regionCode IS NULL
  OR array_contains(
    from_json(CAST(:regionCode AS STRING), 'array<string>'),
    regionCode
  )
)
ORDER BY regionCode;
