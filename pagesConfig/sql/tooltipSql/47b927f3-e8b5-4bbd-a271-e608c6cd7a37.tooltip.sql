-- Returns selected engine-series values for central-dashboard chart connections.
WITH selected AS (
  SELECT explode(from_json(CAST(:category AS STRING), 'ARRAY<STRING>')) AS value
)
SELECT DISTINCT value AS selection_engine_series
FROM selected
WHERE value IS NOT NULL;
