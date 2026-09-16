WITH unique_fleets AS (
  SELECT
    fleet_name,
    MIN(DATE(fleet_creation_date)) AS fleet_day
  FROM westeurope_extollo_platform_rd_eu_rdppe_non_customer_int_adbv.`2021024_sofa_gold_dev`.fleet_definition_2021024_sofa_gold
  WHERE fleet_creation_date IS NOT NULL
    AND fleet_name IS NOT NULL
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
    new_fleets,
    SUM(new_fleets) OVER (
      ORDER BY fleet_day
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_fleets
  FROM daily_values
)

SELECT
  date_format(fleet_day, 'dd.MM.yyyy') AS datum,
  cumulative_fleets AS fleets_gesamt,
  new_fleets AS neue_fleets
FROM cumulative_values
WHERE array_contains(
  from_json(CAST(:x AS STRING), 'array<double>'),
  CAST(unix_millis(CAST(fleet_day AS TIMESTAMP)) AS DOUBLE)
)
ORDER BY fleet_day;
