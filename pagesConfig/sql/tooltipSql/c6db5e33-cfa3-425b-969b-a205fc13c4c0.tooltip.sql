-- Returns selected ISO alpha-2 country codes for central-dashboard connections.
WITH selected AS (
  SELECT explode(from_json(CAST(:regionCode AS STRING), 'ARRAY<STRING>')) AS value
)
SELECT DISTINCT upper(trim(value)) AS selection_country
FROM selected
WHERE value IS NOT NULL AND length(trim(value)) = 2;
