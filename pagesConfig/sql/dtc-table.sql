WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<CarName: ARRAY<STRING>>'
  ) AS params
),

daily_dtc_counts AS (
  SELECT
    DATE(LastUpdate) AS update_day,
    SUM(CASE WHEN IsActive = -1 THEN 1 ELSE 0 END) AS active_count,
    SUM(CASE WHEN IsStored = -1 THEN 1 ELSE 0 END) AS stored_count
  FROM westeurope_extollo_platform_rd_eu_rdppe_non_customer_int_adbv.`2021024_sofa_gold_dev`.lsb_partitioned_dtcdata_2021024_sofa_gold
  CROSS JOIN chart_input
  WHERE LastUpdate IS NOT NULL
    AND (
      chart_input.params.CarName IS NULL
      OR array_contains(
        chart_input.params.CarName,
        trim(CAST(CarName AS STRING))
      )
    )
  GROUP BY DATE(LastUpdate)
)

SELECT
  CAST(unix_millis(CAST(update_day AS TIMESTAMP)) AS DOUBLE) AS x,
  array(
    CAST(active_count AS DOUBLE),
    CAST(stored_count AS DOUBLE)
  ) AS y
FROM daily_dtc_counts
ORDER BY update_day ASC;
