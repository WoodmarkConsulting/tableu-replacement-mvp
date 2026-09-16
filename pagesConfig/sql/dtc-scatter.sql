WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<LastUpdate: ARRAY<DOUBLE>, IsActive: ARRAY<INT>>'
  ) AS params
)

SELECT
  CAST(source.OdometerRead AS DOUBLE) AS x,
  CAST(source.FrequencyCount AS DOUBLE) AS y,
  CAST(source.DTCDataId AS DOUBLE) AS id,
  CAST(source.IsActive AS INT) AS color
FROM westeurope_extollo_platform_rd_eu_rdppe_non_customer_int_adbv.`2021024_sofa_gold_dev`.lsb_partitioned_dtcdata_2021024_sofa_gold AS source
CROSS JOIN chart_input
WHERE source.OdometerRead IS NOT NULL
  AND source.FrequencyCount IS NOT NULL
  AND source.DTCDataId IS NOT NULL
  AND (
    chart_input.params.LastUpdate IS NULL
    OR array_contains(
      chart_input.params.LastUpdate,
      CAST(unix_millis(CAST(DATE(source.LastUpdate) AS TIMESTAMP)) AS DOUBLE)
    )
  )
  AND (
    chart_input.params.IsActive IS NULL
    OR array_contains(
      chart_input.params.IsActive,
      CAST(source.IsActive AS INT)
    )
  )
