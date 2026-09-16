WITH daily_values AS (
  SELECT
    DATE(fleet_creation_date) AS fleet_day,
    COUNT(DISTINCT user_id) AS active_users
  FROM westeurope_extollo_platform_rd_eu_rdppe_non_customer_int_adbv.`2021024_sofa_gold_dev`.fleet_definition_2021024_sofa_gold
  WHERE fleet_creation_date IS NOT NULL
  GROUP BY DATE(fleet_creation_date)
)

SELECT
  CAST(unix_millis(CAST(fleet_day AS TIMESTAMP)) AS DOUBLE) AS x,
  array(CAST(active_users AS DOUBLE)) AS y
FROM daily_values
ORDER BY fleet_day ASC;
