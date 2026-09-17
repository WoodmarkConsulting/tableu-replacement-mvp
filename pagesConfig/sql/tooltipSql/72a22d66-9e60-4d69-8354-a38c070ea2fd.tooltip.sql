-- Tooltip for Battery table (Production numbers -> Production Numbers 2).
-- Batched: selected TableModule rows arrive with :values as a JSON array of strings/objects.
-- Emits Batterie as an atomic alias for outgoing chart connections and details.
WITH input_rows AS (
  SELECT explode(from_json(CAST(:values AS STRING), 'array<struct<Batterie: string>>')) AS row_val
)
SELECT DISTINCT
  row_val.Batterie AS Batterie
FROM input_rows
WHERE row_val.Batterie IS NOT NULL;
