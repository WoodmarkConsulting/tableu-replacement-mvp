-- Returns selected ECU values for central-dashboard chart connections.
-- The tooltip route sends all selected categories as one JSON array; expand it into rows.
WITH selected AS (
  SELECT explode(from_json(CAST(:category AS STRING), 'ARRAY<STRING>')) AS value
)
SELECT DISTINCT value AS selection_ecu_nm
FROM selected
WHERE value IS NOT NULL;
