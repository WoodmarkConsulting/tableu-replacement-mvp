-- Returns selected transmission-code values for central-dashboard chart connections.
WITH selected AS (
  SELECT explode(from_json(CAST(:category AS STRING), 'ARRAY<STRING>')) AS value
)
SELECT DISTINCT value AS selection_trans_md_cd_4
FROM selected
WHERE value IS NOT NULL;
