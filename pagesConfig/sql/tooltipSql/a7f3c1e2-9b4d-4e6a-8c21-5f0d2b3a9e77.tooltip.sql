-- Tooltip for Strip Plot Test.
-- Batched: every selected point property arrives as a JSON array parameter.
--   :bucket -> ARRAY<STRING>
--   :y      -> ARRAY<DOUBLE>
-- Returns one row per selected point (bucket + rounded value).
SELECT
  labels.bucket_val AS `Monat`,
  ROUND(parsed.ys[labels.idx], 0) AS `Wert`
FROM (
  SELECT
    from_json(CAST(:bucket AS STRING), 'array<string>') AS buckets,
    from_json(CAST(:y AS STRING), 'array<double>') AS ys
) parsed
LATERAL VIEW posexplode(parsed.buckets) labels AS idx, bucket_val
ORDER BY labels.idx
