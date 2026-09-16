WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<fleet_creation_date: ARRAY<STRING>>'
  ) AS params
),

unique_fleets AS (
  SELECT
    fleet_name,
    MIN(DATE(fleet_creation_date)) AS fleet_day
  FROM westeurope_extollo_platform_rd_eu_rdppe_non_customer_int_adbv.`2021024_sofa_gold_dev`.fleet_definition_2021024_sofa_gold
  CROSS JOIN chart_input
  WHERE fleet_creation_date IS NOT NULL
    AND fleet_name IS NOT NULL
    AND (
      chart_input.params.fleet_creation_date IS NULL
      OR array_contains(
        chart_input.params.fleet_creation_date,
        CAST(DATE(fleet_creation_date) AS STRING)
      )
    )
  GROUP BY fleet_name
),

daily_values AS (
  SELECT
    fleet_day,
    COUNT(*) AS new_fleets
  FROM unique_fleets
  GROUP BY fleet_day
),

cumulative_values AS (
  SELECT
    fleet_day,
    SUM(new_fleets) OVER (
      ORDER BY fleet_day
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_fleets
  FROM daily_values
)

SELECT
  CAST(unix_millis(CAST(fleet_day AS TIMESTAMP)) AS DOUBLE) AS x,
  array(CAST(cumulative_fleets AS DOUBLE)) AS y
FROM cumulative_values
ORDER BY fleet_day ASC;
