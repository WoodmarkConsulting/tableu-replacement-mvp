-- Enhanced tooltip + connection source for the map test page.
-- The tooltip endpoint sends every selected data-point property as a JSON array,
-- so region selections arrive as `:regionCode`, `:value`, `:label` (and `:kind`).
-- One row per selected region row. `regionCode` is also the outgoing connection
-- column consumed by the linked target chart.
SELECT
  region.regionCode AS regionCode,
  region.label AS label,
  region.value AS value
FROM (
  SELECT
    codes[idx] AS regionCode,
    labels[idx] AS label,
    vals[idx] AS value
  FROM (
    SELECT
      from_json(CAST(:regionCode AS STRING), 'array<string>') AS codes,
      from_json(CAST(:label AS STRING), 'array<string>') AS labels,
      from_json(CAST(:value AS STRING), 'array<double>') AS vals
  ) arrays
  LATERAL VIEW posexplode(arrays.codes) exploded AS idx, code
) region
WHERE region.regionCode IS NOT NULL
ORDER BY region.regionCode;
