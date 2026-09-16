WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<`from`: STRING, `to`: STRING>'
  ) AS params
),

source_data AS (
  SELECT
    CAST(
      from_unixtime(
        CASE
          WHEN created_at >= 1000000000000 THEN created_at / 1000
          ELSE created_at
        END
      ) AS TIMESTAMP
    ) AS created_ts
  FROM westeurope_extollo_platform_rd_eu_rdppe_non_customer_int_adbv.`2021024_sofa_gold_dev`.announcement_2021024_sofa_gold
  WHERE is_active = true
    AND created_at IS NOT NULL
),

filtered_data AS (
  SELECT
    created_ts,
    date_trunc('week', created_ts) AS week_start
  FROM source_data
  CROSS JOIN chart_input
  WHERE (
      chart_input.params.`from` IS NULL
      OR DATE(created_ts) >= CAST(chart_input.params.`from` AS DATE)
    )
    AND (
      chart_input.params.`to` IS NULL
      OR DATE(created_ts) <= CAST(chart_input.params.`to` AS DATE)
    )
),

weekly_values AS (
  SELECT
    week_start,
    COUNT(*) AS active_announcements
  FROM filtered_data
  GROUP BY week_start
)

SELECT
  CAST(
    unix_millis(CAST(week_start AS TIMESTAMP)) AS DOUBLE
  ) AS x,
  array(CAST(active_announcements AS DOUBLE)) AS y
FROM weekly_values
ORDER BY week_start ASC;
